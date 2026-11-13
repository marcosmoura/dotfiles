import type { AgentInfo, On, SessionContextBreakdown } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';

import {
  agentType,
  alarm,
  breakdownOf,
  changesOf,
  columnsOf,
  fableOf,
  fmtClock,
  fmtLeft,
  fmtPercent,
  fmtRate,
  fmtTime,
  fmtTokens,
  hitRate,
  keptFable,
  lanes,
  merge,
  modeIn,
  modeLabel,
  newAgent,
  piecesOf,
  prettyModel,
  railOf,
  sandboxOf,
  segments,
  shorten,
  tally,
  tokenRate,
  whereOf,
  windowOf,
} from '../hooks/core';
import type { Agent, Status } from '../types';

// ---------------------------------------------------------------- pure behaviour

test('figures read as the pane draws them', () => {
  expect(prettyModel('claude-fable-5-2')).toBe('Fable 5.2');
  expect(prettyModel('claude-opus-4-1-20250805')).toBe('Opus 4.1');
  expect(prettyModel('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 1M');
  expect(prettyModel('')).toBe('');
  expect([9, 950, 23_000, 82_400, 200_000, 1_000_000, 1_234_000].map(fmtTokens)).toEqual([
    '9',
    '950',
    '23K',
    '82K',
    '200K',
    '1.0M',
    '1.2M',
  ]);
  expect([18_000, 466_000, 3_729_000].map(fmtClock)).toEqual(['0:18', '7:46', '1:02:09']);
  expect([20_000, 25 * 60_000, 130 * 60_000, 37 * 3_600_000].map(fmtLeft)).toEqual([
    '<1m',
    '25m',
    '2h 10m',
    '1d 13h',
  ]);
  expect([70, 23.5].map(fmtPercent)).toEqual(['70%', '23.5%']);
  expect([103.94, 1234].map(fmtRate)).toEqual(['103.9', '1.2k']);
  expect(shorten('Inventory AX rows', 13)).toBe('Inventory AX…');
});

test('the cache hit rate and the token rate come from the requests the sidebar saw', () => {
  const spent = { input: 100, output: 900, cacheRead: 800, cacheWrite: 100 };
  expect(hitRate(spent)).toBe(80);
  expect(hitRate({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(null);
  // Uncached input and output, over the requests' own time.
  expect(tokenRate(spent, 10_000)).toBe(100);
  expect(tokenRate(spent, 0)).toBe(null);
});

test('the context fill turns orange past 65% and red past 85%', () => {
  expect([0, 65, 66, 85, 86, 100].map(alarm)).toEqual([
    null,
    null,
    'claude',
    'claude',
    'error',
    'error',
  ]);
});

test("a permission mode is read off Claude Code's own hint line, and told in words", () => {
  expect(modeIn('⏸ plan mode on (shift+tab to cycle)')).toBe('plan');
  expect(modeIn('⏵⏵ accept edits on (shift+tab to cycle) · esc to interrupt')).toBe('acceptEdits');
  expect(modeIn('⏵⏵ auto mode on (shift+tab to cycle)')).toBe('auto');
  expect(modeIn('⏵⏵ bypass permissions on (shift+tab to cycle)')).toBe('bypassPermissions');
  expect(modeIn('? for shortcuts')).toBe(undefined);
  expect(['auto', 'acceptEdits', 'bypassPermissions', ''].map(modeLabel)).toEqual([
    'auto',
    'accept edits',
    'bypass permissions',
    '',
  ]);
});

test('a bar is shared out by size and always adds up to its width', () => {
  // A part too small for a cell of its own still shows: it takes one from the widest.
  expect(segments([38, 0.1, 8, 35, 19], 50)).toEqual([18, 1, 4, 17, 10]);
  expect(segments([1, 1, 1], 10)).toEqual([4, 3, 3]);
  // With fewer cells than parts the width holds, and the smallest parts go without.
  expect(segments([5, 4, 3, 2, 1], 2)).toEqual([1, 1, 0, 0, 0]);
  expect(segments([3, 1], 0)).toEqual([0, 0]);
  expect(segments([0, 0], 10)).toEqual([0, 0]);
  expect(segments([], 10)).toEqual([]);
});

const agent = (
  id: string,
  spawnedAt: number,
  endedAt: number | null,
  status: Status = endedAt === null ? 'running' : 'done',
): Agent => ({
  ...newAgent({ id, title: id, type: 'Explore', model: '', now: spawnedAt }),
  status,
  endedAt,
});

test('lanes share one time axis from the first spawn to now', () => {
  expect(lanes([agent('one', 0, 250), agent('two', 500, null)], 1000, 20)).toEqual([
    { before: 0, bar: 5, after: 15 },
    { before: 10, bar: 10, after: 0 },
  ]);
  // A run too short to see still takes a cell, and one that starts now stays on the axis.
  expect(lanes([agent('one', 0, 1), agent('two', 1000, null)], 1000, 10)).toEqual([
    { before: 0, bar: 1, after: 9 },
    { before: 9, bar: 1, after: 0 },
  ]);
  expect(lanes([], 1000, 10)).toEqual([]);
});

test('the subagents are counted by kind, and an agent type is told by its own name', () => {
  const list = [
    agent('a', 1, 5),
    agent('b', 2, null),
    agent('c', 3, 6, 'failed'),
    agent('d', 4, 7),
    agent('e', 5, 8, 'stopped'),
    agent('f', 6, null),
  ];
  expect(tally(list)).toEqual({ run: 2, done: 2, err: 2 });
  expect(['Explore', 'general-purpose', 'feature-dev:code-reviewer'].map(agentType)).toEqual([
    'explore',
    'general-purpose',
    'code-reviewer',
  ]);
});

test('the rail keeps the prompts in the order the transcript drew them, and tells the one being read', () => {
  const drawn = railOf(
    { prompts: [], reading: null },
    [
      ['p1', 'Explain a debounce'],
      ['p2', 'Write one in TypeScript'],
    ],
    [],
    undefined,
  );
  // Before the transcript has said what is on screen: the latest.
  expect(drawn).toEqual({
    prompts: [
      { id: 'p1', text: 'Explain a debounce' },
      { id: 'p2', text: 'Write one in TypeScript' },
    ],
    reading: 'p2',
  });
  // The topmost of those on screen, however the transcript listed them.
  expect(railOf(drawn, [['p3', 'Add a leading edge']], ['p3', 'p2'], undefined).reading).toBe('p2');
  // None on screen: the one that last left, or the one before it when it went off the bottom.
  expect(railOf(drawn, [], [], { id: 'p2', isBelow: false }).reading).toBe('p2');
  expect(railOf(drawn, [], [], { id: 'p2', isBelow: true }).reading).toBe('p1');
  expect(railOf(drawn, [], [], { id: 'p1', isBelow: true }).reading).toBe('p1');
  // A row drawn again is no new prompt, and nothing said keeps what was being read.
  expect(
    railOf({ ...drawn, reading: 'p1' }, [['p1', 'Explain a debounce']], [], undefined),
  ).toEqual({ ...drawn, reading: 'p1' });
});

test('the opened rail is a window of rows around the prompt being read', () => {
  expect(windowOf(20, 10, 8)).toEqual([6, 14]);
  expect(windowOf(20, 0, 8)).toEqual([0, 8]);
  expect(windowOf(20, 19, 8)).toEqual([12, 20]);
  expect(windowOf(5, 2, 8)).toEqual([0, 5]);
  expect(windowOf(0, 0, 8)).toEqual([0, 0]);
});

test('the sandbox is read off the merged settings', () => {
  expect(sandboxOf({ sandbox: { enabled: true } })).toEqual({
    isEnabled: true,
    autoAllowBash: true,
    allowUnsandboxed: true,
  });
  expect(
    sandboxOf({
      sandbox: { enabled: true, autoAllowBashIfSandboxed: false, allowUnsandboxedCommands: false },
    }),
  ).toEqual({
    isEnabled: true,
    autoAllowBash: false,
    allowUnsandboxed: false,
  });
  expect(sandboxOf({}).isEnabled).toBe(false);
});

/** What Anthropic's usage endpoint answers: the account's limits, the weekly ones scoped to a model among them. */
const usageReply = (fable: number) =>
  JSON.stringify({
    five_hour: { utilization: 0 },
    seven_day: { utilization: 71 },
    limits: [
      { kind: 'weekly', percent: 71, resets_at: '2026-11-14T09:00:00Z' },
      {
        kind: 'weekly_scoped',
        scope: { model: { display_name: 'Claude Sonnet' } },
        percent: 3,
        resets_at: null,
      },
      {
        kind: 'weekly_scoped',
        scope: { model: { display_name: 'Claude Fable' } },
        percent: fable,
        resets_at: '2026-11-14T09:00:00Z',
      },
    ],
  });

test("the Fable limit is the weekly one scoped to the Fable models in the usage endpoint's reply", () => {
  expect(fableOf(usageReply(87))).toBe(87);
  expect(
    fableOf(
      JSON.stringify({
        limits: [
          {
            kind: 'weekly_scoped',
            scope: { model: { display_name: 'Claude Sonnet' } },
            percent: 3,
          },
        ],
      }),
    ),
  ).toBe(null);
  expect(fableOf('{}')).toBe(null);
  expect(fableOf('not json')).toBe(null);
  // What the store keeps of the last asking is taken only as the figure and the time it should be.
  expect(keptFable({ percent: 87, at: 5 })).toEqual({ percent: 87, at: 5 });
  expect(keptFable({ percent: null, at: 5 })).toEqual({ percent: null, at: 5 });
  expect([
    keptFable(undefined),
    keptFable({ percent: '87', at: 5 }),
    keptFable({ percent: 87 }),
  ]).toEqual([null, null, null]);
});

test('uncommitted lines add up over the unstaged and the staged diff', () => {
  expect(
    changesOf(
      ' 3 files changed, 92 insertions(+), 72 deletions(-)\n 1 file changed, 1 insertion(+)',
    ),
  ).toEqual({ added: 93, removed: 72 });
  expect(changesOf('\n')).toEqual({ added: 0, removed: 0 });
});

test('the header is told where the session works: the project, its branch, and the worktree when it is in a linked one', () => {
  expect(whereOf('/w/dotfiles\n/w/dotfiles/.git\npersonal', '/w/dotfiles')).toEqual({
    project: 'dotfiles',
    worktree: '',
    branch: 'personal',
  });
  // Started in a folder of the repository: still the repository's name.
  expect(whereOf('/w/dotfiles\n/w/dotfiles/.git\npersonal', '/w/dotfiles/home').project).toBe(
    'dotfiles',
  );
  expect(
    whereOf(
      '/w/dotfiles/.claude/worktrees/fix-bar\n/w/dotfiles/.git\nworktree-fix-bar',
      '/w/dotfiles/.claude/worktrees/fix-bar',
    ),
  ).toEqual({
    project: 'dotfiles',
    worktree: 'fix-bar',
    branch: 'worktree-fix-bar',
  });
  // A detached HEAD is on no branch, and a submodule's git directory is not a worktree's.
  expect(whereOf('/w/dotfiles\n/w/dotfiles/.git\nHEAD', '/w/dotfiles').branch).toBe('');
  expect(whereOf('/w/super/sub\n/w/super/.git/modules/sub\nmain', '/w/super/sub')).toEqual({
    project: 'sub',
    worktree: '',
    branch: 'main',
  });
  expect(whereOf(null, '/tmp/scratch')).toEqual({ project: 'scratch', worktree: '', branch: '' });
});

const category = (
  name: string,
  tokens: number,
  kind: 'used' | 'free' | 'buffer' | 'deferred' = 'used',
) => ({
  name,
  tokens,
  color: 'inactive',
  isDeferred: kind === 'deferred',
  kind,
});

/** A window of 200K, 82K of it used, auto-compaction at 184K. */
const WINDOW: SessionContextBreakdown = {
  categories: [
    category('System prompt', 9_000),
    category('System tools', 18_000),
    category('MCP tools', 0),
    category('MCP tools (deferred)', 30_000, 'deferred'),
    category('Memory files', 2_000),
    category('Messages', 53_000),
    category('Free space', 102_000, 'free'),
    category('Autocompact buffer', 16_000, 'buffer'),
  ],
  totalTokens: 82_000,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  autocompactSource: 'auto',
  percentage: 41,
  gridRows: [],
  model: 'claude-fable-5-2',
  memoryFiles: [],
  mcpTools: [],
  agents: [],
  autoCompactThreshold: 184_000,
  isAutoCompactEnabled: true,
  apiUsage: null,
};

test('the breakdown keeps what fills the window', () => {
  expect(breakdownOf(WINDOW)).toEqual({
    categories: [
      { name: 'System prompt', tokens: 9_000 },
      { name: 'System tools', tokens: 18_000 },
      { name: 'Memory files', tokens: 2_000 },
      { name: 'Messages', tokens: 53_000 },
    ],
    compactAt: 184_000,
  });
  expect(breakdownOf({ ...WINDOW, isAutoCompactEnabled: false }).compactAt).toBe(null);
});

test("the cards follow the engine's own list of agents", () => {
  const info = (id: string, status: AgentInfo['status']): AgentInfo => ({
    id,
    description: `task ${id}`,
    type: 'Explore',
    status,
  });
  const cards = [agent('a1', 10, null)];
  // Nothing to change: the same array, so no state is written.
  expect(merge(cards, [info('a1', 'running')], 50)).toBe(cards);
  // An agent the engine says was killed is closed; a live one never seen spawning gets a card from now.
  const next = merge(
    cards,
    [info('a1', 'killed'), info('a2', 'running'), info('a3', 'completed')],
    50,
  );
  expect(next.map((a) => [a.id, a.status, a.spawnedAt, a.endedAt])).toEqual([
    ['a1', 'stopped', 10, 50],
    ['a2', 'running', 50, null],
  ]);
  expect(next[1]?.title).toBe('task a2');
});

// ---------------------------------------------------------------- drawing

const NOW = 1_800_000_000_000;
/**
 * The bar's coloured parts for the window above, a colour a category: at 41% used they share 26 of
 * the bar's 64 cells, and the other 38 are what is left of the window.
 */
const STACKED = [
  ['merged', 3],
  ['ide', 6],
  ['success', 1],
  ['error', 16],
];

/**
 * The engine beneath the sidebar: a session ten minutes old on Fable in the `dotfiles` repository,
 * 41% of its window used, with uncommitted lines in its working tree.
 */
const engine = (on: On) => {
  const clock = mock.clock(on, { now: NOW });
  const world = {
    isRepo: true,
    revParse: '/work/dotfiles\n/work/dotfiles/.git\npersonal',
    unstaged: ' 3 files changed, 92 insertions(+), 72 deletions(-)',
    staged: ' 1 file changed, 1 insertion(+)',
    hasBreakdown: true,
    root: '/work/dotfiles',
    login: { handle: 'login-1', kind: 'bearer' } as { handle: string; kind: 'bearer' } | null,
    usage: { status: 200, ok: true, headers: {}, text: usageReply(87) },
    asked: [] as unknown[],
    viewed: [] as (string | undefined)[],
  };
  let spawned = 0;
  mock.store(on);
  on('session.authorize', () => ({ value: world.login }));
  on('http.fetch', (_$, e) => (world.asked.push(e), { value: world.usage }));
  on('command.register', (_$, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true as const } }));
  on('ui.view', (_$, e) => (world.viewed.push(e.agentId), { value: {} }));
  on('session.start', (_$, e) => ({ cwd: e.cwd }));
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
  on('session.model', () => ({ value: 'claude-fable-5-2' }));
  on('session.root', () => ({ value: world.root }));
  on('session.version', () => ({ value: { version: '2.1.322' } }));
  on('session.turns', () => ({ value: 12 }));
  on('session.usage', (_$, e) => ({
    value: {
      startedAt: NOW - 600_000,
      context: {
        tokens: 82_000,
        window: 200_000,
        percent: 41,
        ...(e.breakdown !== undefined && world.hasBreakdown ? { breakdown: WINDOW } : {}),
      },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 0 },
        {
          kind: 'seven_day',
          percentUsed: 70,
          resetsAt: new Date(NOW + 37 * 3_600_000).toISOString(),
        },
      ],
      cost: { usd: 12.18 },
    },
  }));
  on('settings.read', () => ({ value: { sandbox: { enabled: true } } }));
  on('process.run', (_$, e) => {
    const args = e.argv.slice(1).join(' ');
    const stdout = args.startsWith('rev-parse')
      ? world.revParse
      : args === 'diff --shortstat'
        ? world.unstaged
        : world.staged;
    return {
      value: {
        exitCode: world.isRepo ? 0 : 128,
        stdout: world.isRepo ? stdout : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  on('agent.list', () => ({ value: [] }));
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `a${++spawned}` }));
  on('turn.start', (_$, e) => ({ turnId: e.turnId }));
  on('turn.complete', () => ({ text: '' }));
  on('tool.call', () => ({ result: {} }));
  on('session.measure', (_$, e) => ({ changed: e.changed }));
  // The model beneath: two seconds a request, 100 fresh tokens in and 50 out, 800 read from the cache.
  on('turn.step', async function* (_$, e) {
    await clock.sleep(2000);
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 800,
      cache_creation_input_tokens: 100,
      model: e.model,
    };
    yield { kind: 'stop' as const, stopReason: 'end_turn' as const, usage };
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage,
    };
  });
  return { clock, world };
};

