import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createLiveEngine, parseRunOutput, shortError, type LiveDependencies } from './engine';
import { testConfig } from './testing';

describe('parseRunOutput', () => {
  test('collects one step per result line and ignores other output', () => {
    const stdout = [
      '{"command":"node.create","ok":true,"result":{"id":5},"step":0}',
      '{"command":"node.get","ok":true,"result":{"id":5,"name":"A"},"step":1}',
      'wrote /tmp/out.figcraft',
    ].join('\n');

    expect(parseRunOutput(stdout, '', 0)).toEqual({
      ok: true,
      steps: [
        { command: 'node.create', result: { id: 5 } },
        { command: 'node.get', result: { id: 5, name: 'A' } },
      ],
    });
  });

  test('reports the failing step', () => {
    const stdout =
      '{"command":"variable.bind","error":"no such variable","ok":false,"rolledBack":true,"step":4}\n' +
      'error: step 4 (variable.bind) failed: no such variable';

    expect(parseRunOutput(stdout, '', 1)).toEqual({
      ok: false,
      error: 'no such variable',
      failedStep: 4,
    });
  });

  test('falls back to stderr when the process fails without a step', () => {
    expect(parseRunOutput('', 'error: cannot open file\n', 2)).toEqual({
      ok: false,
      error: 'error: cannot open file',
      failedStep: null,
    });
  });

  test('shortens long errors', () => {
    expect(shortError('x'.repeat(5_000)).length).toBeLessThan(3_100);
  });
});

describe('live engine', () => {
  let directory = '';

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  /** A stand-in for `figcraft-cli mcp --attach` that records the tool calls it receives. */
  async function fakeApp(file: string): Promise<{ deps: LiveDependencies; calls: string }> {
    directory = await mkdtemp(join(tmpdir(), 'figkit-live-'));

    const bin = join(directory, 'fake-cli');
    const calls = join(directory, 'calls.log');

    await Bun.write(
      bin,
      `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
let buffer = '';
for await (const chunk of Bun.stdin.stream()) {
  buffer += new TextDecoder().decode(chunk);
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, newline));
    buffer = buffer.slice(newline + 1);
    if (message.id === undefined) continue;
    if (message.method === 'initialize') { reply(message.id, { capabilities: {} }); continue; }
    const { name, arguments: args } = message.params;
    appendFileSync(${JSON.stringify(calls)}, name + '\\n');
    if (name === 'run_command') reply(message.id, text([{ active: true, path: '/other.figcraft' }]));
    else if (name === 'batch' && args.commands[0].command === 'boom')
      reply(message.id, { isError: true, content: [{ type: 'text', text: 'step 0 (boom) failed: no such command' }] });
    else if (name === 'batch') reply(message.id, text(args.commands.map((_, index) => ({ id: index + 1 }))));
    else reply(message.id, text({ ok: true }));
  }
}
`,
    );
    await chmod(bin, 0o755);

    return {
      calls,
      deps: {
        resolvePort: async () => 47_800,
        acquireLock: async () => ({ release: async () => {} }),
        spawn: () => Bun.spawn([bin], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' }),
      },
    };
  }

  test('opens the project file, runs a batch and saves after a write', async () => {
    const { deps, calls } = await fakeApp('/project.figcraft');
    const engine = await createLiveEngine(testConfig(), '/project.figcraft', deps);

    try {
      const result = await engine.run(
        [
          { command: 'node.create', params: {} },
          { command: 'node.set', params: {} },
        ],
        { write: true },
      );

      expect(result).toEqual({
        ok: true,
        steps: [
          { command: 'node.create', result: { id: 1 } },
          { command: 'node.set', result: { id: 2 } },
        ],
      });

      await engine.run([{ command: 'node.get', params: {} }], { write: false });

      expect((await Bun.file(calls).text()).trim().split('\n')).toEqual([
        'run_command',
        'open_file',
        'batch',
        'save_file',
        'batch',
      ]);
    } finally {
      await engine.close();
    }
  });

  test('reports a rejected batch without saving', async () => {
    const { deps, calls } = await fakeApp('/project.figcraft');
    const engine = await createLiveEngine(testConfig(), '/project.figcraft', deps);

    try {
      expect(await engine.run([{ command: 'boom' }], { write: true })).toEqual({
        ok: false,
        error: 'step 0 (boom) failed: no such command',
        failedStep: 0,
      });
      expect(await Bun.file(calls).text()).not.toContain('save_file');
    } finally {
      await engine.close();
    }
  });

  test('refuses to start without a control channel or the lock', async () => {
    const { deps } = await fakeApp('/project.figcraft');

    await expect(
      createLiveEngine(testConfig(), '/p.figcraft', { ...deps, resolvePort: async () => null }),
    ).rejects.toThrow(/no reachable control channel/);
    await expect(
      createLiveEngine(testConfig(), '/p.figcraft', { ...deps, acquireLock: async () => null }),
    ).rejects.toThrow(/already attached/);
  });
});
