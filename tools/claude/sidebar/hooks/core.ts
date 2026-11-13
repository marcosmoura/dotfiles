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

/** The last prompt that left the screen: which one, and whether it went off the bottom edge. */
export type Left = { id: string; isBelow: boolean };

/**
 * The rail brought up to date with what the transcript has reported of the prompts it draws:
 * `seen` their ids and texts in the order they were first drawn, `shown` the ids on screen now.
 *
 * The prompt being read is the topmost one on screen. With none on screen it is the one that last
 * left, or the one before it when that one went off the bottom (the reader scrolled up past it).
 * Until the transcript has said anything it is the latest.
 */
export const railOf = (
  known: Rail,
  seen: readonly (readonly [string, string])[],
  shown: readonly string[],
  left: Left | undefined,
): Rail => {
  const texts = new Map(seen);
  const prompts = [
    ...known.prompts.map((p) => ({ id: p.id, text: texts.get(p.id) ?? p.text })),
    ...seen
      .filter(([id]) => !known.prompts.some((p) => p.id === id))
      .map(([id, text]) => ({ id, text })),
  ].slice(-KEPT_PROMPTS);
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