/** One model request, run to its end on the mocked clock. */
const step = async (
  $: Engine,
  clock: ReturnType<typeof mock.clock>,
  request: { turnId: string; model: string; effort?: 'max'; agentId?: string },
) => {
  const stream = $.turn.step({ index: 0, messageCount: 1, ...request });
  const first = stream.next();
  await clock.advance(2000);
  await first;
  for await (const chunk of stream) void chunk;
  await stream.result;
};

const pane = (bodyColumns: number, agentId?: string, bodyRows = 60) => ({
  plugin: 'sidebar',
  component: 'Pane' as const,
  requestId: 'sidebar',
  props: {
    title: 'Sidebar',
    isFocused: true,
    bodyColumns,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows },
    view: agentId === undefined ? {} : { agentId },
  },
});

let calls = 0;
const spawn = (description: string, subagentType = 'Explore') => ({
  prompt: description,
  description,
  subagentType,
  tool_use_id: `tu${++calls}`,
  provider: { plugin: 'engine', tier: 'core' as const },
  parentModel: 'claude-fable-5-2',
  background: true,
  fork: false,
});

const start = ($: Engine) =>
  $.session.start({ cwd: '/work/dotfiles', surface: 'terminal', isInteractive: true });

test('a fresh session draws the header, the context, the grid and the subagents on every surface and width', async ($, on) => {
  const { clock } = engine(on);
  await start($);
  // The Fable limit is asked for from a timer, off the start itself.
  await clock.settle();
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    for (const cols of [14, 26, 40, 66, 120]) {
      const ui = await $.ui.mount({ ...pane(cols), surface });
      const has = async (text: RegExp) =>
        expect(await ui.find({ type: 'Text', text })).toBeDefined();
      // Where the session works, read as a sentence: the project, then the branch it is on.
      await has(/^dotfiles on \uE0A0 personal$/);
      expect((await ui.find({ type: 'Text', text: /^dotfiles$/ }))?.props.bold).toBe(true);
      expect((await ui.find({ type: 'Text', text: /^\uE0A0 personal$/ }))?.props.color).toBe(
        'suggestion',
      );
      await has(/^Fable 5\.2$/);
      await has(/^ ▶ Context $/);
      await has(/^v2\.1\.322$/);
      await has(/^41% \/ 92%$/);
      await has(/^82K \/ 200K$/);
      await has(/^\$12\.18$/);
      await has(/^12$/);
      await has(/^\+93,-72$/);
      await has(/^70% · resets in 1d 13h$/);
      await has(/^87%$/);
      await has(/^on · bash auto-allowed · escape hatch on$/);
      for (const label of [
        'Duration',
        'Cost',
        'Cache',
        'Turns',
        'Changes',
        't/s',
        '7d limit',
        'Fable Limit',
        'Sandbox',
      ]) {
        expect((await ui.find({ type: 'Text', text: new RegExp(`^${label}$`) }))?.props.color).toBe(
          'inactive',
        );
      }
      // The subagents' section, closed: its header and one line of counts, a colour a kind.
      await has(/^ ▶ Subagents $/);
      for (const [count, color] of [
        ['● 0 run', 'warning'],
        ['✓ 0 done', 'success'],
        ['✕ 0 errors', 'error'],
      ] as const) {
        expect((await ui.find({ type: 'Text', text: new RegExp(`^${count}$`) }))?.props.color).toBe(
          color,
        );
      }
      // What the earlier layouts showed and this one leaves out.
      expect(
        await ui.find({
          type: 'Text',
          text: /requests|read-denied|5h limit|last req|no subagents|running · /,
        }),
      ).toBeUndefined();
      // No prompt drawn yet: the rail says so.
      await has(/^ ▶ Prompts $/);
      await has(/^no prompts yet$/);
      expect((await ui.findAll({ type: 'Button' })).map((button) => button.key)).toEqual([
        'context',
        'prompts',
        'subagents',
      ]);
      await ui.unmount();
    }
  }
});

