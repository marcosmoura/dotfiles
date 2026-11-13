import { afterEach, describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildArchive, entryBytes, readArchive } from './archive';
import { readRegistry } from './clients';
import { firstIdOf, readNextId } from './document';
import {
  createLiveEngine,
  createSessionEngine,
  parseRunOutput,
  shortError,
  withoutFirstStep,
  type LiveDependencies,
} from './engine';
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

describe('withoutFirstStep', () => {
  test('hides the branch.open step from the caller', () => {
    expect(
      withoutFirstStep({
        ok: true,
        steps: [
          { command: 'branch.open', result: { index: 1 } },
          { command: 'node.create', result: { id: 4398046511105 } },
        ],
      }),
    ).toEqual({ ok: true, steps: [{ command: 'node.create', result: { id: 4398046511105 } }] });
  });

  test("renumbers a failure in the caller's commands", () => {
    expect(
      withoutFirstStep({
        ok: false,
        error: 'invalid parameters for `node.set`: step 2: unknown properties: nope',
        failedStep: 2,
      }),
    ).toEqual({
      ok: false,
      error: 'invalid parameters for `node.set`: step 1: unknown properties: nope',
      failedStep: 1,
    });
  });

  test('reports a failing branch.open without a step', () => {
    const error = 'invalid parameters for `branch.open`: step 0: no branch `nope`';

    expect(withoutFirstStep({ ok: false, error, failedStep: 0 })).toEqual({
      ok: false,
      error,
      failedStep: null,
    });
  });
});

describe('session engine on a branch copy', () => {
  let directory = '';

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  const copyArchive = (thumbnail: string) =>
    buildArchive('copy', [
      {
        name: 'document.json',
        data: new TextEncoder().encode('{"next_id":5,"nodes":{},"imageIndex":[{"hash":"abc"}]}'),
        method: 'deflate',
      },
      { name: 'images/abc', data: new TextEncoder().encode('png bytes'), method: 'stored' },
      { name: 'thumbnail.png', data: new TextEncoder().encode(thumbnail), method: 'stored' },
    ]);

  /**
   * A stand-in for figcraft-cli: `--version`, `run --out` (the stub) and `mcp`, which records the
   * tool calls. Its save_file leaves the container as it was built.
   */
  async function fakeCli(): Promise<{ bin: string; calls: string }> {
    directory = await mkdtemp(join(tmpdir(), 'figkit-session-'));

    const bin = join(directory, 'fake-cli');
    const calls = join(directory, 'calls.log');
    const archive = JSON.stringify(join(import.meta.dir, 'archive.ts'));

    await Bun.write(
      bin,
      `#!/usr/bin/env bun
import { appendFileSync, writeFileSync } from 'node:fs';
import { buildArchive } from ${archive};
const argv = process.argv.slice(2);
if (argv[0] === '--version') { console.log('figcraft-cli 0.18.1'); process.exit(0); }
if (argv[0] === 'run') {
  const out = argv[argv.indexOf('--out') + 1];
  const data = new TextEncoder().encode('{"next_id":2,"nodes":{},"imageIndex":[]}');
  writeFileSync(out, buildArchive(out, [{ name: 'document.json', data, method: 'deflate' }]));
  process.exit(0);
}
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
    appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ name, path: args.path, command: args.command ?? args.commands?.[0]?.command, id: args.params?.id }) + '\\n');
    if (name === 'run_command' && args.command === 'branch.open') reply(message.id, text({ index: 2 }));
    else if (name === 'run_command') reply(message.id, text([]));
    else if (name === 'batch' && args.commands[0].command === 'boom')
      reply(message.id, { isError: true, content: [{ type: 'text', text: 'step 0 (boom) failed: no such command' }] });
    else if (name === 'batch') reply(message.id, text(args.commands.map((_, index) => ({ id: index + 1 }))));
    else reply(message.id, text({ ok: true }));
  }
}
`,
    );
    await chmod(bin, 0o755);

    return { bin, calls };
  }

  type Call = { name: string; path?: string; command?: string; id?: string };

  const readCalls = async (calls: string): Promise<Call[]> =>
    (await readFile(calls, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Call);

  test('opens the copy as a branch tab, saves the container and writes the copy from it', async () => {
    const { bin, calls } = await fakeCli();
    const file = join(directory, 'copy.figcraft');
    const commonDir = join(directory, 'git');
    const tempDir = join(directory, 'tmp');
    const config = testConfig({ figcraftBin: bin, tempDir });
    const containers = () => readdirSync(tempDir).filter((name) => name.startsWith('container-'));

    await writeFile(file, copyArchive('thumb 1'));

    const engine = createSessionEngine(
      config,
      file,
      () => Bun.spawn([bin, 'mcp'], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' }),
      { branch: 'feat/x', commonDir, mainFile: null },
    );

    try {
      // A read before the first write opens the copy as a plain file and claims nothing.
      expect((await engine.run([{ command: 'node.get' }], { write: false })).ok).toBe(true);
      expect(await readRegistry(commonDir)).toBeNull();

      expect(await engine.run([{ command: 'node.create' }], { write: true })).toEqual({
        ok: true,
        steps: [{ command: 'node.create', result: { id: 1 } }],
      });
      expect(await engine.run([{ command: 'node.create' }], { write: true })).toMatchObject({ ok: true });

      let log = await readCalls(calls);
      const [container] = containers();

      expect(container).toBeDefined();

      const containerPath = join(tempDir, container as string);

      expect(log).toEqual([
        { name: 'open_file', path: file },
        { name: 'batch', command: 'node.get' },
        { name: 'run_command', command: 'doc.list' },
        { name: 'open_file', path: containerPath },
        { name: 'run_command', command: 'branch.open', id: expect.any(String) },
        { name: 'batch', command: 'node.create' },
        { name: 'save_file', path: containerPath },
        { name: 'batch', command: 'node.create' },
        { name: 'save_file', path: containerPath },
      ]);
      expect(container).toContain(log[4]?.id as string);

      const written = await readArchive(file);

      expect(written.entries.map((entry) => entry.name)).toEqual([
        'document.json',
        'images/abc',
        'thumbnail.png',
      ]);
      expect(readNextId(entryBytes(written, 'document.json'))).toBe(firstIdOf(1024));
      expect(new TextDecoder().decode(entryBytes(written, 'thumbnail.png'))).toBe('thumb 1');
      expect((await readRegistry(commonDir))?.owners).toEqual({ '1024': 'feat/x' });

      // A failed batch saves nothing, and the copy stays as it was.
      const before = await readFile(file);

      expect(await engine.run([{ command: 'boom' }], { write: true })).toEqual({
        ok: false,
        error: 'step 0 (boom) failed: no such command',
        failedStep: 0,
      });
      expect(await readFile(file)).toEqual(before);

      // Someone else writes the copy: the session starts again from it, in a new container.
      await Bun.sleep(5);
      await writeFile(file, copyArchive('thumb 2, longer'));
      await engine.run([{ command: 'node.create' }], { write: true });

      log = (await readCalls(calls)).slice(9);

      expect(log.map((entry) => entry.name)).toEqual([
        'batch',
        'open_file',
        'run_command',
        'batch',
        'save_file',
      ]);
      expect(log[1]?.path).not.toBe(containerPath);
      expect(containers()).toHaveLength(1);
      // The copy was replaced by one with a plain counter, so it gets a new range.
      expect((await readRegistry(commonDir))?.owners).toEqual({ '1024': 'feat/x', '1025': 'feat/x' });
    } finally {
      await engine.close();
    }

    expect(containers()).toEqual([]);
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
