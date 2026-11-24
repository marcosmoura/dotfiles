// The sidebar: a docked pane with the project, the session's vitals, its context window (a press
// breaks it down by category), a rail of the person's prompts (a press scrolls the transcript to
// one), its subagents on a timeline (a press on a lane opens that subagent's transcript) and the
// MCP servers it has tools from; and, under the prompt, the model, the effort,
// the project's folder and the context's fill in place of Claude Code's hint row. Above the prompt
// it lists the prompts waiting for the running turn and previews the images pasted into the
// draft. The thread itself stays Claude Code's. Beyond that it only watches: every event hook
// passes its event on.
import { atom, read, update } from 'claude-code';
import type { ElementTable, EngineInterface, Register, RenderChildren } from 'claude-code';

import type { Agent, Breakdown, Local, Main, Prompt, Rail, Status, Usage } from '../types';
import type { Left, Thumb } from './core';
import {
  BRANCH_ICON,
  ZERO,
  add,
  agentType,
  alarm,
  breakdownOf,
  changesOf,
  clean,
  fableOf,
  filled,
  fmtClock,
  fmtLeft,
  fmtPercent,
  fmtRate,
  fmtTokens,
  fmtUsd,
  fromBase64,
  hitRate,
  imagesIn,
  keptFable,
  lanes,
  lastResponseOf,
  level,
  merge,
  modeIn,
  modeLabel,
  newAgent,
  prettyModel,
  railOf,
  sandboxOf,
  segments,
  serversOf,
  shorten,
  tally,
  thumbOf,
  tileOf,
  tilde,
  tokenRate,
  usageOf,
  whereOf,
  windowOf,
} from './core';

const PANE = 'sidebar';
const OPEN = { id: PANE, title: 'Sidebar', columns: 64 };
/** The cells the pane keeps clear at its left and right edges. */
const PAD_X = 3;
/** Cards kept: the pane draws the latest few, and a long session should not grow its state. */
const KEPT = 40;
/** Room for a clock up to `9:59:59`. */
const CLOCK = 7;
/** A lane a digit: the keys that open them. */
const MAX_LANES = 9;
/** The rows of the opened rail of prompts: a window that keeps the prompt being read in it. */
const MAX_PROMPTS = 8;
/** Where Anthropic tells an account its limits, the weekly one scoped to the Fable models among them. */
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
/** It answers for the whole account and limits its callers: every session together asks at most this often. */
const USAGE_EVERY_MS = 5 * 60_000;
/**
 * What the pointer does to a chip or a row it can press: gray, the theme's colour for quiet text,
 * under dark lettering. The surface also inverts a label the pointer is on, so the hover names its
 * colours the other way round and inverts them itself: inverted once or twice over, it reads the same.
 */
const HOVER = { color: 'inactive', backgroundColor: 'inverseText', inverse: true };
/** The grid's label columns, and the cells its right column takes (its label, a gap, a short figure). */
const LEFT_LABEL = 9;
const RIGHT_LABEL = 12;
const RIGHT = 22;
/** The accent: the box around the person's prompt, the mode in the row under the prompt. */
const FRAME = 'bashBorder';
/** Quiet lettering: the queued prompts, the row under the prompt's details. */
const MUTED = 'inactive';
/** Where the band above the prompt starts. */
const INSET = 3;
/** A thumbnail of a pasted image: this many rows of cells, and no wider than this many columns. */
const THUMB_ROWS = 8;
const THUMB_COLUMNS = 80;
/**
 * How many times taller than wide a cell is on screen, which the terminal does not tell: measured
 * off this setup's font and line height (about 9 by 26 pixels). A picture is stretched to its
 * box of cells, so its shape on screen is only right when this is.
 */
const CELL_RATIO = 2.85;
/** How often the prompt box is read for the images its draft names: a paste raises no event. */
const DRAFT_EVERY_MS = 200;
/** The typed prompts kept, which are few. */
const KEPT_TYPED = 50;
/** How often the transcripts of the subagents at work are read: a response of theirs raises no event that is always heard. */
const AGENTS_EVERY_MS = 5000;
/** The least characters of a waiting prompt that tell it apart inside a longer row. */
const TOLD_APART = 8;
/** Tools that can change the working tree: the uncommitted lines are counted again after one ran. */
const WRITES = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash']);

/** A subagent on the timeline: its glyph, and the colour its kind has in the counts above. */
const GLYPH: Record<Status, string> = { running: '◐', done: '✓', failed: '✗', stopped: '■' };
const TONE: Record<Status, string> = {
  running: 'warning',
  done: 'success',
  failed: 'error',
  stopped: 'error',
};
/** The context categories' colours, in the order the engine lists them. */
const PALETTE = [
  'merged',
  'ide',
  'success',
  'error',
  'bashBorder',
  'warning',
  'planMode',
  'claude',
];
const categoryColor = (i: number) => PALETTE[i % PALETTE.length] ?? 'text';

const MAIN: Main = {
  model: '',
  effort: '',
  mode: '',
  turnStartedAt: null,
  requestMs: 0,
  last: null,
  total: ZERO,
};
const USAGE: Usage = {
  startedAt: 0,
  tokens: null,
  window: 0,
  percent: null,
  costUsd: null,
  limits: [],
};
const BREAKDOWN: Breakdown = { categories: [], compactAt: null };
const LOCAL: Local = { project: '', worktree: '', branch: '', version: '', changes: null };
const RAIL: Rail = { prompts: [], reading: null };

// Bump a tag when its value's fields change: it declines what an earlier version stored, which outlives a reload.
const main = atom({ plugin: 'sidebar', key: 'main' } as const, MAIN, { shape: 'main-2' });
const usage = atom({ plugin: 'sidebar', key: 'usage' } as const, USAGE, { shape: 'usage-1' });
const breakdown = atom({ plugin: 'sidebar', key: 'breakdown' } as const, BREAKDOWN, {
  shape: 'breakdown-1',
});
const local = atom({ plugin: 'sidebar', key: 'local' } as const, LOCAL, { shape: 'local-3' });
const sandbox = atom({ plugin: 'sidebar', key: 'sandbox' } as const, null, { shape: 'sandbox-2' });
const agents = atom({ plugin: 'sidebar', key: 'agents' } as const, [], { shape: 'agents-5' });
const rail = atom({ plugin: 'sidebar', key: 'rail' } as const, RAIL, { shape: 'rail-1' });
const typed = atom({ plugin: 'sidebar', key: 'typed' } as const, []);
const draft = atom({ plugin: 'sidebar', key: 'draft' } as const, []);
const fable = atom({ plugin: 'sidebar', key: 'fable' } as const, null);
const isContextOpen = atom({ plugin: 'sidebar', key: 'isContextOpen' } as const, false);
const isRailOpen = atom({ plugin: 'sidebar', key: 'isRailOpen' } as const, false);
const isMcpOpen = atom({ plugin: 'sidebar', key: 'isMcpOpen' } as const, false);
const isAgentsOpen = atom({ plugin: 'sidebar', key: 'isAgentsOpen' } as const, true);