test('the sections share one header: the same chip, the same hover, the same space under it once opened', async ($, on) => {
  engine(on);
  await start($);
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...pane(66), surface });
    // What each header's button holds: its one chip, as the surface is handed it.
    const chips = async () =>
      Promise.all(['context', 'subagents'].map(async (key) => (await ui.find({ key }))?.children));
    const gaps = async () =>
      Promise.all(
        [/^41% \/ 92%82K \/ 200K$/, /^● 0 run · ✓ 0 done · ✕ 0 errors$/].map(
          async (text) => (await ui.find({ type: 'Box', text }))?.props.marginTop,
        ),
      );
    // At rest a chip in the accent's colour; under the pointer a gray one, its lettering still dark.
    // The hover names its colours the other way round and inverts them, as the surface inverts a label.
    const chip = (text: string) => [
      {
        type: 'Text',
        props: { bold: true, backgroundColor: 'bashBorder', color: 'inverseText' },
        hover: { color: 'inactive', backgroundColor: 'inverseText', inverse: true },
        children: [text],
      },
    ];
    expect(await chips()).toMatchObject([chip(' ▶ Context '), chip(' ▶ Subagents ')]);
    // The surface applies a hover while the pointer is over the nearest keyed Box: each chip sits
    // alone in one, so only the chip itself lights it.
    for (const key of ['context', 'subagents']) {
      expect((await ui.find({ type: 'Box', key: `${key}-chip` }))?.children).toMatchObject([
        { type: 'Button', props: { key } },
      ]);
    }
    expect(await gaps()).toEqual([0, 0]);

    await ui.press({ key: 'context' });
    await ui.press({ key: 'subagents' });
    expect(await chips()).toMatchObject([chip(' ▼ Context '), chip(' ▼ Subagents ')]);
    expect(await gaps()).toEqual([1, 1]);

    await ui.press({ key: 'context' });
    await ui.press({ key: 'subagents' });
    await ui.unmount();
  }
});

