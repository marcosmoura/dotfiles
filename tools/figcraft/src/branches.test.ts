import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { entryBytes, findEntry, parseArchive, readArchive, writeArchive } from './archive';
import { readRegistry } from './clients';
import {
  clientOf,
  firstIdOf,
  idNumbers,
  parseDocument,
  readNextId,
  setNextId,
  type FigDocument,
} from './document';
import { loadConfig, resolveBin } from './settings';
import { gitIn } from './testing';

const CLI = join(import.meta.dir, 'cli.ts');
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RED_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const DESIGN = join('design', 'test.figcraft');

let bin = '';

try {
  bin = resolveBin(loadConfig());
} catch {
  // No usable figcraft-cli on this machine: these tests are skipped.
}

const hasCli = bin !== '' && existsSync(bin);

let directory = '';
let repoCount = 0;

beforeAll(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'figkit-branches-')));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

type Repo = { main: string; worktree: string; temp: string; commonDir: string };

/**
 * A repository whose design file holds an image, a component with an instance, a collection with
 * two modes and a saved version, with a linked worktree on `feat/x`.
 */
async function makeRepo(): Promise<Repo> {
  repoCount += 1;

  const base = join(directory, `repo-${repoCount}`);
  const main = join(base, 'main');
  const worktree = join(base, 'wt');
  const temp = join(base, 'tmp');
  const file = join(main, DESIGN);

  gitIn(directory, 'init', '-q', '-b', 'main', main);
  await Bun.write(join(main, '.figkit.json'), JSON.stringify({ file: DESIGN }));
  cli(base, [
    'run',
    '--out',
    file,
    await script(base, 'a', [
      { command: 'node.create', params: { type: 'frame', name: 'Card', width: 200, height: 100 } },
      {
        command: 'variable.createCollection',
        params: { name: 'Tokens', modes: ['Light', 'Dark'] },
      },
      {
        command: 'variable.create',
        params: { collection: 'Tokens', name: 'space', type: 'number', value: 8 },
      },
      {
        command: 'image.place',
        params: { data: PNG, name: 'Photo', x: 300, y: 0, width: 10, height: 10 },
      },
    ]),
  ]);
  cli(base, [
    'run',
    '--in',
    file,
    '--out',
    file,
    await script(base, 'b', [
      { command: 'component.create', params: { ids: [2] } },
      { command: 'instance.create', params: { component: 2, x: 0, y: 300 } },
      { command: 'file.saveVersion', params: { name: 'v1' } },
    ]),
  ]);
  gitIn(main, 'add', '-A');
  gitIn(main, 'commit', '-q', '-m', 'init');
  gitIn(main, 'worktree', 'add', '-q', '-b', 'feat/x', worktree);

  return { main, worktree, temp, commonDir: join(main, '.git') };
}

async function script(base: string, name: string, commands: unknown[]): Promise<string> {
  const path = join(base, `${name}.json`);

  await Bun.write(path, JSON.stringify(commands));

  return path;
}

function cli(cwd: string, args: string[]): void {
  const result = Bun.spawnSync([bin, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });

  if (result.exitCode !== 0) {
    throw new Error(
      `figcraft-cli ${args[0]}: ${result.stdout.toString()} ${result.stderr.toString()}`,
    );
  }
}

function environment(repo: Repo, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'FIGKIT_FILE') {
      env[key] = value;
    }
  }

  return { ...env, TMPDIR: repo.temp, FIGKIT_LOG: '0', ...extra };
}