/** Whether a reading moved. One that did not is not written, so nothing is redrawn for it. */
const differs = (known: unknown, next: unknown) => JSON.stringify(known) !== JSON.stringify(next);

// What the transcript says of the person's prompts while it draws them: those drawn since the rail
// was last written, the part of each that is on screen, and the last to leave it. A drawing may not write
// state, so the reports are kept here and written to the rail from a timer; a reload starts them
// over, and the transcript says them again as it redraws.
const seen = new Map<string, string>();
const shown = new Map<string, { first: number; last: number; of: number }>();
let left: Left | undefined;
let isDue = false;
/** The rail is written by one publish at a time: a second that started on the first's reading would put its prompts out of order. */
let publishing: Promise<void> = Promise.resolve();

/**
 * Prints, of the ids it is given, those the session's transcript file holds, in the file's order:
 * the order the conversation took its rows in. An id is told by its first 23 characters (`rowKey`).
 */
const ORDER_AWK =
  'BEGIN { n = split(ids, a, ","); for (i = 1; i <= n; i++) want[substr(a[i], 1, 23)] = 1 } ' +
  '{ s = $0; while (match(s, /"uuid":"[0-9a-f-]+"/)) { u = substr(s, RSTART + 8, 23); ' +
  'if ((u in want) && !(u in seen)) { seen[u] = 1; print u } s = substr(s, RSTART + RLENGTH) } }';
let transcript: string | undefined;
let isOrdered = false;

/** The session's transcript file, looked for until it is there to find. */
const transcriptOf = async ($: EngineInterface) =>
  (transcript ??=
    (await sh(
      $,
      'ls "$HOME"/.claude/projects/*/"$0".jsonl 2>/dev/null | head -1',
      await $.session.id(),
    )) || undefined);

/** The prompts' ids in the order they were typed; undefined where the transcript cannot be read. */
const orderOf = async ($: EngineInterface, ids: readonly string[]) => {
  try {
    const file = await transcriptOf($);
    if (file === undefined || ids.length === 0) return undefined;
    const ran = await $.process.run(['awk', '-v', `ids=${ids.join(',')}`, ORDER_AWK, file], {
      timeoutMs: 10_000,
    });
    return ran.exitCode === 0 ? ran.stdout.split('\n').filter((id) => id !== '') : undefined;
  } catch {
    return undefined;
  }
};

const publish = async ($: EngineInterface) => {
  isDue = false;
  const batch = [...seen];
  seen.clear();
  const onScreen = [...shown.keys()];
  const known = await read($, rail);
  // The order is asked again when a prompt is new to the rail, and once after a load, which puts
  // right a rail kept from before in the order its rows were drawn.
  const isNew = batch.some(([id]) => !known.prompts.some((p) => p.id === id));
  const order =
    isNew || !isOrdered
      ? await orderOf($, [
          ...new Set([...known.prompts.map((p) => p.id), ...batch.map(([id]) => id)]),
        ])
      : undefined;
  if (order !== undefined) isOrdered = true;
  if (differs(known, railOf(known, batch, onScreen, left, order)))
    await update($, rail, (r) => railOf(r, batch, onScreen, left, order));
};

/**
 * The engine's figures for the session, which cost nothing to read; with `isBrokenDown`, its window
 * by category too, which the engine estimates locally.
 */
const refreshUsage = async ($: EngineInterface, isBrokenDown = false) => {
  const u = await $.session.usage(isBrokenDown ? { breakdown: 'summary' } : undefined);
  const figures = { startedAt: u.startedAt, ...usageOf(u) };
  if (differs(await read($, usage), figures)) await update($, usage, () => figures);
  if (u.context.breakdown === undefined) return;
  const parts = breakdownOf(u.context.breakdown);
  if (differs(await read($, breakdown), parts)) await update($, breakdown, () => parts);
};

const refreshSandbox = async ($: EngineInterface) => {
  const next = sandboxOf(await $.settings.read());
  if (differs(await read($, sandbox), next)) await update($, sandbox, () => next);
};

/** Brings the cards in line with the engine's own list of agents (core's `merge`). */
const syncAgents = async ($: EngineInterface) => {
  const [known, listedNow, now] = await Promise.all([
    read($, agents),
    $.agent.list(),
    $.clock.now(),
  ]);
  if (merge(known, listedNow, now) !== known)
    await update($, agents, (list) => merge(list, listedNow, now));
};

/** A git command's output, in the session's directory; null where it fails or git is missing. */
const git = async ($: EngineInterface, ...args: string[]) => {
  try {
    const ran = await $.process.run(['git', ...args], { timeoutMs: 5000 });
    return ran.exitCode === 0 ? ran.stdout.trim() : null;
  } catch {
    return null;
  }
};

/** Uncommitted lines: those of the unstaged diff and of the staged one, added up. */
const gitChanges = async ($: EngineInterface) => {
  const [unstaged, staged] = await Promise.all([
    git($, 'diff', '--shortstat'),
    git($, 'diff', '--cached', '--shortstat'),
  ]);
  return unstaged === null || staged === null ? null : changesOf(`${unstaged}\n${staged}`);
};

const refreshLocal = async ($: EngineInterface) => {
  const [revParse, root, version, changes] = await Promise.all([
    git(
      $,
      'rev-parse',
      '--path-format=absolute',
      '--show-toplevel',
      '--git-common-dir',
      '--abbrev-ref',
      'HEAD',
    ),
    $.session.root(),
    $.session.version(),
    gitChanges($),
  ]);
  // The project's folder moves with a worktree, and no session.start follows.
  rootdir = root;
  const next = { ...whereOf(revParse, root), version: version.version, changes };
  if (differs(await read($, local), next)) await update($, local, () => next);
};