test('the whole pane has one cell of padding all around', async ($, on) => {
  engine(on);
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { padding: 1, width: 66 } });
  await ui.unmount();
});

/** The coloured parts of the context bar, as [colour, cells]: the row that holds them matches too, and has no colour. */
const barOf = async (ui: {
  findAll: (query: {
    type: string;
    text: RegExp;
  }) => Promise<{ props: Record<string, unknown>; text: string }[]>;
}) =>
  (await ui.findAll({ type: 'Text', text: /^█+$/ }))
    .filter((part) => part.props.color !== undefined)
    .map((part) => [part.props.color, part.text.length]);

test('the closed context is its header, its figures and the bar by category, with no gap between', async ($, on) => {
  engine(on);
  await start($);
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  // What is used fills its share of the bar; the rest of the window is left empty.
  expect(await barOf(ui)).toEqual(STACKED);
  expect((await ui.find({ type: 'Text', text: /^░+$/ }))?.props.color).toBe('subtle');
  expect((await ui.find({ type: 'Text', text: /^░+$/ }))?.text.length).toBe(38);
  expect(await ui.find({ type: 'Text', text: /^System prompt$/ })).toBeUndefined();
  // The figures sit right under the header.
  expect(await ui.find({ type: 'Box', text: /^41% \/ 92%82K \/ 200K$/ })).toMatchObject({
    props: { marginTop: 0 },
  });
  await ui.unmount();
});

test('the context figures turn orange past 65% and red past 85%', async ($, on) => {
  engine(on);
  await start($);
  const measure = (percent: number) =>
    $.session.measure({
      context: { tokens: percent * 2000, window: 200_000, percent },
      rateLimits: [],
      changed: ['context'],
    });
  for (const [percent, color, cells] of [
    [41, 'bashBorder', 26],
    [65, 'bashBorder', 42],
    [66, 'claude', 42],
    [85, 'claude', 54],
    [86, 'error', 55],
  ] as const) {
    await measure(percent);
    const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
    expect(
      (await ui.find({ type: 'Text', text: new RegExp(`^${percent}%$`) }))?.props,
    ).toMatchObject({ color, bold: true });
    expect((await ui.find({ type: 'Text', text: /^ \/ 92%$/ }))?.props.color).toBe(color);
    expect((await ui.find({ type: 'Text', text: /K \/ 200K$/ }))?.props.color).toBe(color);
    // The bar keeps its categories' colours and grows with the fill: that share of its 64 cells.
    const bar = await barOf(ui);
    expect(bar.map((part) => part[0])).toEqual(STACKED.map((part) => part[0]));
    expect(bar.reduce((sum, part) => sum + Number(part[1]), 0)).toBe(cells);
    expect((await ui.find({ type: 'Text', text: /^░+$/ }))?.text.length).toBe(64 - cells);
    await ui.unmount();
  }
});

test('until the window has been broken down, the bar is how full it is', async ($, on) => {
  const { world } = engine(on);
  world.hasBreakdown = false;
  await start($);
  await $.session.measure({
    context: { tokens: 140_000, window: 200_000, percent: 70 },
    rateLimits: [],
    changed: ['context'],
  });
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await barOf(ui)).toEqual([['claude', 45]]);
  expect((await ui.find({ type: 'Text', text: /^░+$/ }))?.text.length).toBe(19);
  // No reading of where auto-compaction starts either: the percentage stands alone.
  expect(await ui.find({ type: 'Text', text: /^ \/ / })).toBeUndefined();
  await ui.unmount();
});