function figkit(
  repo: Repo,
  cwd: string,
  args: string[],
  extra: Record<string, string> = {},
): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(['bun', CLI, ...args], {
    cwd,
    env: environment(repo, extra),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    code: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function ok(result: { code: number; stdout: string; stderr: string }): string {
  if (result.code !== 0) {
    throw new Error(`figkit failed: ${result.stderr}`);
  }

  return result.stdout;
}

async function documentOf(file: string): Promise<FigDocument> {
  return parseDocument(entryBytes(await readArchive(file), 'document.json'));
}

async function counterOf(file: string): Promise<number> {
  return readNextId(entryBytes(await readArchive(file), 'document.json'));
}

/** Every id of a document with the id ranges of its numbers, by kind. */
function idsOf(document: FigDocument): Map<string, { kind: string; clients: number[] }> {
  const ids = new Map<string, { kind: string; clients: number[] }>();
  const add = (id: string, kind: string, numbers: number[]): void => {
    ids.set(id, { kind, clients: numbers.map(clientOf) });
  };

  for (const key of Object.keys(document.nodes)) {
    add(key, 'layer', [Number(key)]);
  }

  for (const collection of document.variables?.collections ?? []) {
    add(collection.id, 'collection', idNumbers(collection.id));

    for (const mode of collection.modes ?? []) {
      add(mode.id, 'mode', idNumbers(mode.id));
    }
  }

  for (const variable of document.variables?.variables ?? []) {
    add(variable.id, 'variable', idNumbers(variable.id));
  }

  for (const style of document.styles ?? []) {
    add(style.id, 'style', idNumbers(style.id));
  }

  return ids;
}

/** The ids `after` has and `before` lacks, with the highest id range among their numbers. */
function newIds(before: FigDocument, after: FigDocument): { kind: string; client: number }[] {
  const known = idsOf(before);

  return [...idsOf(after)]
    .filter(([id]) => !known.has(id))
    .map(([, { kind, clients }]) => ({ kind, client: Math.max(...clients) }));
}

/** The variable, collection, mode and style ids that a document holds more than once. */
function duplicateIds(document: FigDocument): string[] {
  const ids = [
    ...(document.styles ?? []).map((style) => style.id),
    ...(document.variables?.variables ?? []).map((variable) => variable.id),
    ...(document.variables?.collections ?? []).flatMap((collection) => [
      collection.id,
      ...(collection.modes ?? []).map((mode) => mode.id),
    ]),
  ];

  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

/** One write that makes a layer, a collection, a mode, a variable and a style. */
const everyKind = (suffix: string) =>
  JSON.stringify([
    {
      command: 'node.create',
      params: { type: 'rectangle', name: `R${suffix}`, x: 0, y: 500, width: 10, height: 10 },
      as: 'r',
    },
    { command: 'variable.createCollection', params: { name: `More${suffix}`, modes: ['One'] } },
    { command: 'variable.addMode', params: { collection: 'Tokens', name: `Dim${suffix}` } },
    {
      command: 'variable.create',
      params: { collection: 'Tokens', name: `gap${suffix}`, type: 'number', value: 4 },
    },
    {
      command: 'style.create',
      params: { type: 'paint', name: `Fill${suffix}`, from: { $ref: 'r' } },
    },
  ]);

const KINDS = ['collection', 'layer', 'mode', 'mode', 'style', 'variable'];

describe.skipIf(!hasCli)('branch copies against figcraft-cli', () => {
  test('use reports the main copy in the main checkout and a branch copy in a worktree', async () => {
    const repo = await makeRepo();

    expect(JSON.parse(ok(figkit(repo, repo.main, ['use'])))).toEqual({
      checkout: repo.main,
      file: join(repo.main, DESIGN),
      branch: 'main',
      copy: 'main',
    });
    expect(JSON.parse(ok(figkit(repo, join(repo.worktree, 'design'), ['use'])))).toEqual({
      checkout: repo.worktree,
      file: join(repo.worktree, DESIGN),
      branch: 'feat/x',
      copy: 'branch',
      client: null,
      prepared: false,
    });
  }, 60_000);

  test('use without prepare writes nothing; prepare changes only the counter', async () => {
    const repo = await makeRepo();
    const file = join(repo.worktree, DESIGN);
    const before = await readFile(file);

    ok(figkit(repo, repo.worktree, ['use']));
    expect(await readFile(file)).toEqual(before);
    expect(await readRegistry(repo.commonDir)).toBeNull();

    expect(JSON.parse(ok(figkit(repo, repo.worktree, ['use', '--prepare'])))).toMatchObject({
      client: 1024,
      prepared: true,
    });

    const original = parseArchive('before', new Uint8Array(before));
    const prepared = await readArchive(file);
    const document = entryBytes(prepared, 'document.json');

    expect(prepared.entries.map((entry) => entry.name)).toEqual(
      original.entries.map((entry) => entry.name),
    );
    expect(readNextId(document)).toBe(firstIdOf(1024));
    // Only the counter changed: putting the old one back gives the old bytes.
    expect(setNextId(document, readNextId(entryBytes(original, 'document.json')))).toEqual(
      entryBytes(original, 'document.json'),
    );

    for (const entry of prepared.entries.filter((item) => item.name !== 'document.json')) {
      expect(entry.raw).toEqual(findEntry(original, entry.name)?.raw as Uint8Array);
    }

    // A prepared copy stays as it is.
    const after = await readFile(file);

    ok(figkit(repo, repo.worktree, ['use', '--prepare']));
    expect(await readFile(file)).toEqual(after);
  }, 60_000);

  test('writes to a branch copy get ids in one range per branch', async () => {
    const repo = await makeRepo();
    const file = join(repo.worktree, DESIGN);
    const start = await documentOf(file);

    // The first write claims a range, and every kind of id it makes is in it.
    ok(figkit(repo, repo.worktree, ['run', everyKind('1')]));

    const first = await documentOf(file);
    const added = newIds(start, first);

    expect(added.map((entry) => entry.kind).sort()).toEqual(KINDS);
    expect(added.every((entry) => entry.client === 1024)).toBe(true);
    expect(clientOf(first.next_id)).toBe(1024);

    // The copy is a plain design file with every image.
    const written = await readArchive(file);
    const names = written.entries.map((entry) => entry.name);

    expect(names.some((name) => name.startsWith('branches/') || name.startsWith('versions/'))).toBe(
      false,
    );

    for (const hash of first.imageIndex?.map((image) => image.hash) ?? []) {
      expect(names).toContain(`images/${hash}`);
    }

    expect(first.imageIndex?.length).toBe(1);

    // A second write, in a new process, stays in the range.
    ok(figkit(repo, repo.worktree, ['run', everyKind('2')]));

    const second = await documentOf(file);

    expect(newIds(first, second).every((entry) => entry.client === 1024)).toBe(true);
    expect((await readRegistry(repo.commonDir))?.next).toBe(1025);
    // FigCraft starts a tab's counter after the highest layer id of the range, whatever the
    // document's counter says, so the second write meets numbers the first one gave to other
    // kinds. Within a kind every id stays unique.
    expect(
      newIds(first, second)
        .map((entry) => entry.kind)
        .sort(),
    ).toEqual(KINDS);
    expect(duplicateIds(second)).toEqual([]);

    // A branch made from that branch claims a range of its own.
    gitIn(repo.worktree, 'commit', '-q', '-am', 'design');

    const child = join(repo.main, '..', 'wt-y');

    gitIn(repo.main, 'worktree', 'add', '-q', '-b', 'feat/y', child, 'feat/x');
    ok(figkit(repo, child, ['run', everyKind('3')]));

    const third = await documentOf(join(child, DESIGN));

    expect(newIds(second, third).every((entry) => entry.client === 1025)).toBe(true);

    // A copy Git replaced with main's file claims a new range too.
    gitIn(repo.worktree, 'checkout', 'main', '--', DESIGN);
    ok(figkit(repo, repo.worktree, ['run', everyKind('4')]));

    const fourth = await documentOf(file);

    expect(newIds(start, fourth).every((entry) => entry.client === 1026)).toBe(true);
    expect((await readRegistry(repo.commonDir))?.owners).toEqual({
      '1024': 'feat/x',
      '1025': 'feat/y',
      '1026': 'feat/x',
    });
  }, 120_000);

  test('the main copy is written as before: plain ids, versions kept', async () => {
    const repo = await makeRepo();
    const file = join(repo.main, DESIGN);
    const start = await documentOf(file);

    ok(figkit(repo, repo.main, ['run', everyKind('1')]));

    const added = newIds(start, await documentOf(file));

    expect(added.map((entry) => entry.kind).sort()).toEqual(KINDS);
    expect(added.every((entry) => entry.client === 0)).toBe(true);
    expect(
      (await readArchive(file)).entries.some((entry) => entry.name.startsWith('versions/')),
    ).toBe(true);
    expect(await readRegistry(repo.commonDir)).toBeNull();
  }, 60_000);

  test('a failed write and reads leave the branch copy as it was', async () => {
    const repo = await makeRepo();
    const file = join(repo.worktree, DESIGN);
    const before = await readFile(file);

    const failed = figkit(repo, repo.worktree, [
      'run',
      JSON.stringify([
        { command: 'node.create', params: { type: 'rectangle', name: 'X' } },
        { command: 'node.set', params: { ids: [2], nope: 1 } },
      ]),
    ]);

    expect(failed.code).toBe(1);
    // The caller's numbering: node.set is step 1, not 2.
    expect(failed.stderr).toContain('step 1');
    expect(failed.stderr).not.toContain('step 2');

    ok(
      figkit(repo, repo.worktree, [
        'run',
        JSON.stringify([{ command: 'node.set', params: { ids: [2], name: 'Changed' } }]),
        '--write',
        'false',
      ]),
    );
    ok(figkit(repo, repo.worktree, ['find', 'Card']));
    ok(figkit(repo, repo.worktree, ['read', '2']));

    expect(await readFile(file)).toEqual(before);
    expect(
      (await Array.fromAsync(new Bun.Glob('container-*').scan(join(repo.temp, 'figkit')))).length,
    ).toBe(0);
  }, 60_000);

  test('a detached HEAD refuses writes, and live mode refuses a branch copy', async () => {
    const repo = await makeRepo();
    const file = join(repo.worktree, DESIGN);
    const before = await readFile(file);

    const live = figkit(repo, repo.worktree, ['find', 'Card', '--live'], {
      FIGCRAFT_APP_PATH: join(directory, 'no-app'),
    });

    expect(live.code).toBe(1);
    expect(live.stderr).toContain('live mode works on the main copy only');

    gitIn(repo.worktree, 'checkout', '-q', '--detach');

    const refused = figkit(repo, repo.worktree, ['build', '{"tree":{"frame":"Nope"}}']);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('not on a branch');
    expect(await readFile(file)).toEqual(before);
  }, 60_000);

  test('a session writes a branch copy through one branch tab', async () => {
    const repo = await makeRepo();
    const file = join(repo.worktree, DESIGN);
    const start = await documentOf(file);
    const node = (name: string, y: number) => ({
      command: 'node.create',
      params: { type: 'rectangle', name, x: 0, y, width: 10, height: 10 },
    });
    let afterSecond = '';

    const replies = await session(repo, repo.main, [
      call('use', { checkout: repo.worktree }),
      call('run', { commands: [node('S1', 600)] }),
      call('run', {
        commands: [
          {
            command: 'image.place',
            params: { data: RED_PNG, name: 'Photo 2', x: 400, y: 0, width: 20, height: 20 },
          },
        ],
      }),
      async () => {
        afterSecond = Bun.hash(await readFile(file)).toString();
      },
      call('run', {
        commands: [{ command: 'node.set', params: { ids: [999_999_999], name: 'x' } }],
      }),
      async () => {
        expect(Bun.hash(await readFile(file)).toString()).toBe(afterSecond);
      },
      call('run', { commands: [node('S3', 620)] }),
      // A variable change goes to a one-off run, and the session continues from the copy.
      call('run', {
        commands: [
          {
            command: 'variable.create',
            params: { collection: 'Tokens', name: 'late', type: 'number', value: 1 },
          },
        ],
      }),
      call('run', { commands: [node('S4', 640)] }),
      call('find', { kind: 'variable', name: 'late' }),
    ]);

    expect(replies.map((reply) => reply.isError ?? false)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(replies[7]?.text).toContain('late');

    const end = await documentOf(file);
    const names = Object.values(end.nodes).map((entry) => entry.name);

    expect(names).toEqual(expect.arrayContaining(['S1', 'Photo 2', 'S3', 'S4']));
    expect(end.variables?.variables?.map((variable) => variable.name)).toContain('late');
    expect(newIds(start, end).every((entry) => entry.client === 1024)).toBe(true);
    expect((await readRegistry(repo.commonDir))?.next).toBe(1025);

    const archive = await readArchive(file);
    const entries = archive.entries.map((entry) => entry.name);

    expect(end.imageIndex?.length).toBe(2);

    for (const image of end.imageIndex ?? []) {
      expect(entries).toContain(`images/${image.hash}`);
    }

    expect(
      entries.some((name) => name.startsWith('branches/') || name.startsWith('versions/')),
    ).toBe(false);
    expect(
      (await Array.fromAsync(new Bun.Glob('container-*').scan(join(repo.temp, 'figkit')))).length,
    ).toBe(0);
  }, 180_000);

  test('an MCP session needs use, takes a worktree of the same repository, and switches', async () => {
    const repo = await makeRepo();
    const other = await makeRepo();
    const main = join(repo.main, DESIGN);
    const copy = join(repo.worktree, DESIGN);

    // Tell the two copies apart.
    ok(
      figkit(repo, repo.worktree, [
        'run',
        JSON.stringify([{ command: 'node.set', params: { ids: [2], name: 'Branch card' } }]),
      ]),
    );

    const replies = await session(repo, repo.main, [
      call('find', { name: 'card' }),
      call('use', { checkout: 'relative/path' }),
      call('use', { checkout: other.worktree }),
      call('use', { checkout: repo.worktree }),
      call('find', { name: 'card' }),
      call('use', { checkout: repo.main }),
      call('find', { name: 'card' }),
    ]);

    expect(replies[0]).toEqual({
      isError: true,
      text: 'call use with the absolute path of the checkout you were given',
    });
    expect(replies[1]?.isError).toBe(true);
    expect(replies[2]?.isError).toBe(true);
    expect(replies[2]?.text).toContain('is not a checkout of the repository');
    expect(JSON.parse(replies[3]?.text ?? '')).toMatchObject({ file: copy, copy: 'branch' });
    expect(replies[4]?.text).toContain('Branch card');
    expect(JSON.parse(replies[5]?.text ?? '')).toMatchObject({ file: main, copy: 'main' });
    expect(replies[6]?.text).not.toContain('Branch card');
  }, 120_000);

  test('check guards what a copy may commit', async () => {
    const repo = await makeRepo();
    const copy = join(repo.worktree, DESIGN);
    const check = (cwd: string, extra: Record<string, string> = {}) =>
      figkit(repo, cwd, ['check'], extra);

    // A main copy with a plain counter, a fresh branch copy and one written through figkit pass.
    expect(check(repo.main).code).toBe(0);
    expect(check(repo.worktree).code).toBe(0);
    ok(figkit(repo, repo.worktree, ['run', everyKind('1')]));
    expect(check(repo.worktree)).toMatchObject({ code: 0, stderr: '' });

    // A plain layer id on a branch copy fails.
    gitIn(repo.worktree, 'checkout', '--', DESIGN);
    ok(
      figkit(
        repo,
        repo.worktree,
        [
          'run',
          JSON.stringify([{ command: 'node.create', params: { type: 'rectangle', name: 'Hand' } }]),
        ],
        {
          FIGKIT_FILE: copy,
        },
      ),
    );

    let failed = check(repo.worktree);

    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain('layer rectangle "Hand"');
    expect(failed.stderr).toContain('figkit use --prepare');
    expect(failed.stderr).toContain('counter');

    // A plain variable or style id on a prepared branch copy fails.
    gitIn(repo.worktree, 'checkout', '--', DESIGN);
    ok(figkit(repo, repo.worktree, ['use', '--prepare']));
    ok(
      figkit(
        repo,
        repo.worktree,
        [
          'run',
          JSON.stringify([
            {
              command: 'variable.create',
              params: { collection: 'Tokens', name: 'hand', type: 'number', value: 1 },
            },
            { command: 'style.create', params: { type: 'paint', name: 'Hand', from: 2 } },
          ]),
        ],
        { FIGKIT_FILE: copy },
      ),
    );
    failed = check(repo.worktree);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain('variable "hand"');
    expect(failed.stderr).toContain('style "Hand"');
    expect(failed.stderr).not.toContain('counter');

    // A main copy with a branch's counter fails.
    const mainFile = join(repo.main, DESIGN);
    const archive = await readArchive(mainFile);

    await writeArchive(
      mainFile,
      archive.entries.map((entry) =>
        entry.name === 'document.json'
          ? {
              name: entry.name,
              data: setNextId(entryBytes(archive, entry.name), firstIdOf(1024)),
              method: entry.method,
            }
          : { entry },
      ),
    );
    failed = check(repo.main);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain("the main copy still has a branch's counter");
    gitIn(repo.main, 'checkout', '--', DESIGN);

    // During "git merge main", new plain ids from main are known.
    gitIn(repo.worktree, 'checkout', '--', DESIGN);
    ok(figkit(repo, repo.main, ['run', everyKind('main')]));
    gitIn(repo.main, 'commit', '-q', '-am', 'main design');
    gitIn(repo.worktree, 'merge', '-q', '--no-ff', '--no-commit', 'main');
    expect(existsSync(join(repo.commonDir, 'worktrees', 'wt', 'MERGE_HEAD'))).toBe(true);
    expect(check(repo.worktree)).toMatchObject({ code: 0, stderr: '' });

    // Outside a checkout it fails with the reason.
    const outside = check(directory);

    expect(outside.code).toBe(1);
    expect(outside.stderr).toContain('not inside a git checkout');
  }, 180_000);
});

type Reply = { isError: boolean; text: string };

const call = (name: string, args: unknown) => ({ name, args });

/**
 * Runs `figkit mcp` in `cwd` and makes the calls one at a time; a function in the list runs
 * between two calls.
 */
async function session(
  repo: Repo,
  cwd: string,
  steps: ({ name: string; args: unknown } | (() => Promise<void>))[],
): Promise<Reply[]> {
  const child = Bun.spawn(['bun', CLI, 'mcp'], {
    cwd,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'ignore',
    env: environment(repo),
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const next = async (): Promise<Record<string, unknown>> => {
    for (;;) {
      const newline = buffer.indexOf('\n');

      if (newline >= 0) {
        const line = buffer.slice(0, newline);

        buffer = buffer.slice(newline + 1);

        return JSON.parse(line) as Record<string, unknown>;
      }

      const { value, done } = await reader.read();

      if (done) {
        throw new Error('the server closed');
      }

      buffer += decoder.decode(value, { stream: true });
    }
  };
  const replies: Reply[] = [];
  let id = 0;

  for (const step of steps) {
    if (typeof step === 'function') {
      await step();
      continue;
    }

    id += 1;
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: step.name, arguments: step.args } })}\n`,
    );
    child.stdin.flush();

    const reply = (await next()) as {
      result?: { isError?: boolean; content?: { text: string }[] };
    };

    replies.push({
      isError: reply.result?.isError ?? false,
      text: (reply.result?.content ?? []).map((part) => part.text).join('\n'),
    });
  }

  child.stdin.end();
  await child.exited;

  return replies;
}