const refreshChanges = async ($: EngineInterface) => {
  const changes = await gitChanges($);
  if (differs((await read($, local)).changes, changes))
    await update($, local, (l) => ({ ...l, changes }));
};

/**
 * The weekly Fable limit, which no figure of the session carries: asked of Anthropic's usage
 * endpoint with the session's own login. The login stays on the host, and the handle only lets
 * this one request carry it. Undefined where it could not be asked (no first-party login, a refusal).
 */
const askFable = async ($: EngineInterface) => {
  try {
    const login = await $.session.authorize();
    if (login === null) return undefined;
    const reply = await $.http.fetch(USAGE_URL, {
      headers: { 'anthropic-beta': 'oauth-2025-04-20' },
      auth: login.handle,
    });
    return reply.ok ? fableOf(reply.text) : undefined;
  } catch {
    return undefined;
  }
};

let isAsking = false;

/**
 * Brings the Fable limit up to date. The last answer is kept in the store, which every session
 * shares, with when it was asked for: a session asks again only once that is old, and stamps the
 * time before it asks, so sessions that notice together do not all ask, and a refusal waits its turn.
 */
const refreshFable = async ($: EngineInterface) => {
  if (isAsking) return;
  isAsking = true;
  try {
    const now = await $.clock.now();
    const kept = keptFable(await $.store.get('fable'));
    let percent = kept?.percent ?? null;
    if (kept === null || now - kept.at >= USAGE_EVERY_MS) {
      await $.store.set('fable', { percent, at: now });
      const asked = await askFable($);
      if (asked !== undefined) {
        percent = asked;
        await $.store.set('fable', { percent, at: now });
      }
    }
    if ((await read($, fable)) !== percent) await update($, fable, () => percent);
  } finally {
    isAsking = false;
  }
};

/** Asks from a timer, off the event that noticed the limit may have moved: a request must not hold a turn up. */
const scheduleFable = ($: EngineInterface) => {
  $.clock.after(0, () => void refreshFable($).catch(() => undefined));
};

/** Everything read at a turn's edges; the window by category only where the context has just moved. */
const refresh = ($: EngineInterface, isBrokenDown = false) => {
  scheduleFable($);
  return Promise.all([
    refreshUsage($, isBrokenDown),
    refreshSandbox($),
    syncAgents($),
    refreshLocal($),
  ]);
};

// The pasted images. Claude Code keeps each in the session's temporary folder as `images/<n>.<ext>`
// from the moment it is pasted. Where the terminal draws pictures, a tile is that file itself (as a
// PNG, which is all the terminal reads from a file). Elsewhere it is the file scaled down by `sips`
// into a small BMP beside the folder, read back and drawn in half blocks.
type Tile =
  | { kind: 'picture'; file: string; columns: number; rows: number }
  | { kind: 'blocks'; thumb: Thumb };

let folder: string | undefined;
let pictures: Promise<boolean> | undefined;
const tiles = new Map<number, Promise<Tile | null>>();

const sh = async ($: EngineInterface, script: string, ...args: string[]) => {
  const ran = await $.process.run(['sh', '-c', script, ...args], { timeoutMs: 5000 });
  return ran.exitCode === 0 ? ran.stdout.trim() : '';
};

/**
 * Whether Claude Code draws pictures in this terminal: Ghostty and kitty outside tmux, or any the
 * person vouches for with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES` (Herdr, which it does not know by name).
 */
const drawsPictures = ($: EngineInterface) =>
  (pictures ??= (async () => {
    try {
      const forced = await $.env.get('CLAUDE_CODE_FORCE_TERMINAL_IMAGES');
      if (forced !== undefined && forced !== '' && forced !== '0') return true;
      if ((await $.env.get('TMUX')) !== undefined) return false;
      const program = (await $.env.get('TERM_PROGRAM'))?.toLowerCase();
      return program === 'ghostty' || program === 'kitty';
    } catch {
      return false;
    }
  })());

const makeTile = async ($: EngineInterface, n: number): Promise<Tile | null> => {
  try {
    folder ??=
      (await sh(
        $,
        'ls -d /private/tmp/claude-*/*/"$0" /tmp/claude-*/*/"$0" 2>/dev/null | head -1',
        await $.session.id(),
      )) || undefined;
    if (folder === undefined) return null;
    const source = await sh($, 'ls "$0"/images/"$1".* 2>/dev/null | head -1', folder, String(n));
    if (source === '') return null;
    const sips = (...args: string[]) => $.process.run(['sips', ...args], { timeoutMs: 10_000 });

    if (await drawsPictures($)) {
      const size = (await sips('-g', 'pixelWidth', '-g', 'pixelHeight', source)).stdout;
      const width = Number(/pixelWidth: (\d+)/.exec(size)?.[1]);
      const height = Number(/pixelHeight: (\d+)/.exec(size)?.[1]);
      if (!(width > 0 && height > 0)) return null;
      let file = source;
      if (!/\.png$/i.test(source)) {
        file = `${folder}/sidebar-thumb-${n}.png`;
        await sips('-s', 'format', 'png', source, '--out', file);
      }
      return {
        kind: 'picture',
        file,
        ...tileOf(width, height, THUMB_ROWS, THUMB_COLUMNS, CELL_RATIO),
      };
    }

    const out = `${folder}/sidebar-thumb-${n}.bmp`;
    const scaled = async (...size: string[]) => {
      await sips(...size, '-s', 'format', 'bmp', source, '--out', out);
      return thumbOf(fromBase64((await $.fs.read(out, { as: 'bytes' })).base64));
    };
    const tall = await scaled('--resampleHeight', String(THUMB_ROWS * 2));
    const thumb =
      tall !== null && tall.columns > THUMB_COLUMNS
        ? await scaled('--resampleWidth', String(THUMB_COLUMNS))
        : tall;
    return thumb === null ? null : { kind: 'blocks', thumb };
  } catch {
    return null;
  }
};

/** The tile of pasted image `n`, made once; one that could not be made is tried again when next drawn. */
const tileFor = ($: EngineInterface, n: number) => {
  const known = tiles.get(n);
  if (known !== undefined) return known;
  const made = makeTile($, n).then((tile) => {
    if (tile === null) tiles.delete(n);
    return tile;
  });
  tiles.set(n, made);
  return made;
};