test('a press on the context header lists the window by category, and another closes it', async ($, on) => {
  engine(on);
  await start($);
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...pane(66), surface });
    await ui.press({ key: 'context' });
    expect(await ui.find({ type: 'Text', text: /^ ▼ Context $/ })).toBeDefined();
    // Opened, a row of space separates the header from the figures.
    expect(await ui.find({ type: 'Box', text: /^41% \/ 92%82K \/ 200K$/ })).toMatchObject({
      props: { marginTop: 1 },
    });
    // The bar is unchanged, and the legend below takes its colours.
    expect(await barOf(ui)).toEqual(STACKED);
    for (const [name, color, figure] of [
      ['System prompt', 'merged', '9K (11%)'],
      ['System tools', 'ide', '18K (22%)'],
      ['Memory files', 'success', '2K (2%)'],
      ['Messages', 'error', '53K (65%)'],
    ] as const) {
      expect((await ui.find({ type: 'Text', text: new RegExp(`^${name}$`) }))?.props.color).toBe(
        color,
      );
      expect((await ui.find({ type: 'Text', text: figure }))?.props.color).toBe('inactive');
    }
    expect(
      await ui.find({ type: 'Text', text: /Free space|Autocompact buffer|deferred/ }),
    ).toBeUndefined();

    await ui.press({ key: 'context' });
    expect(await ui.find({ type: 'Text', text: /^ ▶ Context $/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /^System prompt$/ })).toBeUndefined();
    await ui.unmount();
  }
});

test("the main loop's requests fill the model line, the cache and the token rate", async ($, on) => {
  const { clock } = engine(on);
  on('classic.UserPromptSubmit', () => ({}));
  await start($);
  await $.classic.UserPromptSubmit({ prompt: 'go', permission_mode: 'auto' });
  await $.turn.start({ text: 'go', turnId: 'T1' });
  await step($, clock, { turnId: 'T1', model: 'claude-fable-5-2', effort: 'max' });
  // A subagent's request is none of the main loop's: it moves neither the model line nor the rate.
  await $.agent.spawn(spawn('Look around'));
  await step($, clock, { turnId: 'A1', model: 'claude-sonnet-5-5', agentId: 'a1' });

  const during = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await during.find({ type: 'Text', text: /^Fable 5\.2$/ })).toBeDefined();
  expect(await during.find({ type: 'Text', text: /^ · max · auto$/ })).toBeDefined();
  expect(await during.find({ type: 'Text', text: /^80% hit \(80% avg\)$/ })).toBeDefined();
  // 150 tokens, uncached input and output, over the request's two seconds.
  expect(await during.find({ type: 'Text', text: /^75\.0$/ })).toBeDefined();
  expect(await during.find({ type: 'Text', text: /^idle$/ })).toBeUndefined();
  // The running turn's clock ticks by itself, with no redraw of the pane.
  expect((await during.find({ type: 'Text', in: 'turn' }))?.text).toBe('0:04');
  await during.advance(3000);
  expect((await during.find({ type: 'Text', in: 'turn' }))?.text).toBe('0:07');
  expect((await during.find({ type: 'Text', in: 'duration' }))?.text).toBe('10:07');
  await during.unmount();

  await $.turn.complete({
    answer: 'done',
    durationMs: 2000,
    isAborted: false,
    turnId: 'T1',
    reason: 'answer',
  });
  const after = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await after.find({ type: 'Text', text: /^idle$/ })).toBeDefined();
  await after.unmount();
});

const hintRow = (hint: string) => ({
  plugin: 'sidebar',
  component: 'PromptHint' as const,
  props: { isDraft: false, isWorking: false, hint },
});

test("the row under the prompt is the mode, the model and the effort, in place of Claude Code's hints", async ($, on) => {
  const { clock } = engine(on);
  on('classic.UserPromptSubmit', () => ({}));
  // Beneath the sidebar, Claude Code's own row.
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e);

    return <Text>engine</Text>;
  });

  // Before the session has told its model there is nothing to say: the row stays Claude Code's.
  const untold = await $.ui.mount({ ...hintRow('? for shortcuts'), surface: 'terminal' });
  expect((await untold.find({ type: 'Text' }))?.text).toBe('engine');
  await untold.unmount();

  await start($);
  for (const surface of ['terminal', 'desktop'] as const) {
    // Before the first prompt only the model is known.
    const ui = await $.ui.mount({ ...hintRow('? for shortcuts'), surface });
    expect((await ui.find({ type: 'Text' }))?.text).toBe('Fable 5.2');
    await ui.unmount();
  }

  await $.classic.UserPromptSubmit({ prompt: 'go', permission_mode: 'auto' });
  await step($, clock, { turnId: 'T1', model: 'claude-fable-5-2', effort: 'max' });
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...hintRow('? for shortcuts'), surface });
    expect((await ui.find({ type: 'Text' }))?.text).toBe('auto · Fable 5.2 · max');
    expect((await ui.find({ type: 'Text', text: /^auto$/ }))?.props.color).toBe('bashBorder');
    expect((await ui.find({ type: 'Text', text: /^Fable 5\.2$/ }))?.props.color).toBe('text');
    expect((await ui.find({ type: 'Text', text: /^max$/ }))?.props).toMatchObject({
      color: 'warning',
      bold: true,
    });
    expect(
      (await ui.findAll({ type: 'Text', text: /^ · $/ })).map((dot) => dot.props.color),
    ).toEqual(['subtle', 'subtle']);
    expect(await ui.find({ type: 'Text', text: /shortcuts|engine/ })).toBeUndefined();
    await ui.unmount();
  }

  // A shift+tab changes the mode before any prompt reports it: Claude Code's line names the new one.
  const cycled = await $.ui.mount({
    ...hintRow('⏸ plan mode on (shift+tab to cycle)'),
    surface: 'terminal',
  });
  expect((await cycled.find({ type: 'Text' }))?.text).toBe('plan · Fable 5.2 · max');
  await cycled.unmount();
});

test("the Fable limit is asked of Anthropic with the session's login, by every session together at most every five minutes", async ($, on) => {
  const { clock, world } = engine(on);
  const shown = async () => {
    const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
    const figure = (await ui.find({ type: 'Text', text: /^(\d+(\.\d)?%|—)$/ }))?.text;
    const fable = (await ui.findAll({ type: 'Text', text: /^(\d+(\.\d)?%|—)$/ })).map(
      (text) => text.text,
    );
    await ui.unmount();
    return [figure, fable.at(-1)];
  };
  await start($);
  // Asked from a timer, off the start itself: nothing yet.
  expect(world.asked).toHaveLength(0);
  await clock.settle();
  // One request, to the usage endpoint, carrying the login by its handle and never the login itself.
  expect(world.asked).toEqual([
    {
      url: 'https://api.anthropic.com/api/oauth/usage',
      init: { headers: { 'anthropic-beta': 'oauth-2025-04-20' }, auth: 'login-1' },
    },
  ]);
  expect((await shown())[1]).toBe('87%');

  // A turn a minute later finds the answer fresh: nothing is asked.
  world.usage = { ...world.usage, text: usageReply(91) };
  await clock.advance(60_000);
  await $.turn.start({ text: 'go', turnId: 'T1' });
  await clock.settle();
  expect(world.asked).toHaveLength(1);
  expect((await shown())[1]).toBe('87%');

  // Five minutes after the asking, the next turn asks again.
  await clock.advance(4 * 60_000);
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 'T1',
    reason: 'answer',
  });
  await clock.settle();
  expect(world.asked).toHaveLength(2);
  expect((await shown())[1]).toBe('91%');

  // A refusal keeps the last figure, and waits its five minutes like any asking.
  world.usage = { status: 403, ok: false, headers: {}, text: '' };
  await clock.advance(5 * 60_000);
  await $.turn.start({ text: 'go', turnId: 'T2' });
  await clock.settle();
  expect(world.asked).toHaveLength(3);
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 'T2',
    reason: 'answer',
  });
  await clock.settle();
  expect(world.asked).toHaveLength(3);
  expect((await shown())[1]).toBe('91%');
});

