// The sidebar: a docked pane with the project, the session's vitals, its context window (a press
// breaks it down by category), a rail of the person's prompts (a press scrolls the transcript to
// one) and its subagents (a press opens their timeline, and a press on a lane opens that subagent's
// transcript); and, under the prompt, the mode, model and effort in place of Claude Code's hint
// row. It only watches: every event hook passes its event on.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register, RenderChildren } from 'claude-code';

import type { Agent, Breakdown, Local, Main, Prompt, Rail, Status, Usage } from '../types';
import type { Left } from './core';
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
  hitRate,
  keptFable,
  lanes,
  level,
  merge,
  modeIn,
  modeLabel,
  newAgent,
  prettyModel,
  railOf,
  sandboxOf,
  segments,
  shorten,
  tally,
  tokenRate,
  usageOf,
  whereOf,
  windowOf,
} from './core';

const PANE = 'sidebar';
const OPEN = { id: PANE, title: 'Sidebar', columns: 64 };
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
/** Tools that can change the working tree: the uncommitted lines are counted again after one ran. */
const WRITES = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash']);

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
const agents = atom({ plugin: 'sidebar', key: 'agents' } as const, [], { shape: 'agents-4' });
const rail = atom({ plugin: 'sidebar', key: 'rail' } as const, RAIL, { shape: 'rail-1' });
const fable = atom({ plugin: 'sidebar', key: 'fable' } as const, null);
const isContextOpen = atom({ plugin: 'sidebar', key: 'isContextOpen' } as const, false);
const isRailOpen = atom({ plugin: 'sidebar', key: 'isRailOpen' } as const, false);
const isAgentsOpen = atom({ plugin: 'sidebar', key: 'isAgentsOpen' } as const, false);

/** Whether a reading moved. One that did not is not written, so nothing is redrawn for it. */
const differs = (known: unknown, next: unknown) => JSON.stringify(known) !== JSON.stringify(next);

// What the transcript says of the person's prompts while it draws them: the ones not yet on the
// rail, the part of each that is on screen, and the last to leave it. A drawing may not write
// state, so the reports are kept here and written to the rail from a timer; a reload starts them
// over, and the transcript says them again as it redraws.
const seen = new Map<string, string>();
const shown = new Map<string, { first: number; last: number; of: number }>();
let left: Left | undefined;
let isDue = false;

const publish = async ($: EngineInterface) => {
  isDue = false;
  const batch = [...seen];
  seen.clear();
  const onScreen = [...shown.keys()];
  const known = await read($, rail);
  if (differs(known, railOf(known, batch, onScreen, left)))
    await update($, rail, (r) => railOf(r, batch, onScreen, left));
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
  $.clock.after(0, () => void refreshFable($));
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

/**
 * Changes one agent's card. A loop with no card (a workflow's agent, a compaction) writes nothing,
 * and neither does a change that hands the card back as it was.
 */
const patchAgent = async ($: EngineInterface, id: string, change: (a: Agent) => Agent) => {
  const known = (await read($, agents)).find((a) => a.id === id);
  if (known === undefined || change(known) === known) return;
  await update($, agents, (list) => list.map((a) => (a.id === id ? change(a) : a)));
};

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sidebar', description: 'Open the session sidebar' });
    void $.ui.open(OPEN);
    const model = await $.session.model();
    await update($, main, (m) => ({ ...m, model }));
    await refresh($, true);

    return next(e);
  });

  on('command.run', { command: 'sidebar' }, async ($) => {
    const opened = await $.ui.open(OPEN);

    return { text: opened.isPlaced ? 'Sidebar opened.' : `Sidebar is waiting: ${opened.reason}` };
  });

  // A /clear starts a fresh conversation: its counters, its context and its subagents start over with it.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      const now = await $.clock.now();
      await update($, main, (m) => ({ ...MAIN, model: m.model, effort: m.effort, mode: m.mode }));
      await update($, usage, (u) => ({ ...u, startedAt: now, tokens: null, percent: null }));
      await update($, breakdown, (b) => ({ ...b, categories: [] }));
      await update($, agents, () => []);
      seen.clear();
      shown.clear();
      left = undefined;
      await update($, rail, () => RAIL);
    }

    return next(e);
  });

  // The person's prompts as the transcript draws them: each row tells its id and its text, and
  // which part of it is on screen. The row itself stays Claude Code's.
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
        $.clock.after(0, () => void publish($));
      }

      return next(e);
    },
  );

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
      await refresh($);
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
  // main loop was still arriving), so the pane takes nothing from them.
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
    if (WRITES.has(String(e.tool))) await refreshChanges($);

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
      await refresh($, true);
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
    }

    return next(e);
  });

  // The row under the prompt: the mode, the model and the effort, in place of Claude Code's own hints.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const { Text } = $.ui.resolve(e);
    const m = await read($, main);
    // Claude Code's line names the mode a shift+tab changed it to; otherwise the last prompt's stands.
    const mode = modeIn(e.props.hint) ?? m.mode;
    const parts = [
      { text: modeLabel(mode), color: 'bashBorder', isBold: false },
      { text: prettyModel(m.model), color: 'text', isBold: false },
      { text: m.effort, color: 'warning', isBold: true },
    ].filter((part) => part.text !== '');
    if (parts.length === 0) return next(e);

    return (
      <Text wrap="truncate">
        {parts.map((part, i) => [
          i === 0 ? null : <Text color="subtle">{' · '}</Text>,
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
    const [m, u, parts, isOpen, isRailed, isListed, here, sb, list, track, fableUsed, now, turns] =
      await Promise.all([
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
        $.session.turns(),
      ]);
    // One cell of padding all around the pane: the body less a column each side.
    const W = Math.max(12, e.props.bodyColumns - 2);
    const viewed = e.props.view.agentId;

    // A clock that ticks by itself where the surface runs surface modules, a reading elsewhere.
    const clock = (key: string, since: number, color: string) =>
      'Client' in els ? (
        <els.Client key={key} module="./elapsed.tsx" props={{ since, now, endAt: null, color }} />
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

    // ---- the subagents: how many run, are done and went wrong, and once opened, their timeline:
    // a lane a subagent on one time axis (its glyph, name, run and clock) over its agent type and model.
    const counts = tally(list);
    // As many as the room leaves at two rows each, so the timeline is not cut off at the bottom: the
    // padding's two rows, the five gaps between sections, the title, the model, the sections above and
    // this one's own three rows (its header, the space under it and its counts), with one more kept
    // for the count of those left out. At most a lane a digit.
    const room =
      e.props.scroll.bodyRows - (2 + 5 + 1 + 1 + contextRows + statsRows + promptRows + 3 + 1);
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
            <Text color={TONE.failed}>{`✕ ${counts.err} err`}</Text>
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
              <Box paddingLeft={5}>
                {say(
                  [agentType(a.type), prettyModel(a.model)].filter(Boolean).join(' · '),
                  'inactive',
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    );

    return (
      <Box flexDirection="column" padding={1} rowGap={1} width={e.props.bodyColumns}>
        {title}
        {model}
        {context}
        {stats}
        {prompts}
        {subagents}
      </Box>
    );
  });
};
