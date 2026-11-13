// Pure helpers for the sidebar: formatting, the bars' geometry, and how raw readings become state.
import type { AgentInfo, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code';

import type {
  Agent,
  Breakdown,
  Changes,
  Local,
  Rail,
  Sandbox,
  Status,
  Tokens,
  Usage,
} from '../types';

// ---------------------------------------------------------------- tokens

export const ZERO: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const add = (a: Tokens, b: Tokens): Tokens => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

/** The share of the input the prompt cache served, 0 to 100; null where there was no input. */
export const hitRate = (t: Tokens) => {
  const input = t.input + t.cacheRead + t.cacheWrite;
  return input > 0 ? Math.round((t.cacheRead / input) * 100) : null;
};

/** Tokens a second over the requests' own time, uncached input and output together; null before a request took any time. */
export const tokenRate = (t: Tokens, ms: number) =>
  ms > 0 ? (t.input + t.output) / (ms / 1000) : null;

// ---------------------------------------------------------------- formatting

/** `claude-fable-5-2` reads `Fable 5.2`; a name that is no id is kept as it is. */
export const prettyModel = (id: string) => {
  const parts = id
    .replace(/\[.*\]$/, '')
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .split('-')
    .filter(Boolean);
  const words = parts
    .filter((p) => !/^\d+$/.test(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const version = parts.filter((p) => /^\d+$/.test(p)).join('.');
  return [...words, version, /\[1m\]$/i.test(id) ? '1M' : ''].filter(Boolean).join(' ');
};

/** `950`, `82K`, `1.0M`. */
export const fmtTokens = (n: number) =>
  n < 1000
    ? String(n)
    : n < 999_500
      ? `${Math.round(n / 1000)}K`
      : `${(n / 1_000_000).toFixed(1)}M`;

/** `103.9`, `1.2k`. */
export const fmtRate = (rate: number) =>
  rate < 999.95 ? rate.toFixed(1) : `${(rate / 1000).toFixed(1)}k`;

/** A percentage as it was measured: `70`, `23.5`. */
export const fmtPercent = (percent: number) =>
  `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;

/** A duration as a clock: `0:18`, `7:46`, `1:02:09`. */
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60));
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
};

/** A moment as the time of day it was here: `14:37`. */
export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** The time left until a reset: `<1m`, `25m`, `2h 10m`, `1d 13h`. */
export const fmtLeft = (ms: number) => {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

export const fmtUsd = (usd: number) => `$${usd.toFixed(2)}`;

/** One line: runs of whitespace, line breaks included, become one space. */
export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Cuts to `max` cells, the last one an ellipsis when anything was cut. */
export const shorten = (s: string, max: number) => {
  const chars = [...s];
  if (chars.length <= max) return s;
  return max <= 1 ? '…' : `${chars.slice(0, max - 1).join('')}…`;
};

const MODES: [RegExp, string][] = [
  [/plan mode/i, 'plan'],
  [/accept edits/i, 'acceptEdits'],
  [/auto mode/i, 'auto'],
  [/bypass permissions/i, 'bypassPermissions'],
];

/** The permission mode Claude Code's own hint line names (as after a shift+tab), when it names one. */
export const modeIn = (hint: string) => MODES.find(([pattern]) => pattern.test(hint))?.[1];

/** A permission mode in words: `acceptEdits` reads `accept edits`. */
export const modeLabel = (mode: string) => mode.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

/** The theme colour a rate limit's figure is drawn in. */
export const level = (percent: number) =>
  percent >= 90 ? 'error' : percent >= 75 ? 'warning' : 'text';

/** The theme colour a context fill is drawn in once it needs attention: orange past 65%, red past 85%. */
export const alarm = (percent: number) => (percent > 85 ? 'error' : percent > 65 ? 'claude' : null);

// ---------------------------------------------------------------- bars

/** How many of `width` cells a percentage fills: at least one once anything is used. */
export const filled = (percent: number, width: number) =>
  percent <= 0 ? 0 : Math.max(1, Math.min(width, Math.round((percent / 100) * width)));

/**
 * A bar of `width` cells shared out by size, the cells always adding up to the width. While there
 * is a cell for every part, a part too small for one still shows: it takes its cell from the widest.
 */
export const segments = (sizes: readonly number[], width: number) => {
  const total = sizes.reduce((sum, n) => sum + n, 0);
  if (total <= 0 || width <= 0) return sizes.map(() => 0);
  // By size, rounded down; the cells that leaves over go to the parts that lost the most.
  const exact = sizes.map((n) => (n / total) * width);
  const cells = exact.map(Math.floor);
  const spare = width - cells.reduce((sum, n) => sum + n, 0);
  const byLoss = exact
    .map((x, i) => ({ i, lost: x - Math.floor(x) }))
    .sort((a, b) => b.lost - a.lost);
  for (const { i } of byLoss.slice(0, spare)) cells[i] = (cells[i] ?? 0) + 1;
  if (sizes.filter((n) => n > 0).length <= width) {
    sizes.forEach((n, i) => {
      if (n <= 0 || cells[i] !== 0) return;
      const widest = cells.indexOf(Math.max(...cells));
      cells[widest] = (cells[widest] ?? 1) - 1;
      cells[i] = 1;
    });
  }
  return cells;
};

/**
 * Each agent's lane on one time axis of `width` cells, from the first spawn to now: the cells
 * before its run, the cells of its run (at least one) and the cells after.
 */
export const lanes = (list: readonly Agent[], now: number, width: number) => {
  const start = Math.min(now, ...list.map((a) => a.spawnedAt));
  const span = Math.max(1, now - start);
  return list.map((a) => {
    const from = Math.min(
      width - 1,
      Math.max(0, Math.floor(((a.spawnedAt - start) / span) * width)),
    );
    const to = Math.min(
      width,
      Math.max(from + 1, Math.ceil((((a.endedAt ?? now) - start) / span) * width)),
    );
    return { before: from, bar: to - from, after: width - to };
  });
};

// ---------------------------------------------------------------- readings

/** The engine's usage figures as the sidebar keeps them; a reset time it cannot parse is dropped. */
export const usageOf = (
  u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>,
): Omit<Usage, 'startedAt'> => ({
  tokens: u.context.tokens ?? null,
  window: u.context.window,
  percent: u.context.percent ?? null,
  costUsd: u.cost?.usd ?? null,
  limits: u.rateLimits.map((l) => {
    const at = l.resetsAt === undefined ? Number.NaN : Date.parse(l.resetsAt);
    return { kind: l.kind, percent: l.percentUsed, resetsAt: Number.isNaN(at) ? null : at };
  }),
});

/** What fills the window, by category: the free space, the compaction reserve and empty rows left out. */
export const breakdownOf = (b: SessionContextBreakdown): Breakdown => ({
  categories: b.categories
    .filter((c) => c.kind === 'used' && c.tokens > 0)
    .map((c) => ({ name: c.name, tokens: c.tokens })),
  compactAt: b.isAutoCompactEnabled ? (b.autoCompactThreshold ?? null) : null,
});

const objectOf = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** The sandbox as the merged settings configure it; what a key leaves unset is Claude Code's default. */
export const sandboxOf = (settings: Settings): Sandbox => {
  const sandbox = objectOf(settings.sandbox);
  return {
    isEnabled: sandbox.enabled === true,
    autoAllowBash: sandbox.autoAllowBashIfSandboxed !== false,
    allowUnsandboxed: sandbox.allowUnsandboxedCommands !== false,
  };
};

const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * The weekly limit scoped to the Fable models in the usage endpoint's reply, as the percentage used;
 * null where the reply lists none.
 */
export const fableOf = (reply: string) => {
  try {
    const limit = listOf(objectOf(JSON.parse(reply)).limits)
      .map(objectOf)
      .find(
        (l) =>
          l.kind === 'weekly_scoped' &&
          String(objectOf(objectOf(l.scope).model).display_name ?? '')
            .toLowerCase()
            .includes('fable'),
      );
    return typeof limit?.percent === 'number' ? limit.percent : null;
  } catch {
    return null;
  }
};

/** What the store keeps of the last asking, the figure and when; null where it holds nothing of the kind. */
export const keptFable = (value: unknown): { percent: number | null; at: number } | null => {
  const kept = objectOf(value);
  return typeof kept.at === 'number' && (kept.percent === null || typeof kept.percent === 'number')
    ? { percent: kept.percent, at: kept.at }
    : null;
};

const sum = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].reduce((n, match) => n + Number(match[1]), 0);

/** The lines `git diff --shortstat` counts, over as many of its outputs as the text holds. */
export const changesOf = (shortstat: string): Changes => ({
  added: sum(shortstat, /(\d+) insertion/g),
  removed: sum(shortstat, /(\d+) deletion/g),
});

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

/** The Powerline glyph for a git branch, which a Nerd Font draws. */
export const BRANCH_ICON = '\uE0A0';

/**
 * Where the session works: the project's name, the linked worktree's when it is in one, and the
 * branch checked out (none on a detached HEAD). `revParse` is git's `--show-toplevel`,
 * `--git-common-dir` and `--abbrev-ref HEAD`, a line each and the paths absolute; null outside a
 * repository, where the session's own folder names the project.
 */
export const whereOf = (
  revParse: string | null,
  root: string,
): Pick<Local, 'project' | 'worktree' | 'branch'> => {
  const [top, common, head] = (revParse ?? '').split('\n');
  if (!top || !common) return { project: baseName(root), worktree: '', branch: '' };
  // A linked worktree keeps its git directory under the main tree's `.git`.
  const main = common.endsWith('/.git') ? common.slice(0, -'/.git'.length) : top;
  return {
    project: baseName(main),
    worktree: main === top ? '' : baseName(top),
    branch: head && head !== 'HEAD' ? head : '',
  };
};

// ---------------------------------------------------------------- prompts

/** The rail keeps the latest prompts: a long session should not grow its state. */
const KEPT_PROMPTS = 200;

/** The id a row has while the conversation has not given it one. */
const NO_ID = 'placeholder';

/**
 * What tells a row of the conversation, whichever way it is named: the transcript draws a typed
 * prompt under its stored id with the last group zeroed, so only what comes before is compared.
 */
export const rowKey = (id: string) => id.slice(0, 23);

/** The last prompt that left the screen: which one, and whether it went off the bottom edge. */
export type Left = { id: string; isBelow: boolean };

/**
 * The rail brought up to date with what the transcript has reported of the prompts it draws:
 * `seen` their ids and texts in the order they were first drawn, `shown` the ids on screen now.
 *
 * The prompt being read is the topmost one on screen. With none on screen it is the one that last
 * left, or the one before it when that one went off the bottom (the reader scrolled up past it).
 * Until the transcript has said anything it is the latest.
 *
 * Rows are drawn as they scroll into view, which is not the order they were typed in: `order` is
 * the ids as the conversation keeps them, and the rail follows it. One it does not hold yet is a
 * prompt just typed, and stays last. A row drawn before the conversation gave it an id is no prompt
 * to jump to.
 */
export const railOf = (
  known: Rail,
  seen: readonly (readonly [string, string])[],
  shown: readonly string[],
  left: Left | undefined,
  order?: readonly string[],
): Rail => {
  const texts = new Map(seen);
  const at = new Map(order?.map((id, i) => [rowKey(id), i]));
  const drawn = [
    ...known.prompts.map((p) => ({ id: p.id, text: texts.get(p.id) ?? p.text })),
    ...seen
      .filter(([id]) => !known.prompts.some((p) => p.id === id))
      .map(([id, text]) => ({ id, text })),
  ].filter((p) => p.id !== NO_ID);
  // A prompt typed over a running turn is drawn under other ids before the conversation gives it
  // its own: once a prompt of that text is in the conversation, those earlier rows are not kept,
  // and of several still waiting under one text only the latest is.
  const stored = drawn
    .filter((p) => at.has(rowKey(p.id)))
    .sort((a, b) => (at.get(rowKey(a.id)) ?? 0) - (at.get(rowKey(b.id)) ?? 0));
  const waiting = drawn.filter(
    (p, i) =>
      !at.has(rowKey(p.id)) &&
      !stored.some((k) => k.text === p.text) &&
      !drawn.some((later, l) => l > i && !at.has(rowKey(later.id)) && later.text === p.text),
  );
  const prompts = (order === undefined ? drawn : [...stored, ...waiting]).slice(-KEPT_PROMPTS);
  const onScreen = prompts.find((p) => shown.includes(p.id));
  const leftAt = prompts.findIndex((p) => p.id === left?.id);
  const offScreen = leftAt < 0 ? undefined : prompts[Math.max(0, leftAt - (left?.isBelow ? 1 : 0))];
  const kept = prompts.find((p) => p.id === known.reading);
  return { prompts, reading: (onScreen ?? offScreen ?? kept ?? prompts.at(-1))?.id ?? null };
};

/** The `size` rows of a list of `count` to draw so that row `at` is among them, as [from, to). */
export const windowOf = (count: number, at: number, size: number): [number, number] => {
  const from = Math.max(0, Math.min(count - size, at - Math.floor(size / 2)));
  return [from, Math.min(count, from + size)];
};

// ---------------------------------------------------------------- subagents

export const newAgent = (a: {
  id: string;
  title: string;
  type: string;
  model: string;
  now: number;
}): Agent => ({
  id: a.id,
  title: clean(a.title) || a.type,
  type: a.type,
  model: a.model,
  status: 'running',
  spawnedAt: a.now,
  endedAt: null,
});

/** How many subagents run, are done, and ended any other way (failed, or stopped). */
export const tally = (list: readonly Agent[]) => ({
  run: list.filter((a) => a.status === 'running').length,
  done: list.filter((a) => a.status === 'done').length,
  err: list.filter((a) => a.status === 'failed' || a.status === 'stopped').length,
});

/** An agent type's own name, in lower case: `explore`, and `code-reviewer` for `feature-dev:code-reviewer`. */
export const agentType = (type: string) => (type.split(':').pop() ?? type).toLowerCase();

const LIVE = new Set(['pending', 'running', 'waiting']);
const ENDED: Record<string, Status> = { completed: 'done', failed: 'failed', killed: 'stopped' };

/**
 * The cards brought in line with the engine's own list: a live agent the sidebar never saw spawn
 * gets a card from now, and a running card whose agent the engine says has ended is closed.
 * The same array comes back when nothing changed.
 */
export const merge = (cards: Agent[], listed: readonly AgentInfo[], now: number): Agent[] => {
  let hasChanged = false;
  const next = cards.map((card) => {
    const ended = ENDED[listed.find((a) => a.id === card.id)?.status ?? ''];
    if (card.status !== 'running' || ended === undefined) return card;
    hasChanged = true;
    return { ...card, status: ended, endedAt: now };
  });
  for (const a of listed) {
    if (!LIVE.has(a.status) || cards.some((c) => c.id === a.id)) continue;
    hasChanged = true;
    next.push(newAgent({ id: a.id, title: a.description, type: a.name ?? a.type, model: '', now }));
  }
  return hasChanged ? next : cards;
};

// ---------------------------------------------------------------- replies

export type Align = 'left' | 'center' | 'right';

/** A stretch of a cell's text and how it is lettered. */
export type Span = { text: string; isBold?: true; isCode?: true };

/** A reply in the pieces it is drawn in: its prose, as markdown, each of its tables and each of its code fences. */
export type Piece =
  | { kind: 'prose'; text: string }
  | { kind: 'table'; head: string[]; align: Align[]; rows: string[][] }
  | { kind: 'code'; language: string | undefined; source: string };

/** A fence's opening line: its indent, its run of marks and the language named after them. */
const FENCE = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/;
const DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** A table row's cells: split at the bars that are neither escaped nor inside a code span. */
const cellsOf = (line: string) => {
  const cells: string[] = [];
  let cell = '';
  let isCode = false;
  const row = line.trim().replace(/^\|/, '');
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '\\' && row[i + 1] === '|') {
      cell += '|';
      i += 1;
    } else if (ch === '|' && !isCode) {
      cells.push(cell.trim());
      cell = '';
    } else {
      if (ch === '`') isCode = !isCode;
      cell += ch;
    }
  }
  if (cell.trim() !== '') cells.push(cell.trim());
  return cells;
};