test('with no first-party login there is nothing to ask the Fable limit with', async ($, on) => {
  const { clock, world } = engine(on);
  world.login = null;
  await start($);
  await clock.settle();
  expect(world.asked).toHaveLength(0);
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  // Its cell says so with a dash, beside the 7d limit's figure.
  expect((await ui.find({ type: 'Text', text: /^Fable Limit$/ }))?.props.color).toBe('inactive');
  expect(await ui.find({ type: 'Text', text: /^87%$/ })).toBeUndefined();
  await ui.unmount();
});

test('the uncommitted lines are counted again after a tool that can change the tree', async ($, on) => {
  const { world } = engine(on);
  await start($);
  world.unstaged = ' 4 files changed, 120 insertions(+), 80 deletions(-)';
  await $.tool.call({ tool: 'Read', file_path: '/work/dotfiles/install.sh' });
  const before = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await before.find({ type: 'Text', text: /^\+93,-72$/ })).toBeDefined();
  await before.unmount();

  await $.tool.call({
    tool: 'Edit',
    file_path: '/work/dotfiles/install.sh',
    old_string: 'a',
    new_string: 'b',
  });
  const after = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await after.find({ type: 'Text', text: /^\+121,-80$/ })).toBeDefined();
  await after.unmount();
});

test('outside a repository the pane names the folder, and says what it cannot count with a dash', async ($, on) => {
  const { clock, world } = engine(on);
  world.isRepo = false;
  world.root = '/tmp/scratch';
  await start($);
  await clock.settle();
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  // No repository: the folder's own name, and no branch to be on.
  expect(await ui.find({ type: 'Text', text: /^scratch$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /^ on $/ })).toBeUndefined();
  // The cache, the changes and the token rate have nothing to show.
  expect(await ui.findAll({ type: 'Text', text: /^—$/ })).toHaveLength(3);
  await ui.unmount();
});

test('a session in a linked worktree names the worktree after its branch', async ($, on) => {
  const { world } = engine(on);
  world.revParse =
    '/work/dotfiles/.claude/worktrees/sidebar-test\n/work/dotfiles/.git\nworktree-sidebar-test';
  await start($);
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(
    await ui.find({
      type: 'Text',
      text: /^dotfiles on \uE0A0 worktree-sidebar-test · worktree sidebar-test$/,
    }),
  ).toBeDefined();
  await ui.unmount();
});

type Part = { first: number; last: number; of: number };

/** A row of the transcript as it draws one of the person's prompts; `onScreen` the part the viewport shows. */
const message = (id: string, text: string, onScreen: Part | null) => ({
  plugin: 'sidebar',
  component: 'UserMessage' as const,
  requestId: id,
  props: { text, origin: { kind: 'composer' as const }, isExpanded: false, onScreen },
});

test('the prompts the transcript draws make a rail: a thick tick on the one being read, and a press jumps to one', async ($, on) => {
  const { clock } = engine(on);
  await start($);
  // The transcript draws three prompts, the first scrolled away above the other two.
  const p1 = await $.ui.mount({
    ...message('p1', 'Explain what a debounce function is', null),
    surface: 'terminal',
  });
  const p2 = await $.ui.mount({
    ...message('p2', 'Write a TypeScript\n  implementation', { first: 0, last: 2, of: 3 }),
    surface: 'terminal',
  });
  const p3 = await $.ui.mount({
    ...message('p3', 'Add a leading-edge option', { first: 0, last: 2, of: 3 }),
    surface: 'terminal',
  });
  // On the terminal a prompt is a rounded card labelled on its top border, an empty row either side.
  expect(await p2.find({ type: 'Box', key: 'prompt-card' })).toMatchObject({
    props: { borderStyle: 'round' },
  });
  expect(await p2.find({ type: 'Text', text: /^ you $/ })).toBeDefined();
  // A background task's notification is a user row too, and no prompt.
  const notice = await $.ui.mount({
    plugin: 'sidebar',
    component: 'UserMessage',
    requestId: 'n1',
    surface: 'terminal',
    props: {
      text: 'Agent "Ping 1" finished',
      origin: { kind: 'task-notification' },
      isExpanded: false,
      onScreen: { first: 0, last: 1, of: 2 },
    },
  });
  // A drawing writes nothing: the rail is brought up to date right after it.
  await clock.settle();

  const rowsOf = async (ui: {
    findAll: (query: {
      type: string;
    }) => Promise<{ key: string | undefined; children: unknown[] }[]>;
  }) =>
    (await ui.findAll({ type: 'Button' }))
      .filter((button) => button.key?.startsWith('prompt-'))
      .map((button) => [button.key, button.children]);
  const row = (text: string, isRead: boolean) => [
    {
      type: 'Text',
      props: { color: isRead ? 'text' : 'inactive', bold: isRead },
      hover: { color: 'inactive', backgroundColor: 'inverseText', inverse: true },
      children: [text],
    },
  ];

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...pane(66), surface });
    // Closed: the header with how many there are, and the one being read alone: the topmost on screen.
    expect(await ui.find({ type: 'Text', text: /^ ▶ Prompts $/ })).toBeDefined();
    expect(await rowsOf(ui)).toMatchObject([
      ['prompt-p2', row('━ Write a TypeScript implementation', true)],
    ]);

    await ui.press({ key: 'prompts' });
    expect(await ui.find({ type: 'Text', text: /^ ▼ Prompts $/ })).toBeDefined();
    expect(await rowsOf(ui)).toMatchObject([
      ['prompt-p1', row('─ Explain what a debounce function is', false)],
      ['prompt-p2', row('━ Write a TypeScript implementation', true)],
      ['prompt-p3', row('─ Add a leading-edge option', false)],
    ]);
    // Each row sits alone in a keyed Box, as a header's chip does: where the pointer lights it.
    expect((await ui.find({ type: 'Box', key: 'prompt-p1-row' }))?.children).toMatchObject([
      { type: 'Button', props: { key: 'prompt-p1' } },
    ]);
    await ui.press({ key: 'prompts' });
    await ui.unmount();
  }

  // Scrolling down: the second prompt leaves by the top, and the third is the topmost left on screen.
  await p2.redraw({
    ...message('p2', 'Write a TypeScript\n  implementation', { first: 2, last: 2, of: 3 }).props,
  });
  await p2.redraw({ ...message('p2', 'Write a TypeScript\n  implementation', null).props });
  await clock.settle();
  const reading = async () => {
    const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
    const keys = (await rowsOf(ui)).map(([key]) => key);
    await ui.unmount();
    return keys;
  };
  expect(await reading()).toEqual(['prompt-p3']);
  // Scrolling back up past it: the third leaves by the bottom, and what is read is the one before it.
  await p3.redraw({
    ...message('p3', 'Add a leading-edge option', { first: 0, last: 0, of: 3 }).props,
  });
  await p3.redraw({ ...message('p3', 'Add a leading-edge option', null).props });
  await clock.settle();
  expect(await reading()).toEqual(['prompt-p2']);

  // A press on a row asks the engine to scroll the transcript to that prompt. The kit has no
  // transcript to scroll and says so, which is as far as a test can follow the press.
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  await ui.press({ key: 'prompts' });
  const jumped = await ui.press({ key: 'prompt-p1' }).then(
    () => 'scrolled',
    (error: unknown) => String(error),
  );
  expect(jumped).toContain('no implementation for ui.scroll');
  await ui.unmount();
  for (const drawn of [p1, p2, p3, notice]) await drawn.unmount();
});