/** The pasted images of a prompt side by side, each over its number. */
const strip = async (
  $: EngineInterface,
  { Box, Image, Raster, Text }: ElementTable<'terminal'>,
  numbers: readonly number[],
) => {
  const drawn = await Promise.all(numbers.map(async (n) => ({ n, tile: await tileFor($, n) })));

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {drawn.map(({ n, tile }) => (
        <Box flexDirection="column">
          {tile === null ? (
            <Text color="subtle">no preview</Text>
          ) : tile.kind === 'picture' ? (
            <Image
              key={`image-${n}`}
              source={{ file: tile.file, format: 'png' }}
              columns={tile.columns}
              rows={tile.rows}
              alt={`[Image #${n}]`}
            />
          ) : (
            <Raster
              key={`image-${n}`}
              columns={tile.thumb.columns}
              rows={tile.thumb.rows}
              cells={tile.thumb.cells}
            />
          )}
          <Text color="subtle">{`#${n}`}</Text>
        </Box>
      ))}
    </Box>
  );
};

/** The person's home folder. */
let home = '';
/** The project's folder, which the row under the prompt names. */
let rootdir = '';

let typedDraft = '';
let watching: { cancel: () => void } | undefined;

/** Reads the prompt box for the images its draft names, and tells the band above it when they changed. */
const watchDraft = ($: EngineInterface) => {
  watching?.cancel();
  watching = $.clock.every(DRAFT_EVERY_MS, () => {
    void (async () => {
      try {
        const { text } = await $.prompt.read();
        if (text === typedDraft) return;
        typedDraft = text;
        const found = imagesIn(text);
        if (differs(await read($, draft), found)) await update($, draft, () => found);
      } catch {
        // No prompt box to read: nothing to preview.
      }
    })();
  });
};

/**
 * Runs a reading of the session once the event that asked for it has gone on: git and the usage
 * figures are not worth holding a prompt, a turn's end or a tool's answer for.
 */
const later = ($: EngineInterface, work: () => Promise<unknown>) => {
  $.clock.after(0, () => void work().catch(() => undefined));
};

/**
 * Changes one agent's card. A loop with no card (a compaction, an agent older than those kept) writes nothing,
 * and neither does a change that hands the card back as it was.
 */
const patchAgent = async ($: EngineInterface, id: string, change: (a: Agent) => Agent) => {
  const known = (await read($, agents)).find((a) => a.id === id);
  if (known === undefined || change(known) === known) return;
  await update($, agents, (list) => list.map((a) => (a.id === id ? change(a) : a)));
};

/**
 * Brings the given subagents' effort and context up to date with the last response in each one's
 * transcript, which the session keeps beside its own. A subagent's requests are not all heard
 * (see `turn.step`), and its transcript holds every one.
 */
const measureAgents = async ($: EngineInterface, ids: readonly string[]) => {
  const file = ids.length === 0 ? undefined : await transcriptOf($);
  if (file === undefined) return;
  await Promise.all(
    ids.map(async (id) => {
      const said = lastResponseOf(
        await sh(
          $,
          `grep '"type":"assistant"' "$0" 2>/dev/null | tail -1`,
          `${file.replace(/\.jsonl$/, '')}/subagents/agent-${id}.jsonl`,
        ),
      );
      if (said !== null)
        await patchAgent($, id, (a) =>
          a.effort === said.effort && a.context === said.context ? a : { ...a, ...said },
        );
    }),
  );
};

let measuring: { cancel: () => void } | undefined;