const alignOf = (mark: string): Align =>
  mark.endsWith(':') ? (mark.startsWith(':') ? 'center' : 'right') : 'left';

/**
 * Splits a reply's markdown at its tables and its code fences. A table is a row of cells, a divider
 * under it, and the rows that follow; a fence runs to the line that closes it, or to the end of a
 * reply still being written, and what looks like a table inside one is its code.
 */
export const piecesOf = (markdown: string): Piece[] => {
  const lines = markdown.split('\n');
  const pieces: Piece[] = [];
  let prose: string[] = [];
  const flush = () => {
    if (prose.join('\n').trim() !== '') pieces.push({ kind: 'prose', text: prose.join('\n') });
    prose = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const fence = FENCE.exec(line);
    if (fence !== null) {
      const [, indent = '', marks = '', language = ''] = fence;
      const isClosing = (l: string) =>
        l.trim().startsWith(marks) && l.trim().replaceAll(marks[0] ?? '', '') === '';
      const code: string[] = [];
      for (i += 1; i < lines.length && !isClosing(lines[i] ?? ''); i += 1) {
        const l = lines[i] ?? '';
        code.push(l.startsWith(indent) ? l.slice(indent.length) : l.trimStart());
      }
      flush();
      pieces.push({
        kind: 'code',
        language: language === '' ? undefined : language,
        source: code.join('\n'),
      });
      continue;
    }
    const divider = lines[i + 1] ?? '';
    if (!line.includes('|') || !divider.includes('-') || !DIVIDER.test(divider)) {
      prose.push(line);
      continue;
    }
    const head = cellsOf(line);
    const align = cellsOf(divider).map(alignOf);
    if (head.length === 0 || head.length !== align.length) {
      prose.push(line);
      continue;
    }
    const rows: string[][] = [];
    i += 2;
    for (; i < lines.length && (lines[i] ?? '').includes('|'); i += 1) {
      const cells = cellsOf(lines[i] ?? '');
      rows.push(head.map((_, c) => cells[c] ?? ''));
    }
    i -= 1;
    flush();
    pieces.push({ kind: 'table', head, align, rows });
  }
  flush();
  return pieces;
};