test('a long rail draws a window around the prompt being read, and a /clear empties it', async ($, on) => {
  const { clock } = engine(on);
  await start($);
  for (let i = 1; i <= 20; i += 1) {
    await $.ui.mount({
      ...message(`p${i}`, `prompt ${i}`, i === 12 ? { first: 0, last: 1, of: 2 } : null),
      surface: 'terminal',
    });
  }
  await clock.settle();
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  await ui.press({ key: 'prompts' });
  const keys = (await ui.findAll({ type: 'Button' }))
    .map((button) => button.key)
    .filter((key) => key?.startsWith('prompt-'));
  // Eight rows, the one on screen among them, and how many lie either side.
  expect(keys).toEqual([
    'prompt-p8',
    'prompt-p9',
    'prompt-p10',
    'prompt-p11',
    'prompt-p12',
    'prompt-p13',
    'prompt-p14',
    'prompt-p15',
  ]);
  expect(await ui.find({ type: 'Text', text: /^\+7 earlier$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /^\+5 later$/ })).toBeDefined();
  expect((await ui.find({ type: 'Text', text: /^20$/ }))?.props.color).toBe('inactive');
  await ui.unmount();

  await $.session.end({ reason: 'clear', sessionId: 's' } as never);
  const cleared = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await cleared.find({ type: 'Text', text: /^no prompts yet$/ })).toBeDefined();
  expect(await cleared.find({ type: 'Text', text: /^0$/ })).toBeDefined();
  await cleared.unmount();
});

test('the subagents are counted, and once opened, drawn as a timeline with their agent type and model', async ($, on) => {
  const { clock, world } = engine(on);
  await start($);
  await $.agent.spawn(spawn('Inventory AX rows in the tiling config', 'general-purpose'));
  await clock.advance(60_000);
  await $.agent.spawn(spawn('Remove AX rows'));
  await clock.advance(60_000);
  // The run's own account names the model that answered: not the one it was started on.
  const usage = {
    input_tokens: 2,
    output_tokens: 52,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 14_041,
    model: 'claude-opus-5-5',
  };
  await $.turn.complete({
    answer: 'ok',
    durationMs: 120_000,
    isAborted: false,
    turnId: 'A1',
    agentId: 'a1',
    reason: 'answer',
    usage,
  });

  // Closed: the counts alone.
  const closed = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  for (const count of ['● 1 run', '✓ 1 done', '✕ 0 errors'])
    expect(await closed.find({ type: 'Text', text: new RegExp(`^${count}$`) })).toBeDefined();
  expect(await closed.find({ key: 'lane-a1' })).toBeUndefined();
  await closed.press({ key: 'subagents' });
  expect(await closed.find({ type: 'Text', text: /^ ▼ Subagents $/ })).toBeDefined();
  await closed.unmount();

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...pane(66), surface });
    // A lane a subagent, the first spawned at the top, numbered for the keyboard. Its name is cut to
    // its label column: 19 of the body's 64 cells, less the number's three.
    expect((await ui.find({ key: 'lane-a1' }))?.props).toMatchObject({
      hotkey: '1',
      label: 'Inventory AX ro…',
    });
    expect((await ui.find({ key: 'lane-a2' }))?.props).toMatchObject({
      hotkey: '2',
      label: 'Remove AX rows',
    });
    // Its glyph and its run take its kind's colour in the counts above; the run sits on a shared axis
    // of 34 cells, two minutes long: the first ran all of it, the second its last minute.
    expect((await ui.find({ type: 'Text', text: /^✓$/ }))?.props.color).toBe('success');
    expect((await ui.find({ type: 'Text', text: /^◐$/ }))?.props.color).toBe('warning');
    const runs = (await ui.findAll({ type: 'Text', text: /^━+$/ })).filter(
      (run) => run.props.color !== undefined,
    );
    expect(runs.map((run) => [run.props.color, run.text.length])).toEqual([
      ['success', 34],
      ['warning', 17],
    ]);
    expect(await ui.find({ type: 'Text', text: /^2:00$/ })).toBeDefined();
    // Under each name: the agent type and the model.
    expect(
      (await ui.find({ type: 'Text', text: /^general-purpose · Opus 5\.5$/ }))?.props.color,
    ).toBe('inactive');
    expect(await ui.find({ type: 'Text', text: /^explore · Sonnet 5\.5$/ })).toBeDefined();
    expect(await ui.find({ key: 'main' })).toBeUndefined();

    await ui.press({ key: 'lane-a2' });
    await ui.press({ key: 'lane-a1' });
    expect(world.viewed.splice(0)).toEqual(['a2', 'a1']);
    await ui.unmount();
  }

  // The running one's clock ticks by itself.
  const ticking = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect((await ticking.find({ type: 'Text', in: 'lane-clock-a2' }))?.text).toBe('1:00');
  await ticking.unmount();

  // While a subagent's transcript is in view its lane is marked, and one press goes back.
  const ui = await $.ui.mount({ ...pane(66, 'a2'), surface: 'terminal' });
  expect((await ui.find({ type: 'Text', text: /^▶$/ }))?.props).toMatchObject({
    color: 'warning',
    bold: true,
  });
  expect(await ui.find({ type: 'Text', text: /^◐$/ })).toBeUndefined();
  await ui.press({ key: 'main' });
  expect(world.viewed).toEqual([undefined]);
  await ui.unmount();
});

test('a /clear starts the counters, the context and the subagents over', async ($, on) => {
  const { clock } = engine(on);
  await start($);
  await $.agent.spawn(spawn('Look around'));
  await step($, clock, { turnId: 'T1', model: 'claude-fable-5-2' });
  await $.session.end({ reason: 'clear', sessionId: 's' } as never);
  const ui = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  expect(await ui.find({ type: 'Text', text: /^● 0 run$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /^— \/ 200K$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /hit/ })).toBeUndefined();
  expect(await ui.find({ type: 'Text', text: /^Fable 5\.2$/ })).toBeDefined();
  await ui.unmount();
});