/** Reads the transcripts of the subagents at work, so their figures move while they run. */
const watchAgents = ($: EngineInterface) => {
  measuring?.cancel();
  measuring = $.clock.every(AGENTS_EVERY_MS, () => {
    void (async () => {
      const running = (await read($, agents)).filter((a) => a.status === 'running');
      await measureAgents(
        $,
        running.map((a) => a.id),
      );
    })().catch(() => undefined);
  });
};

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sidebar', description: 'Open the session sidebar' });
    void $.ui.open(OPEN).catch(() => undefined);
    watchDraft($);
    watchAgents($);
    rootdir = await $.session.root().catch(() => e.cwd);
    home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const model = await $.session.model();
    await update($, main, (m) => ({ ...m, model }));
    await refresh($, true);

    return next(e);
  });

  on('command.run', { command: 'sidebar' }, async ($) => {
    const opened = await $.ui.open(OPEN);

    return { text: opened.isPlaced ? 'Sidebar opened.' : `Sidebar is waiting: ${opened.reason}` };
  });

  // A /clear starts a fresh conversation, and a resume another: its counters, its context, its
  // prompts and its subagents start over with it.
  on('session.end', async ($, e, next) => {
    // The process goes on under a new session id, and no session.start fires for it: what was
    // found by the old id (the transcript file, the folder of pasted images) is looked for again.
    if (e.reason === 'clear' || e.reason === 'resume') {
      const now = await $.clock.now();
      await update($, main, (m) => ({ ...MAIN, model: m.model, effort: m.effort, mode: m.mode }));
      await update($, usage, (u) => ({ ...u, startedAt: now, tokens: null, percent: null }));
      await update($, breakdown, (b) => ({ ...b, categories: [] }));
      await update($, agents, () => []);
      await update($, typed, () => []);
      seen.clear();
      shown.clear();
      tiles.clear();
      left = undefined;
      transcript = undefined;
      folder = undefined;
      isOrdered = false;
      await update($, rail, () => RAIL);
    }

    return next(e);
  });

  // The person's prompts as the transcript draws them, for the rail: each row tells its id and its
  // text, and which part of it is on screen. On the terminal the row is the prompt's text alone in
  // a rounded box in the accent's colour, so a prompt stands out from the replies.
  on(
    'ui.render',
    { component: 'UserMessage', props: { origin: { kind: 'composer' } } },
    ($, e, next) => {
      const id = e.requestId;
      const part = e.props.onScreen;
      seen.set(id, e.props.text);
      const was = shown.get(id);
      if (part) shown.set(id, part);
      else if (part === null && was !== undefined) {
        shown.delete(id);
        // Its top still showed and its end did not: it went off the bottom edge.
        left = { id, isBelow: was.first === 0 && was.last < was.of - 1 };
      }
      if (!isDue) {
        isDue = true;
        $.clock.after(0, () => {
          publishing = publishing.then(() => publish($)).catch(() => undefined);
        });
      }
      if (e.surface !== 'terminal') return next(e);
      const { Box, Text } = $.ui.resolve(e);

      return (
        <Box key="prompt-box" borderStyle="round" borderColor={FRAME} paddingX={1} marginTop={1}>
          <Text>{e.props.text}</Text>
        </Box>
      );
    },
  );

  // The band above the prompt: the prompts waiting for the turn that is running, and the images
  // pasted into the draft before it is sent.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e);
    const pasted = await read($, draft);
    const queued = e.props.isWorking ? (await read($, typed)).filter((t) => t.isQueued) : [];
    if (pasted.length === 0 && queued.length === 0) return next(e);
    const els = $.ui.resolve(e);
    const { Box, Text } = els;

    return (
      <Box flexDirection="column" paddingLeft={INSET} rowGap={1}>
        {queued.length === 0 ? null : (
          <Box key="queued" flexDirection="column">
            <Text color={MUTED}>Queued prompts</Text>
            {queued.map((t) => (
              <Text color={MUTED} wrap="truncate-end">{`· ${clean(t.text)}`}</Text>
            ))}
          </Box>
        )}
        {pasted.length === 0 ? null : await strip($, els, pasted)}
      </Box>
    );
  });

  // When a prompt leaves the composer, and whether it has to wait for the turn that is running.
  on('prompt.submit', { origin: { kind: 'composer' } }, async ($, e, next) => {
    const text = e.text.trim();
    const isQueued = e.turnId !== undefined;
    const entry = { text, at: await $.clock.now(), isQueued };
    // A prompt typed while nothing runs finds an empty queue: one still marked as waiting was taken
    // in unseen, or taken back into the box.
    await update($, typed, (list) =>
      [
        ...(isQueued ? list : list.map((t) => (t.isQueued ? { ...t, isQueued: false } : t))),
        entry,
      ].slice(-KEPT_TYPED),
    );
    const entered = await next(e);
    if ('drop' in entered)
      await update($, typed, (list) => list.filter((t) => t.text !== text || t.at !== entry.at));

    return entered;
  });

  // The conversation takes a prompt in, as a turn's first row or handed to the turn that is running:
  // the prompt no longer waits.
  on('session.append', async ($, e, next) => {
    const { message } = e;
    const isPrompt = e.door === 'prompt' && message.type === 'user' && message.isMeta !== true;
    const isHandedIn =
      (message.type === 'attachment' && message.name === 'queued_command') || e.door === 'command';
    if (e.agentId !== undefined || !(isPrompt || isHandedIn)) return next(e);
    const body = message.content
      .map((block) => (typeof block.text === 'string' ? block.text : ''))
      .join('\n')
      .trim();
    const waiting = await read($, typed);
    // The row is the prompt as typed, or wraps it in the engine's framing where it is handed to a
    // running turn. Only a waiting prompt long enough to be told is looked for inside a row: a
    // short one ("ok") is in a great many.
    const match =
      waiting.findLast((t) => t.text === body) ??
      waiting.findLast((t) => t.isQueued && t.text.length >= TOLD_APART && body.includes(t.text));
    if (match !== undefined)
      await update($, typed, (list) =>
        list.map((t) =>
          t.text === match.text && t.at === match.at ? { ...t, isQueued: false } : t,
        ),
      );

    return next(e);
  });

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const mode = e.permission_mode;
    if (mode !== undefined && mode !== (await read($, main)).mode)
      await update($, main, (m) => ({ ...m, mode }));

    return next(e);
  });

  on('session.measure', async ($, e, next) => {
    await update($, usage, (u) => ({ ...u, ...usageOf(e) }));
    // A limit of the account moved a point: the Fable one may have too.
    if (e.changed.includes('rateLimits')) scheduleFable($);

    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    const id = e.agentId;
    if (id === undefined) {
      const now = await $.clock.now();
      await update($, main, (m) => ({ ...m, turnStartedAt: now }));
      later($, () => refresh($));
    } else {
      // A finished agent that was sent a message runs again.
      await patchAgent($, id, (a) =>
        a.status === 'running' ? a : { ...a, status: 'running', endedAt: null },
      );
    }

    return next(e);
  });

  // The main loop's requests: its model and effort, what the prompt cache served and how fast it answers.
  // A subagent's requests are not all heard here (not those of one started while a response of the
  // main loop was still arriving), so the pane takes nothing from them: a subagent's effort and
  // context are read off its transcript (`measureAgents`).
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e);
    const effort = e.effort === undefined ? '' : String(e.effort);
    await update($, main, (m) => ({ ...m, model: e.model, effort }));
    const sentAt = await $.clock.now();
    const result = yield* next(e);
    const u = result.usage;
    if (u !== null) {
      const spent = {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
      };
      const took = (await $.clock.now()) - sentAt;
      await update($, main, (m) => ({
        ...m,
        last: spent,
        total: add(m.total, spent),
        requestMs: m.requestMs + took,
      }));
    }

    return result;
  });

  on('tool.call', async ($, e, next) => {
    const ran = await next(e);
    if (WRITES.has(String(e.tool))) later($, () => refreshChanges($));

    return ran;
  });

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e);
    const id = started.agentId;
    if (started.deny !== undefined || id === undefined) return started;
    const now = await $.clock.now();
    const card = newAgent({
      id,
      title: e.description,
      type: e.name ?? e.subagentType,
      model: started.model,
      now,
    });
    // A resumed agent keeps its card, and so its start on the timeline.
    await update($, agents, (list) =>
      list.some((a) => a.id === id)
        ? list.map((a) => (a.id === id ? { ...a, status: 'running' as const, endedAt: null } : a))
        : [...list, card].slice(-KEPT),
    );

    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId;
    if (id === undefined) {
      await update($, main, (m) => ({ ...m, turnStartedAt: null }));
      later($, () => refresh($, true));
    } else {
      const now = await $.clock.now();
      const status: Status =
        e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed';
      // The run's own account names the model that answered, where it differs from the one it was started on.
      await patchAgent($, id, (a) => ({
        ...a,
        status,
        endedAt: now,
        model: e.usage?.model ?? a.model,
      }));
      // Its last response is in its transcript by now: the figures it ended on.
      later($, () => measureAgents($, [id]));
    }

    return next(e);
  });

  // Under the prompt, in place of Claude Code's own hints, one row: the model with who serves it
  // and the effort, then on the terminal the project's folder with its branch and how full the
  // context window is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const { Text } = $.ui.resolve(e);
    const m = await read($, main);
    // Claude Code's own pill at the row's start names every mode but the default one (as after a
    // shift+tab, before any prompt has reported it): only that one is left for this row to say.
    const now = modeIn(e.props.hint) ?? m.mode;
    const mode = now === 'default' ? modeLabel(now) : '';
    const model = prettyModel(m.model);
    const [here, u] = await Promise.all([read($, local), read($, usage)]);
    const isTold = e.surface === 'terminal' && rootdir !== '' && model !== '';
    const filled =
      u.tokens === null
        ? ''
        : `${fmtTokens(u.tokens)}${u.percent === null ? '' : ` (${fmtPercent(u.percent)})`}`;
    const parts = [
      {
        text: `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`,
        color: FRAME,
        isBold: true,
        lead: ' · ',
      },
      { text: model, color: 'text', isBold: false, lead: ' · ' },
      { text: model === '' ? '' : 'Anthropic', color: MUTED, isBold: false, lead: ' ' },
      { text: m.effort, color: 'warning', isBold: true, lead: ' · ' },
      {
        text: isTold ? `${tilde(rootdir, home)}${here.branch === '' ? '' : `:${here.branch}`}` : '',
        color: MUTED,
        isBold: false,
        lead: ' · ',
      },
      { text: isTold ? filled : '', color: MUTED, isBold: false, lead: ' · ' },
    ].filter((part) => part.text !== '');
    if (parts.length === 0) return next(e);

    return (
      <Text wrap="truncate">
        {parts.map((part, i) => [
          i === 0 ? null : <Text color="subtle">{part.lead}</Text>,
          <Text color={part.color} bold={part.isBold}>
            {part.text}
          </Text>,
        ])}
      </Text>
    );
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e);
    const { Box, Text, Button } = els;
    const [
      m,
      u,
      parts,
      isOpen,
      isRailed,
      isListed,
      here,
      sb,
      list,
      track,
      fableUsed,
      now,
      turns,
      isMcpListed,
      tools,
    ] = await Promise.all([
      read($, main),
      read($, usage),
      read($, breakdown),
      read($, isContextOpen),
      read($, isRailOpen),
      read($, isAgentsOpen),
      read($, local),
      read($, sandbox),
      read($, agents),
      read($, rail),
      read($, fable),
      $.clock.now(),
      $.session.turns().catch(() => 0),
      read($, isMcpOpen),
      $.tool.list().catch(() => []),
    ]);
    // The pane's padding at its sides: the body less those cells each side.
    const W = Math.max(12, e.props.bodyColumns - PAD_X * 2);
    const viewed = e.props.view.agentId;

    // A clock that ticks by itself where the surface runs surface modules, a reading elsewhere.
    const clock = (key: string, since: number, color: string) =>
      'Client' in els ? (
        <els.Client key={key} module="./elapsed.tsx" props={{ since, now, color }} />
      ) : (
        <Text color={color}>{fmtClock(now - since)}</Text>
      );

    const say = (value: string, color = 'text') => (
      <Text color={color} wrap="truncate">
        {value}
      </Text>
    );

    const field = (label: string, value: RenderChildren, labelW: number) => (
      <Box columnGap={1}>
        <Box width={labelW} flexShrink={0}>
          <Text color="inactive">{label}</Text>
        </Box>
        {value}
      </Box>
    );

    // The person's press: an agent's transcript in the main view, or the main conversation back.
    const view = (agentId?: string) => async () => {
      const went = await $.ui.view(agentId === undefined ? {} : { agentId });
      if (went.deny !== undefined) $.ui.toast(`sidebar: ${went.deny}`);
    };

    // A section's header, the same for each: a chip in the accent's colour that opens and closes
    // the section, and beside it what the section has to say of itself. Under the pointer the chip
    // turns gray (HOVER). A hover style is the surface's to apply while the pointer is over the
    // nearest keyed Box, so the chip has one of its own, no wider than it is.
    const header = (
      key: string,
      label: string,
      isOpened: boolean,
      onPress: () => unknown,
      aside: RenderChildren = null,
    ) => (
      <Box justifyContent="space-between">
        <Box key={`${key}-chip`}>
          <Button key={key} plain onPress={onPress}>
            <Text bold backgroundColor="bashBorder" color="inverseText" hover={HOVER}>
              {` ${isOpened ? '▼' : '▶'} ${label} `}
            </Text>
          </Button>
        </Box>
        {aside}
      </Box>
    );

    // ---- where the session works, read as a sentence: `dotfiles on  personal`, and in a linked
    // worktree `dotfiles on  fix-bar · worktree fix-bar`; then the model the session runs on
    const names = [m.effort, m.mode].filter(Boolean).map((name) => ` · ${name}`);
    const title = (
      <Text wrap="truncate">
        <Text bold>{here.project || '—'}</Text>
        {here.branch === '' ? null : <Text color="inactive">{' on '}</Text>}
        {here.branch === '' ? null : (
          <Text color="suggestion">{`${BRANCH_ICON} ${here.branch}`}</Text>
        )}
        {here.worktree === '' ? null : (
          <Text color="inactive">{` · worktree ${here.worktree}`}</Text>
        )}
      </Text>
    );
    const model = (
      <Box justifyContent="space-between" columnGap={1}>
        <Text wrap="truncate">
          <Text bold color="claude">
            {prettyModel(m.model) || 'session'}
          </Text>
          <Text color="inactive">{names.join('')}</Text>
        </Text>
        {m.turnStartedAt === null ? (
          <Text color="inactive">idle</Text>
        ) : (
          <Box columnGap={1} flexShrink={0}>
            <Text color="suggestion">◐</Text>
            {clock('turn', m.turnStartedAt, 'suggestion')}
          </Box>
        )}
      </Box>
    );

    // ---- the context window: how full it is and what fills it, and once opened, each part by name
    const used = parts.categories.reduce((sum, c) => sum + c.tokens, 0);
    // The bar is the whole window: what is used fills its share of it, a colour a category, and the
    // rest is what is left. Before the first response the engine has no fill yet: the categories' own.
    const fill = filled(u.percent ?? (u.window > 0 ? (used / u.window) * 100 : 0), W);
    const cells = segments(
      parts.categories.map((c) => c.tokens),
      fill,
    );
    const compactAt =
      parts.compactAt === null || u.window <= 0
        ? null
        : Math.round((parts.compactAt / u.window) * 100);
    // The figures are the accent's colour until the window fills: orange past 65%, red past 85%.
    const fullness = alarm(u.percent ?? 0) ?? 'bashBorder';
    const toggleContext = async () => {
      // Opened, the breakdown is read again: it is only as fresh as the last turn's end.
      if (await update($, isContextOpen, (open) => !open)) await refreshUsage($, true);
    };
    const context = (
      <Box flexDirection="column">
        {header(
          'context',
          'Context',
          isOpen,
          toggleContext,
          <Text color="inactive">{here.version === '' ? '' : `v${here.version}`}</Text>,
        )}
        {/* Opened, a section keeps a row of space under its header. */}
        <Box justifyContent="space-between" marginTop={isOpen ? 1 : 0}>
          <Text>
            <Text bold color={fullness}>
              {u.percent === null ? '—' : `${u.percent}%`}
            </Text>
            <Text color={fullness}>{compactAt === null ? '' : ` / ${compactAt}%`}</Text>
          </Text>
          <Text
            color={fullness}
          >{`${u.tokens === null ? '—' : fmtTokens(u.tokens)} / ${fmtTokens(u.window)}`}</Text>
        </Box>
        <Text>
          {used > 0 ? (
            parts.categories.map((_, i) => (
              <Text color={categoryColor(i)}>{'█'.repeat(cells[i] ?? 0)}</Text>
            ))
          ) : (
            // Until the window has been broken down, what is used is one part.
            <Text color={fullness}>{'█'.repeat(fill)}</Text>
          )}
          <Text color="subtle">{'░'.repeat(W - fill)}</Text>
        </Text>
        {isOpen && used === 0 ? <Text color="subtle">no breakdown yet</Text> : null}
        {isOpen
          ? parts.categories.map((c, i) => (
              <Box justifyContent="space-between" columnGap={1}>
                <Text color={categoryColor(i)} wrap="truncate">
                  {c.name}
                </Text>
                <Box flexShrink={0}>
                  <Text color="inactive">{`${fmtTokens(c.tokens)} (${Math.round((c.tokens / used) * 100)}%)`}</Text>
                </Box>
              </Box>
            ))
          : null}
      </Box>
    );
    const contextRows = 3 + (isOpen ? 1 + Math.max(1, parts.categories.length) : 0);

    // ---- the grid: two figures a row, the sandbox across both
    const lastHit = m.last === null ? null : hitRate(m.last);
    const averageHit = hitRate(m.total);
    const rate = tokenRate(m.total, m.requestMs);
    const week = u.limits.find((l) => l.kind === 'seven_day');
    const figures: [string, RenderChildren][] = [
      ['Duration', u.startedAt > 0 ? clock('duration', u.startedAt, 'text') : say('—')],
      ['Cost', say(u.costUsd === null ? '—' : fmtUsd(u.costUsd))],
      // The last request's share of input served from the prompt cache, and the share over every request.
      [
        'Cache',
        say(
          lastHit === null
            ? '—'
            : `${lastHit}% hit${averageHit === null ? '' : ` (${averageHit}% avg)`}`,
        ),
      ],
      ['Turns', say(String(turns))],
      [
        'Changes',
        say(here.changes === null ? '—' : `+${here.changes.added},-${here.changes.removed}`),
      ],
      ['t/s', say(rate === null ? '—' : fmtRate(rate))],
      [
        '7d limit',
        week === undefined
          ? say('—')
          : say(
              `${fmtPercent(week.percent)}${week.resetsAt === null ? '' : ` · resets in ${fmtLeft(week.resetsAt - now)}`}`,
              level(week.percent),
            ),
      ],
      ['Fable Limit', fableUsed === null ? say('—') : say(fmtPercent(fableUsed), level(fableUsed))],
    ];
    const isWide = W >= 56;
    const column = (side: 0 | 1, labelW: number) =>
      figures.filter((_, i) => i % 2 === side).map(([label, value]) => field(label, value, labelW));
    const stats = (
      <Box flexDirection="column">
        {isWide ? (
          <Box>
            <Box flexDirection="column" width={W - RIGHT} flexShrink={0}>
              {column(0, LEFT_LABEL)}
            </Box>
            <Box flexDirection="column" width={RIGHT} flexShrink={0}>
              {column(1, RIGHT_LABEL)}
            </Box>
          </Box>
        ) : (
          figures.map(([label, value]) => field(label, value, RIGHT_LABEL))
        )}
        {sb === null
          ? null
          : field(
              'Sandbox',
              sb.isEnabled ? (
                <Text wrap="truncate">
                  <Text color="success">on</Text>
                  {` · bash ${sb.autoAllowBash ? 'auto-allowed' : 'asks'} · escape hatch ${sb.allowUnsandboxed ? 'on' : 'off'}`}
                </Text>
              ) : (
                say('off', 'warning')
              ),
              isWide ? LEFT_LABEL : RIGHT_LABEL,
            )}
      </Box>
    );
    const statsRows =
      (isWide ? Math.ceil(figures.length / 2) : figures.length) + (sb === null ? 0 : 1);

    // ---- the prompts: a rail of the person's own, a press on one scrolling the transcript to it.
    // A thick tick marks the one being read; closed, the rail is that one alone.
    const readAt = track.prompts.findIndex((p) => p.id === track.reading);
    const [from, to] = isRailed
      ? windowOf(track.prompts.length, Math.max(0, readAt), MAX_PROMPTS)
      : [Math.max(0, readAt), readAt + 1];
    const jump = (id: string) => async () => {
      const went = await $.ui.scroll({ to: { requestId: id }, block: 'start' });
      if (went.deny !== undefined) $.ui.toast(`sidebar: ${went.deny}`);
    };
    const promptRow = (p: Prompt) => (
      // A Box of its own, as a header's chip has: where the pointer lights the row (HOVER).
      <Box key={`prompt-${p.id}-row`}>
        <Button key={`prompt-${p.id}`} plain onPress={jump(p.id)}>
          <Text
            color={p.id === track.reading ? 'text' : 'inactive'}
            bold={p.id === track.reading}
            hover={HOVER}
          >
            {`${p.id === track.reading ? '━' : '─'} ${shorten(clean(p.text), Math.max(4, W - 2))}`}
          </Text>
        </Button>
      </Box>
    );
    const earlier = isRailed ? from : 0;
    const later = isRailed ? track.prompts.length - to : 0;
    const prompts = (
      <Box flexDirection="column">
        {header(
          'prompts',
          'Prompts',
          isRailed,
          () => update($, isRailOpen, (open) => !open),
          <Text color="inactive">{String(track.prompts.length)}</Text>,
        )}
        <Box flexDirection="column" marginTop={isRailed ? 1 : 0}>
          {track.prompts.length === 0 ? <Text color="subtle">no prompts yet</Text> : null}
          {earlier > 0 ? <Text color="subtle">{`+${earlier} earlier`}</Text> : null}
          {track.prompts.slice(from, to).map(promptRow)}
          {later > 0 ? <Text color="subtle">{`+${later} later`}</Text> : null}
        </Box>
      </Box>
    );
    const promptRows =
      1 + (isRailed ? 1 : 0) + Math.max(1, to - from) + (earlier > 0 ? 1 : 0) + (later > 0 ? 1 : 0);

    // ---- the MCP servers the session has tools from, and how many of each: the pane's last section,
    // and no section without one.
    const servers = serversOf(tools.map((tool) => tool.name));
    const mcp =
      servers.length === 0 ? null : (
        <Box flexDirection="column">
          {header(
            'mcp',
            'MCP',
            isMcpListed,
            () => update($, isMcpOpen, (open) => !open),
            <Text color="inactive">{String(servers.length)}</Text>,
          )}
          <Box flexDirection="column" marginTop={isMcpListed ? 1 : 0}>
            {(isMcpListed ? servers : []).map((server) => (
              <Box justifyContent="space-between" columnGap={1}>
                <Text wrap="truncate">
                  <Text color="success">{'• '}</Text>
                  {server.name}
                </Text>
                <Text color="inactive">{`${server.tools} ${server.tools === 1 ? 'tool' : 'tools'}`}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      );
    // Its header, the space and a row a server once opened, and the gap that sets it off.
    const mcpRows = servers.length === 0 ? 0 : 1 + (isMcpListed ? 1 + servers.length : 0) + 1;

    // ---- the subagents: how many run, are done and went wrong, and once opened, their timeline:
    // a lane a subagent on one time axis (its glyph, name, run and clock) over its agent type, its
    // model and its effort, with how full its context is at the row's end.
    const counts = tally(list);
    // As many as the room leaves at two rows each, so the timeline is not cut off at the bottom: the
    // padding's two rows, the five gaps between sections, the title, the model, the other sections and
    // this one's own three rows (its header, the space under it and its counts), with one more kept
    // for the count of those left out. At most a lane a digit.
    const room =
      e.props.scroll.bodyRows -
      (2 + 5 + 1 + 1 + contextRows + statsRows + promptRows + mcpRows + 3 + 1);
    const shown = isListed
      ? list.slice(-Math.max(3, Math.min(MAX_LANES, Math.floor(room / 2))))
      : [];
    const labelW = Math.max(7, Math.min(24, Math.floor(W * 0.3)));
    const geometry = lanes(shown, now, Math.max(4, W - labelW - CLOCK - 4));
    const subagents = (
      <Box flexDirection="column">
        {header(
          'subagents',
          'Subagents',
          isListed,
          () => update($, isAgentsOpen, (open) => !open),
          viewed === undefined ? null : (
            <Button key="main" plain hotkey="0" label="main" onPress={view()} />
          ),
        )}
        <Box marginTop={isListed ? 1 : 0}>
          <Text>
            <Text color={TONE.running}>{`● ${counts.run} run`}</Text>
            <Text color="subtle">{' · '}</Text>
            <Text color={TONE.done}>{`✓ ${counts.done} done`}</Text>
            <Text color="subtle">{' · '}</Text>
            <Text color={TONE.failed}>{`✕ ${counts.err} errors`}</Text>
          </Text>
        </Box>
        {isListed && list.length === 0 ? <Text color="subtle">no subagents yet</Text> : null}
        {isListed && list.length > shown.length ? (
          <Text color="subtle">{`+${list.length - shown.length} earlier`}</Text>
        ) : null}
        {shown.map((a, i) => {
          const lane = geometry[i];
          return (
            <Box flexDirection="column">
              <Box columnGap={1}>
                <Text color={TONE[a.status]} bold={viewed === a.id}>
                  {viewed === a.id ? '▶' : GLYPH[a.status]}
                </Text>
                <Box width={labelW} flexShrink={0}>
                  <Button
                    key={`lane-${a.id}`}
                    plain
                    hotkey={String(i + 1)}
                    label={shorten(a.title, labelW - 3)}
                    onPress={view(a.id)}
                  />
                </Box>
                <Box flexShrink={0}>
                  <Text>
                    <Text color="subtle">{'·'.repeat(lane?.before ?? 0)}</Text>
                    <Text color={TONE[a.status]}>{'━'.repeat(lane?.bar ?? 1)}</Text>
                    <Text color="subtle">{'·'.repeat(lane?.after ?? 0)}</Text>
                  </Text>
                </Box>
                <Box width={CLOCK} flexShrink={0} justifyContent="flex-end">
                  {a.endedAt === null ? (
                    clock(`lane-clock-${a.id}`, a.spawnedAt, 'inactive')
                  ) : (
                    <Text color="inactive">{fmtClock(a.endedAt - a.spawnedAt)}</Text>
                  )}
                </Box>
              </Box>
              {/* Under the name, past the glyph and the lane's number. */}
              <Box paddingLeft={5} justifyContent="space-between" columnGap={1}>
                {say(
                  [agentType(a.type), prettyModel(a.model), a.effort].filter(Boolean).join(' · '),
                  'inactive',
                )}
                {a.context === null ? null : (
                  <Box flexShrink={0}>
                    <Text color="inactive">{fmtTokens(a.context)}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    );

    return (
      <Box
        flexDirection="column"
        paddingX={PAD_X}
        paddingY={1}
        rowGap={1}
        width={e.props.bodyColumns}
      >
        {title}
        {model}
        {context}
        {stats}
        {prompts}
        {subagents}
        {mcp}
      </Box>
    );
  });
};