/** A cell's inline markdown as lettered stretches: bold, code, and a link by its label. */
export const spansOf = (cell: string): Span[] => {
  const spans: Span[] = [];
  let at = 0;
  for (const m of cell.matchAll(/\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g)) {
    if (m.index > at) spans.push({ text: cell.slice(at, m.index) });
    if (m[1] !== undefined) spans.push({ text: m[1], isBold: true });
    else if (m[2] !== undefined) spans.push({ text: m[2], isCode: true });
    else spans.push({ text: m[3] ?? '' });
    at = m.index + m[0].length;
  }
  if (at < cell.length) spans.push({ text: cell.slice(at) });
  return spans;
};

/** The cells a column needs for its widest cell, each character taken as one. */
export const columnsOf = (head: readonly string[], rows: readonly (readonly string[])[]) =>
  head.map((_, c) =>
    Math.max(
      1,
      ...[head, ...rows].map(
        (row) =>
          [
            ...spansOf(row[c] ?? '')
              .map((s) => s.text)
              .join(''),
          ].length,
      ),
    ),
  );

// ---------------------------------------------------------------- pictures

/** The pasted images a prompt names, by the number of each `[Image #n]` tag, once each. */
export const imagesIn = (text: string) => [
  ...new Set([...text.matchAll(/\[Image #(\d+)\]/g)].map((m) => Number(m[1]))),
];

/** A picture as cells: each an upper half block, its ink the pixel above and its ground the one below. */
export type Thumb = { columns: number; rows: number; cells: string };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes as standard padded base64. */
export const toBase64 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      (BASE64[n >> 18] ?? '') +
      (BASE64[(n >> 12) & 63] ?? '') +
      (i + 1 < bytes.length ? (BASE64[(n >> 6) & 63] ?? '') : '=') +
      (i + 2 < bytes.length ? (BASE64[n & 63] ?? '') : '=');
  }
  return out;
};

/** The bytes a standard base64 string holds. */
export const fromBase64 = (text: string) => {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  for (let i = 0, o = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].reduce(
      (acc, k) => (acc << 6) | Math.max(0, BASE64.indexOf(clean[i + k] ?? 'A')),
      0,
    );
    for (const shift of [16, 8, 0]) if (o < bytes.length) bytes[o++] = (n >> shift) & 255;
  }
  return bytes;
};

const HALF_BLOCK = 0x2580;
const NO_COLOR = 0x01000000;

/**
 * A small uncompressed BMP (24 or 32 bits a pixel) as the cells of a Raster, a column a pixel and a
 * row two; null for anything else. A BMP needs no inflating, which is why the thumbnails are made as one.
 */
export const thumbOf = (bmp: Uint8Array): Thumb | null => {
  if (bmp.length < 54 || bmp[0] !== 0x42 || bmp[1] !== 0x4d) return null;
  const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);
  const offset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const signed = view.getInt32(22, true);
  const bytes = view.getUint16(28, true) / 8;
  const height = Math.abs(signed);
  const stride = Math.ceil((width * bytes) / 4) * 4;
  if (
    (bytes !== 3 && bytes !== 4) ||
    width < 1 ||
    height < 1 ||
    offset + stride * height > bmp.length
  )
    return null;
  // Rows are stored bottom-up unless the height is negative, and a pixel as blue, green, red.
  const at = (x: number, y: number) => {
    const i = offset + (signed > 0 ? height - 1 - y : y) * stride + x * bytes;
    return ((bmp[i + 2] ?? 0) << 16) | ((bmp[i + 1] ?? 0) << 8) | (bmp[i] ?? 0);
  };
  const rows = Math.ceil(height / 2);
  const words = new Uint32Array(width * rows * 3);
  for (let r = 0; r < rows; r += 1)
    for (let x = 0; x < width; x += 1)
      words.set(
        [HALF_BLOCK, at(x, r * 2), r * 2 + 1 < height ? at(x, r * 2 + 1) : NO_COLOR],
        (r * width + x) * 3,
      );
  return { columns: width, rows, cells: toBase64(new Uint8Array(words.buffer)) };
};

/**
 * The cells a picture of `width` by `height` pixels takes where a cell is `ratio` times as tall as
 * it is wide: `maxRows` tall, or as tall as `maxColumns` leaves a wide one.
 */
export const tileOf = (
  width: number,
  height: number,
  maxRows: number,
  maxColumns: number,
  ratio = 2,
) => {
  const columns = Math.max(1, Math.round((maxRows * ratio * width) / height));
  return columns <= maxColumns
    ? { columns, rows: maxRows }
    : { columns: maxColumns, rows: Math.max(1, Math.round((maxColumns * height) / width / ratio)) };
};