test('the opened timeline draws as many lanes as the pane has room for, the latest subagents', async ($, on) => {
  const { clock } = engine(on);
  await start($);
  // Opened with nothing to draw, it says so.
  const empty = await $.ui.mount({ ...pane(66), surface: 'terminal' });
  await empty.press({ key: 'subagents' });
  expect(await empty.find({ type: 'Text', text: /^no subagents yet$/ })).toBeDefined();
  await empty.unmount();

  for (let i = 1; i <= 14; i += 1) {
    await $.agent.spawn(spawn(`task ${i}`));
    await clock.advance(1000);
  }
  const drawnIn = async (bodyRows: number) => {
    const ui = await $.ui.mount({ ...pane(66, undefined, bodyRows), surface: 'terminal' });
    const laneKeys = (await ui.findAll({ type: 'Button' })).filter((button) =>
      button.key?.startsWith('lane-'),
    );
    const earlier = (await ui.find({ type: 'Text', text: /^\+\d+ earlier$/ }))?.text;
    await ui.unmount();
    return [
      laneKeys.length,
      laneKeys[0]?.key,
      laneKeys[0]?.props.hotkey,
      laneKeys.at(-1)?.key,
      laneKeys.at(-1)?.props.hotkey,
      earlier,
    ];
  };
  // The rest of the pane takes 23 rows, and a subagent two. A tall pane draws nine at most, a lane a digit,
  expect(await drawnIn(80)).toEqual([9, 'lane-a6', '1', 'lane-a14', '9', '+5 earlier']);
  // a shorter one what fits,
  expect(await drawnIn(33)).toEqual([5, 'lane-a10', '1', 'lane-a14', '5', '+9 earlier']);
  // and none under three: the pane scrolls.
  expect(await drawnIn(20)).toEqual([3, 'lane-a12', '1', 'lane-a14', '3', '+11 earlier']);
});

test('a reply is split at its tables and its code fences, and a table in a fence is its code', () => {
  const reply = [
    'Two options:',
    '',
    '| Option | Rows |',
    '| :-- | --: |',
    '| **Card** | 2 |',
    '| `bar` \\| rule | 0 |',
    '',
    'Pick one.',
    '```',
    '| a | b |',
    '| - | - |',
    '```',
  ].join('\n');
  expect(piecesOf(reply)).toEqual([
    { kind: 'prose', text: 'Two options:\n' },
    {
      kind: 'table',
      head: ['Option', 'Rows'],
      align: ['left', 'right'],
      rows: [
        ['**Card**', '2'],
        ['`bar` | rule', '0'],
      ],
    },
    { kind: 'prose', text: '\nPick one.' },
    { kind: 'code', language: undefined, source: '| a | b |\n| - | - |' },
  ]);
  // A column is as wide as its widest cell as drawn: the markdown's own marks take no room.
  expect(
    columnsOf(
      ['Option', 'Rows'],
      [
        ['**Card**', '2'],
        ['`bar` | rule', '0'],
      ],
    ),
  ).toEqual([10, 4]);
  // A fence in a list item loses the item's indent, and one still being written runs to the end.
  expect(piecesOf('- step\n  ```ts\n  const a = 1\n    b()\n  ```\ndone\n~~~~sh\nls')).toEqual([
    { kind: 'prose', text: '- step' },
    { kind: 'code', language: 'ts', source: 'const a = 1\n  b()' },
    { kind: 'prose', text: 'done' },
    { kind: 'code', language: 'sh', source: 'ls' },
  ]);
  expect(piecesOf('No table here, a | b')).toEqual([
    { kind: 'prose', text: 'No table here, a | b' },
  ]);
});

test("a reply with a table draws it as a rounded grid between the engine's own prose", async ($, on) => {
  engine(on);
  await start($);
  const ui = await $.ui.mount({
    plugin: 'sidebar',
    component: 'AssistantMessage',
    requestId: 'a1',
    surface: 'terminal',
    props: {
      text: 'Before\n\n| Name | Size |\n| --- | --- |\n| `core.ts` | 306 |\n\nAfter',
      isFirstOfReply: true,
    },
  });
  const grid = await ui.find({ type: 'Box', key: 'table-1' });
  expect(grid?.children).toHaveLength(5);
  expect(await ui.find({ type: 'Text', text: /^╭─{9}$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /^core\.ts$/ })).toBeDefined();
  await ui.unmount();
});

test('a reply with a code fence draws it as a rounded card, its language on the border and its lines numbered', async ($, on) => {
  engine(on);
  await start($);
  const ui = await $.ui.mount({
    plugin: 'sidebar',
    component: 'AssistantMessage',
    requestId: 'a2',
    surface: 'terminal',
    props: { text: 'Run it:\n\n```bash\nclaude plugin test .\n```', isFirstOfReply: true },
  });
  expect(await ui.find({ type: 'Box', key: 'code-1' })).toMatchObject({
    props: { borderStyle: 'round' },
  });
  expect(await ui.find({ type: 'Code' })).toMatchObject({
    props: { source: 'claude plugin test .', language: 'bash' },
  });
  // One line: no numbers. Two: each has its own.
  expect(await ui.find({ type: 'Text', text: /^1$/ })).toBeUndefined();
  await ui.redraw({
    text: 'Run it:\n\n```bash\ncd sidebar\nclaude plugin test .\n```',
    isFirstOfReply: true,
  });
  expect(await ui.find({ type: 'Text', text: /^2$/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /^ bash $/ })).toBeDefined();
  await ui.unmount();
});

test('a prompt typed over a running turn is a gray card until the conversation takes it in, then blue with its time', async ($, on) => {
  engine(on);
  on('prompt.submit', (_, e) => ({ text: e.text }));
  await start($);
  await $.prompt.submit({
    text: 'and run the tests',
    turnId: 't1',
    wait: false,
    origin: { kind: 'composer' },
  });
  const part = { first: 0, last: 2, of: 3 };
  const queued = await $.ui.mount({
    ...message('q1', 'and run the tests', part),
    surface: 'terminal',
  });
  expect(await queued.find({ type: 'Box', key: 'prompt-card' })).toMatchObject({
    props: { borderColor: 'inactive' },
  });
  expect(await queued.find({ type: 'Text', text: ` you - ${fmtTime(NOW)} ` })).toBeDefined();
  await queued.unmount();

  await $.session.append({
    message: { type: 'user', content: [{ type: 'text', text: 'and run the tests' }] },
    door: 'prompt',
    origin: { kind: 'composer' },
    uuid: 'q1',
  });
  const taken = await $.ui.mount({
    ...message('q1', 'and run the tests', part),
    surface: 'terminal',
  });
  expect(await taken.find({ type: 'Box', key: 'prompt-card' })).toMatchObject({
    props: { borderColor: 'ide' },
  });
  expect(await taken.find({ type: 'Text', text: ` you - ${fmtTime(NOW)} ` })).toBeDefined();
  await taken.unmount();
});
