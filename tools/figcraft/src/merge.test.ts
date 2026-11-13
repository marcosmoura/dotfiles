import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { entryBytes, readArchive } from './archive';
import { clientOf, parseDocument, readNextId, type FigDocument } from './document';
import {
  checkResolutions,
  checkState,
  conflictLines,
  cut,
  fastPath,
  merge,
  MergeError,
  parseMergeArgs,
  readInputs,
  runErrorMessage,
  sameIdConflicts,
  sideSummary,
  type Conflict,
  type MergeDeps,
  type Review,
} from './merge';
import { mergingCommit, receiptReason, RECEIPT_NAME } from './check';
import { parseRunOutput, type Command, type RunResult } from './engine';
import type { Report } from './merge-report';
import { gitBytes, resolveProject, type Project } from './project';
import { cliVersion, loadConfig, resolveBin } from './settings';
import { gitIn } from './testing';

const CLI = join(import.meta.dir, 'cli.ts');
const DESIGN = join('design', 'test.figcraft');
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------------------------
// Unit: fake Git answers and a recorded review.
// ---------------------------------------------------------------------------------------------

const ROOT = '/repo';

function project(overrides: Partial<Project> = {}): Project {
  return {
    root: ROOT,
    file: join(ROOT, DESIGN),
    writeBlocked: null,
    copy: 'main',
    branch: 'main',
    mainBranch: 'main',
    commonDir: join(ROOT, '.git'),
    mainFile: join(ROOT, DESIGN),
    ...overrides,
  };
}

/** Git that answers from a table of `args.join(' ')`; anything else fails. */
function fakeGit(answers: Record<string, string>): MergeDeps['git'] {
  return (args) => {
    const answer = answers[args.join(' ')];

    return answer === undefined ? null : new TextEncoder().encode(answer);
  };
}

const COMMITS = {
  'rev-parse -q --verify HEAD^{commit}': 'aaaaaaaa',
  'rev-parse -q --verify feat/x^{commit}': 'bbbbbbbb',
  'rev-parse -q --verify main^{commit}': 'cccccccc',
  'merge-base aaaaaaaa bbbbbbbb': 'ffffffff',
  'merge-base aaaaaaaa cccccccc': 'ffffffff',
  [`rev-parse -q --verify ffffffff:${DESIGN}`]: 'base-blob',
  [`rev-parse -q --verify aaaaaaaa:${DESIGN}`]: 'ours-blob',
  [`rev-parse -q --verify bbbbbbbb:${DESIGN}`]: 'theirs-blob',
  [`rev-parse -q --verify cccccccc:${DESIGN}`]: 'theirs-blob',
};

const REVIEW: Review = {
  branch: {
    layers: [
      { change: 'added', id: 4398046511105, type: 'rectangle', name: 'R' },
      { change: 'changed', id: 3, type: 'text', name: 'Title' },
    ],
    document: [{ change: 'added', what: 'Variable “gap”' }],
    truncated: false,
  },
  main: {
    layers: [{ change: 'removed', id: 5, type: 'rectangle', name: 'Swatch' }],
    document: [],
    truncated: true,
  },
  conflicts: [
    {
      branch: 'text “theirs note”',
      id: 4,
      key: '4/kind',
      main: 'text “ours note”',
      name: 'Note',
      property: 'kind',
    },
    {
      branch: 'edited',
      deletedBy: 'main',
      id: 5,
      key: '5/layer',
      main: 'deleted',
      name: 'Swatch',
      property: 'layer',
    },
  ],
};

describe('merge decisions', () => {
  test('parses its arguments', () => {
    expect(parseMergeArgs(['feat/x'])).toEqual({ ref: 'feat/x', review: false, resolve: null });
    expect(parseMergeArgs(['main', '--review', '--resolve', '{"4/kind":"main"}'])).toEqual({
      ref: 'main',
      review: true,
      resolve: { '4/kind': 'main' },
    });
    expect(() => parseMergeArgs([])).toThrow('usage');
    expect(() => parseMergeArgs(['main', '--resolve', '[1]'])).toThrow('JSON object');
    expect(() => parseMergeArgs(['main', '--resolve', '{'])).toThrow('not valid JSON');
    expect(() => parseMergeArgs(['main', 'other'])).toThrow('unexpected argument');
  });

  test('the direction: into main on the main branch, from main elsewhere', () => {
    const into = readInputs(project(), 'feat/x', { git: fakeGit(COMMITS) });

    expect(into).toMatchObject({
      direction: 'into-main',
      path: DESIGN,
      blobs: { base: 'base-blob', ours: 'ours-blob', theirs: 'theirs-blob' },
    });

    const from = readInputs(project({ branch: 'feat/x', copy: 'branch' }), 'main', {
      git: fakeGit({ ...COMMITS, 'merge-base --is-ancestor cccccccc main': '' }),
    });

    expect(from.direction).toBe('from-main');
  });

  test('refusals from Git answers', () => {
    const refuse = (p: Project, ref: string, answers: Record<string, string>): MergeError => {
      try {
        readInputs(p, ref, { git: fakeGit(answers) });
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
        expect((error as MergeError).code).toBe(2);

        return error as MergeError;
      }

      throw new Error('not refused');
    };

    expect(refuse(project({ branch: null }), 'main', COMMITS).message).toContain('detached HEAD');
    // Another design branch is not an ancestor of main.
    expect(refuse(project({ branch: 'feat/y', copy: 'branch' }), 'feat/x', COMMITS).message).toBe(
      'a design branch merges only with main',
    );
    expect(refuse(project(), 'nope', COMMITS).message).toContain('"nope" is not a commit');

    const { 'merge-base aaaaaaaa bbbbbbbb': _, ...noBase } = COMMITS;

    expect(refuse(project(), 'feat/x', noBase).message).toContain('no merge base');

    for (const [key, label] of [
      [`rev-parse -q --verify ffffffff:${DESIGN}`, 'the merge base'],
      [`rev-parse -q --verify aaaaaaaa:${DESIGN}`, 'HEAD'],
      [`rev-parse -q --verify bbbbbbbb:${DESIGN}`, 'feat/x'],
    ] as const) {
      const { [key]: _missing, ...rest } = COMMITS;

      expect(refuse(project(), 'feat/x', rest).message).toContain(`missing in ${label}`);
    }
  });

  test('the fast paths from blob ids', () => {
    const blobs = (base: string, ours: string, theirs: string) => ({ base, ours, theirs });

    expect(fastPath({ direction: 'into-main', blobs: blobs('a', 'b', 'a') })).toBe('nothing');
    expect(fastPath({ direction: 'from-main', blobs: blobs('a', 'b', 'b') })).toBe('nothing');
    expect(fastPath({ direction: 'into-main', blobs: blobs('a', 'a', 'c') })).toBe('theirs-only');
    expect(fastPath({ direction: 'from-main', blobs: blobs('a', 'a', 'c') })).toBe('already-main');
    expect(fastPath({ direction: 'into-main', blobs: blobs('a', 'b', 'c') })).toBeNull();
  });

  test('the state guard', async () => {
    const gitDir = await mkdtemp(join(tmpdir(), 'figkit-guard-'));

    try {
      const inputs = readInputs(project(), 'feat/x', { git: fakeGit(COMMITS) });
      const guard = (answers: Record<string, string>, both = true): string | null => {
        try {
          checkState(
            project(),
            both ? inputs : { ...inputs, blobs: { ...inputs.blobs, ours: 'base-blob' } },
            'feat/x',
            { git: fakeGit({ 'rev-parse --absolute-git-dir': gitDir, ...answers }) },
          );

          return null;
        } catch (error) {
          return (error as Error).message;
        }
      };
      const hash = `hash-object -- ${join(ROOT, DESIGN)}`;
      const notRun = 'run "git merge feat/x" first';
      const dirty = 'the design file has changes that are not committed';

      // No merge in progress.
      expect(guard({ [hash]: 'ours-blob' })).toBe(notRun);
      // git merge feat/x: MERGE_HEAD names its commit, staged or not.
      await writeFile(join(gitDir, 'MERGE_HEAD'), 'bbbbbbbb\n');
      expect(guard({ [hash]: 'ours-blob' })).toBeNull();
      expect(guard({ [hash]: 'other' })).toBe(dirty);
      // A merge with another ref in progress.
      await writeFile(join(gitDir, 'MERGE_HEAD'), 'dddddddd\n');
      expect(guard({ [hash]: 'ours-blob' })).toBe(notRun);
      // git merge --squash feat/x: only SQUASH_MSG.
      await rm(join(gitDir, 'MERGE_HEAD'));
      await writeFile(
        join(gitDir, 'SQUASH_MSG'),
        'Squashed commit of the following:\n\ncommit bbbbbbbb\n',
      );
      expect(guard({ [hash]: 'ours-blob' })).toBeNull();
      // Only the other side changed: unchanged rule.
      expect(guard({ [hash]: 'theirs-blob' }, false)).toBeNull();
      expect(guard({ [hash]: 'base-blob' }, false)).toBe(notRun);
      expect(guard({ [hash]: 'other' }, false)).toBe(dirty);
    } finally {
      await rm(gitDir, { recursive: true, force: true });
    }
  });

  test('the conflict table and the resolve checks', () => {
    const conflicts = REVIEW.conflicts as Conflict[];
    const lines = conflictLines(conflicts, 'feat/x', null);

    expect(lines[0]).toBe('conflicts: 2');
    expect(lines).toContain('  4/kind layer 4 "Note" kind');
    expect(lines).toContain('    branch: text “theirs note”');
    expect(lines).toContain('    main:   text “ours note”');
    expect(lines.at(-1)).toContain(
      `figkit merge feat/x --resolve '{"4/kind":"branch","5/layer":"branch"}'`,
    );
    expect(conflictLines(conflicts, 'feat/x', { '4/kind': 'main' })).toContain(
      '    resolved: main',
    );
    expect(sideSummary('branch', REVIEW.branch)).toBe(
      'branch: layers 1 added, 1 changed, 0 removed; variables and styles 1 added, 0 changed, 0 removed',
    );
    expect(sideSummary('main', REVIEW.main)).toContain('(at least: the list was cut)');
    expect(cut('x'.repeat(100), 80)).toHaveLength(80);

    const code = (resolve: Record<string, unknown> | null): number | 'ok' => {
      try {
        checkResolutions(conflicts, resolve);

        return 'ok';
      } catch (error) {
        return (error as MergeError).code;
      }
    };

    expect(code({ '4/kind': 'branch', '5/layer': 'main' })).toBe('ok');
    expect(code(null)).toBe(1);
    expect(code({ '4/kind': 'branch' })).toBe(1);
    expect(code({ '4/kind': 'branch', '5/layer': 'main', '9/kind': 'main' })).toBe(2);
    expect(code({ '4/kind': 'theirs', '5/layer': 'main' })).toBe(2);
    expect(checkResolutions([], null)).toEqual({});

    expect(
      sameIdConflicts([
        {
          branch: 'added',
          key: 'variable/VariableID:2',
          main: 'added',
          name: 'v-two',
          property: 'variable',
        },
        { branch: 'added', key: 'style/S:3', main: 'added', name: 'StyleTwo', property: 'style' },
        ...conflicts,
      ]).map((conflict) => conflict.key),
    ).toEqual(['variable/VariableID:2', 'style/S:3']);
  });

  test("FigCraft's errors become messages", () => {
    expect(runErrorMessage("step 0: can't merge: node 12 already exists")).toContain(
      'squash-merged into main before',
    );
    expect(runErrorMessage("step 0: can't merge: node 12 already exists")).toContain(
      'not written through figkit',
    );
    expect(runErrorMessage('something else')).toBe('figcraft-cli could not merge: something else');
  });

  test('exit codes and an old figcraft-cli, without starting FigCraft', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'figkit-merge-unit-'));
    const errors: string[] = [];
    const runs: unknown[] = [];
    const deps = (answers: Record<string, string>, version = '0.18.1'): MergeDeps => ({
      git: fakeGit(answers),
      cliVersion: () => version,
      run: async (...args) => {
        runs.push(args);

        return { ok: false, error: 'not here', failedStep: null };
      },
      info: async () => null,
      tempDir: temp,
      print: () => {},
      printError: (line) => errors.push(line),
    });

    try {
      const options = { ref: 'feat/x', review: false, resolve: null };

      expect(await merge(project({ branch: null }), options, deps(COMMITS))).toBe(2);
      expect(
        await merge(
          project(),
          options,
          deps({ ...COMMITS, [`rev-parse -q --verify bbbbbbbb:${DESIGN}`]: 'base-blob' }),
        ),
      ).toBe(0);
      expect(await merge(project(), options, deps(COMMITS, '0.16.0'))).toBe(2);
      expect(errors.at(-1)).toContain('figcraft-cli 0.17.0 or newer');
      expect(runs).toEqual([]);
      expect(readdirSync(temp)).toEqual([]);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});

describe('merge receipt detection', () => {
  test('the other commit from MERGE_HEAD or a SQUASH_MSG text', () => {
    const id = 'a'.repeat(40);

    expect(mergingCommit(`${id}\n`, null)).toBe(id);
    expect(
      mergingCommit(
        null,
        `Squashed commit of the following:\n\ncommit ${id}\nAuthor: A <a@b>\n\ncommit ${'b'.repeat(40)}\n`,
      ),
    ).toBe(id);
    expect(mergingCommit(`${id}\n`, `commit ${'b'.repeat(40)}\n`)).toBe(id);
    expect(mergingCommit(null, 'no commit line')).toBeNull();
    expect(mergingCommit(null, null)).toBeNull();
  });

  test('a receipt must name the other commit and the working blob', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'figkit-receipt-')));

    try {
      const path = 'f.txt';
      const file = join(root, path);

      gitIn(tmpdir(), 'init', '-q', '-b', 'main', root);
      await writeFile(file, 'base\n');
      gitIn(root, 'add', '-A');
      gitIn(root, 'commit', '-q', '-m', 'base');
      gitIn(root, 'checkout', '-q', '-b', 'side');
      await writeFile(file, 'side\n');
      gitIn(root, 'commit', '-q', '-am', 'side');
      const side = gitIn(root, 'rev-parse', 'HEAD');
      gitIn(root, 'checkout', '-q', 'main');
      await writeFile(file, 'main\n');
      gitIn(root, 'commit', '-q', '-am', 'main');
      const gitDir = join(root, '.git');
      const reason = () => receiptReason(root, gitDir, path, file, side, null);

      expect(reason()).toBe(
        `both sides changed ${path}: run "figkit merge ${side.slice(0, 7)}" and stage the file it writes before committing this merge`,
      );

      await writeFile(file, 'merged\n');
      const blob = gitIn(root, 'hash-object', '--', file);

      await writeFile(join(gitDir, RECEIPT_NAME), JSON.stringify({ theirs: 'c'.repeat(40), blob }));
      expect(reason()).not.toBeNull();
      await writeFile(join(gitDir, RECEIPT_NAME), JSON.stringify({ theirs: side, blob }));
      expect(reason()).toBeNull();
      expect(receiptReason(root, gitDir, path, file, side, 'main')).toBeNull();
      await writeFile(file, 'changed after\n');
      expect(receiptReason(root, gitDir, path, file, side, 'main')).toContain('figkit merge main');
      // Only one side changed: no receipt needed.
      expect(
        receiptReason(root, gitDir, path, file, gitIn(root, 'rev-parse', 'HEAD~1'), null),
      ).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// End to end against figcraft-cli.
// ---------------------------------------------------------------------------------------------

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
  directory = await realpath(await mkdtemp(join(tmpdir(), 'figkit-merge-')));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

type Repo = {
  base: string;
  main: string;
  worktree: string;
  temp: string;
  /** figcraft-cli behind a wrapper that logs each call's arguments. */
  wrapper: string;
  log: string;
  ids: Record<string, number>;
};

type Result = { code: number; stdout: string; stderr: string };

/**
 * A repository whose design file has a card with texts and a swatch, a variable, a text style and
 * two components (Badge with an instance, Chip without), with a linked worktree on `feat/x`.
 */
async function makeRepo(): Promise<Repo> {
  repoCount += 1;

  const base = join(directory, `repo-${repoCount}`);
  const main = join(base, 'main');
  const worktree = join(base, 'wt');
  const temp = join(base, 'tmp');
  const wrapper = join(base, 'figcraft-cli');
  const log = join(base, 'cli.log');
  const file = join(main, DESIGN);

  gitIn(directory, 'init', '-q', '-b', 'main', main);
  await Bun.write(join(main, '.figkit.json'), JSON.stringify({ file: DESIGN }));
  await Bun.write(join(main, '.gitattributes'), '*.figcraft binary\n');
  await Bun.write(join(temp, '.keep'), '');
  await rm(join(temp, '.keep'));
  await writeFile(wrapper, `#!/bin/sh\necho "$1" >> '${log}'\nexec '${bin}' "$@"\n`);
  chmodSync(wrapper, 0o755);

  const script = join(base, 'base.json');

  await Bun.write(
    script,
    JSON.stringify([
      {
        command: 'node.create',
        params: { type: 'frame', name: 'Card', x: 0, y: 0, width: 300, height: 300 },
        as: 'card',
      },
      {
        command: 'node.create',
        params: {
          type: 'text',
          name: 'Title',
          characters: 'Hello',
          parent: { $ref: 'card' },
          x: 10,
          y: 10,
        },
        as: 'title',
      },
      {
        command: 'node.create',
        params: {
          type: 'text',
          name: 'Note',
          characters: 'Note',
          parent: { $ref: 'card' },
          x: 10,
          y: 60,
        },
      },
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'Swatch',
          parent: { $ref: 'card' },
          x: 10,
          y: 120,
          width: 20,
          height: 20,
        },
      },
      { command: 'variable.createCollection', params: { name: 'C', modes: ['Light', 'Dark'] } },
      {
        command: 'variable.create',
        params: { collection: 'C', name: 'space', type: 'number', value: 8 },
      },
      { command: 'style.create', params: { type: 'text', name: 'Body', from: { $ref: 'title' } } },
      { command: 'style.apply', params: { ids: [{ $ref: 'title' }], style: 'Body' } },
      {
        command: 'node.create',
        params: { type: 'frame', name: 'Badge', x: 400, y: 0, width: 80, height: 24 },
        as: 'badge',
      },
      {
        command: 'node.create',
        params: {
          type: 'text',
          name: 'Label',
          characters: 'New',
          parent: { $ref: 'badge' },
          x: 4,
          y: 4,
        },
      },
      {
        command: 'node.create',
        params: { type: 'frame', name: 'Chip', x: 400, y: 100, width: 80, height: 24 },
        as: 'chip',
      },
      {
        command: 'node.create',
        params: {
          type: 'text',
          name: 'ChipLabel',
          characters: 'Chip',
          parent: { $ref: 'chip' },
          x: 4,
          y: 4,
        },
      },
      { command: 'component.create', params: { ids: [{ $ref: 'badge' }] } },
      { command: 'component.create', params: { ids: [{ $ref: 'chip' }] } },
      {
        command: 'instance.create',
        params: { component: { $ref: 'badge' }, parent: { $ref: 'card' }, x: 150, y: 10 },
      },
      { command: 'file.saveVersion', params: { name: 'v1' } },
    ]),
  );

  const made = Bun.spawnSync([bin, 'run', '--out', file, script], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (made.exitCode !== 0) {
    throw new Error(`figcraft-cli: ${made.stdout.toString()} ${made.stderr.toString()}`);
  }

  const document = await documentOf(file);
  const ids: Record<string, number> = {};

  for (const [key, node] of Object.entries(document.nodes)) {
    // The first layer of a name: an instance's copy of a component's text comes later.
    if (node.name && ids[node.name] === undefined) {
      ids[node.name] = Number(key);
    }
  }

  gitIn(main, 'add', '-A');
  gitIn(main, 'commit', '-q', '-m', 'init');
  gitIn(main, 'worktree', 'add', '-q', '-b', 'feat/x', worktree);

  return { base, main, worktree, temp, wrapper, log, ids };
}

function figkit(repo: Repo, cwd: string, args: string[]): Result {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'FIGKIT_FILE') {
      env[key] = value;
    }
  }

  const result = Bun.spawnSync(['bun', CLI, ...args], {
    cwd,
    env: { ...env, TMPDIR: repo.temp, FIGKIT_LOG: '0', FIGCRAFT_BIN: repo.wrapper },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    code: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function ok(result: Result): string {
  if (result.code !== 0) {
    throw new Error(`figkit failed (${result.code}): ${result.stdout}\n${result.stderr}`);
  }

  return result.stdout;
}

/** A write through figkit in the checkout: plain in the main one, a branch tab in a worktree. */
function edit(repo: Repo, cwd: string, commands: unknown[]): void {
  ok(figkit(repo, cwd, ['run', JSON.stringify(commands)]));
}

function gitBytesOf(cwd: string, object: string): Uint8Array {
  return Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', '-C', cwd, 'cat-file', '-p', object])
    .stdout;
}

function commit(cwd: string, message: string): void {
  gitIn(cwd, 'add', '-A');
  gitIn(cwd, 'commit', '-q', '-m', message);
}

/** `git merge` that may stop at a conflict; returns whether it did. */
function gitMerge(cwd: string, ...args: string[]): boolean {
  const result = Bun.spawnSync(
    ['git', '-c', 'core.fsmonitor=false', '-C', cwd, 'merge', '-q', ...args],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  return result.exitCode !== 0;
}

async function documentOf(file: string): Promise<FigDocument> {
  return parseDocument(entryBytes(await readArchive(file), 'document.json'));
}

type Node = FigDocument['nodes'][string] & {
  characters?: string;
  component?: number;
  style?: { font_size?: number; style_id?: string };
};

function nodes(document: FigDocument): [number, Node][] {
  return Object.entries(document.nodes).map(([key, node]) => [Number(key), node as Node]);
}

function named(document: FigDocument, name: string): Node[] {
  return nodes(document)
    .filter(([, node]) => node.name === name)
    .map(([, node]) => node);
}

function pageNames(document: FigDocument): string[] {
  return ((document.pages as number[] | undefined) ?? []).map(
    (page) => document.nodes[String(page)]?.name ?? '',
  );
}

/** The texts inside every instance of a component. */
function instanceTexts(document: FigDocument, component: number): string[][] {
  return nodes(document)
    .filter(([, node]) => node.type === 'instance' && node.component === component)
    .map(([, node]) => {
      const texts: string[] = [];
      const todo = [...(node.children ?? [])];

      while (todo.length > 0) {
        const child = document.nodes[String(todo.shift())] as Node | undefined;

        if (child?.type === 'text') {
          texts.push(child.characters ?? '');
        }

        todo.push(...(child?.children ?? []));
      }

      return texts;
    });
}

function info(file: string): { images: number } {
  const result = Bun.spawnSync([bin, 'info', '--json', file], { stdout: 'pipe', stderr: 'pipe' });

  expect(result.exitCode).toBe(0);

  return JSON.parse(result.stdout.toString()) as { images: number };
}

/** The temp folder and the design folder hold no container, script or result after a run. */
function expectClean(repo: Repo, checkout: string): void {
  const figkitTemp = join(repo.temp, 'figkit');
  const left = existsSync(figkitTemp)
    ? readdirSync(figkitTemp).filter((name) => !/^(stub|commands|merge-report)-/.test(name))
    : [];

  expect(left).toEqual([]);
  expect(readdirSync(join(checkout, 'design')).filter((name) => name.startsWith('.'))).toEqual([]);
}

function versionsOf(archive: { entries: { name: string }[] }): string[] {
  return archive.entries
    .filter((entry) => entry.name.startsWith('versions/'))
    .map((entry) => entry.name);
}

function cliCalls(repo: Repo): string[] {
  return existsSync(repo.log)
    ? readFileSync(repo.log, 'utf8').trim().split('\n').filter(Boolean)
    : [];
}

describe.skipIf(!hasCli)('figkit merge against figcraft-cli', () => {
  test('into main: separate changes, both changes of one layer, components, a text style, an image', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'BranchRect',
          parent: ids.Card,
          x: 60,
          y: 150,
          width: 10,
          height: 10,
        },
        as: 'r',
      },
      {
        command: 'variable.create',
        params: { collection: 'C', name: 'branch-var', type: 'number', value: 3 },
      },
      {
        command: 'style.create',
        params: { type: 'paint', name: 'BranchFill', from: { $ref: 'r' } },
      },
      { command: 'page.add', params: { name: 'BranchPage' } },
      { command: 'text.set', params: { id: ids.Note, characters: 'Note branch' } },
      { command: 'text.set', params: { id: ids.ChipLabel, characters: 'Chip edited' } },
      {
        command: 'instance.create',
        params: { component: ids.Badge, parent: ids.Card, x: 150, y: 120 },
      },
      {
        command: 'node.create',
        params: {
          type: 'text',
          name: 'Styled',
          characters: 'Styled',
          parent: ids.Card,
          x: 10,
          y: 200,
        },
        as: 's',
      },
      { command: 'style.apply', params: { ids: [{ $ref: 's' }], style: 'Body' } },
      {
        command: 'image.place',
        params: { data: PNG, name: 'Photo', x: 300, y: 300, width: 10, height: 10 },
      },
    ]);
    commit(repo.worktree, 'branch design');
    edit(repo, repo.main, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'MainRect',
          parent: ids.Card,
          x: 80,
          y: 150,
          width: 10,
          height: 10,
        },
        as: 'r',
      },
      {
        command: 'variable.create',
        params: { collection: 'C', name: 'main-var', type: 'number', value: 1 },
      },
      { command: 'style.create', params: { type: 'paint', name: 'MainFill', from: { $ref: 'r' } } },
      { command: 'page.add', params: { name: 'MainPage' } },
      { command: 'node.set', params: { ids: [ids.Note], name: 'Note main' } },
      {
        command: 'instance.create',
        params: { component: ids.Chip, parent: ids.Card, x: 150, y: 60 },
      },
      { command: 'text.set', params: { id: ids.Label, characters: 'Badge edited' } },
      { command: 'style.update', params: { style: 'Body', value: { fontSize: 20 } } },
    ]);
    commit(repo.main, 'main design');

    const file = join(repo.main, DESIGN);
    const oursArchive = await readArchive(file);

    expect(gitMerge(repo.main, '--squash', 'feat/x')).toBe(true);

    const merged = figkit(repo, repo.main, ['merge', 'feat/x']);

    expect(merged.code).toBe(0);
    expect(merged.stdout).toContain('merge feat/x');
    expect(merged.stdout).toContain('conflicts: none');
    expect(merged.stdout).toContain(`stage it with: git add ${DESIGN}`);
    expectClean(repo, repo.main);

    const document = await documentOf(file);

    for (const name of ['BranchRect', 'MainRect', 'Styled', 'Photo']) {
      expect(named(document, name)).toHaveLength(1);
    }

    expect(document.variables?.variables?.map((variable) => variable.name).sort()).toEqual([
      'branch-var',
      'main-var',
      'space',
    ]);
    expect(document.styles?.map((style) => style.name).sort()).toEqual([
      'Body',
      'BranchFill',
      'MainFill',
    ]);
    expect(pageNames(document).sort()).toEqual(['BranchPage', 'MainPage', 'Page 1']);
    // Text on the branch and name on main, one layer: both kept.
    expect(document.nodes[String(ids.Note)]).toMatchObject({
      name: 'Note main',
      characters: 'Note branch',
    });
    // Each component's edit shows in every instance, whichever side added it.
    expect(instanceTexts(document, ids.Chip as number)).toEqual([['Chip edited']]);
    expect(instanceTexts(document, ids.Badge as number)).toEqual([
      ['Badge edited'],
      ['Badge edited'],
    ]);
    // The branch's text takes main's redefined style and keeps the link.
    const styled = named(document, 'Styled')[0] as Node;

    expect(styled.style?.font_size).toBe(20);
    expect(styled.style?.style_id).toBe(
      document.styles?.find((style) => style.name === 'Body')?.id,
    );
    // The image is in the archive and FigCraft counts it.
    const archive = await readArchive(file);

    for (const hash of document.imageIndex?.map((image) => image.hash) ?? []) {
      expect(archive.entries.some((entry) => entry.name.startsWith(`images/${hash}`))).toBe(true);
    }

    expect(info(file).images).toBe(1);
    expect(clientOf(readNextId(entryBytes(archive, 'document.json')))).toBe(0);
    expect(archive.entries.some((entry) => entry.name.startsWith('branches/'))).toBe(false);
    expect(versionsOf(archive)).toEqual(versionsOf(oursArchive));

    // git add and git commit complete the squash merge, and the copy passes the check.
    gitIn(repo.main, 'add', DESIGN);
    gitIn(repo.main, 'commit', '-q', '-m', 'merge feat/x');
    expect(figkit(repo, repo.main, ['check']).code).toBe(0);
  }, 180_000);

  test('conflicts: listed with exit 1, resolved either way, and the resolve checks', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      { command: 'text.set', params: { id: ids.Note, characters: 'branch note' } },
      { command: 'node.set', params: { ids: [ids.Swatch], name: 'Swatch edited' } },
    ]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [
      { command: 'text.set', params: { id: ids.Note, characters: 'main note' } },
      { command: 'edit.delete', params: { ids: [ids.Swatch] } },
    ]);
    commit(repo.main, 'main');

    const file = join(repo.main, DESIGN);

    gitMerge(repo.main, '--squash', 'feat/x');

    const before = await readFile(file);
    const listed = figkit(repo, repo.main, ['merge', 'feat/x']);
    const noteKey = `${ids.Note}/`;

    expect(listed.code).toBe(1);
    expect(listed.stdout).toContain('conflicts: 2');
    expect(listed.stdout).toContain(noteKey);
    expect(listed.stdout).toContain('branch note');
    expect(listed.stdout).toContain('main note');
    expect(listed.stdout).toContain(`${ids.Swatch}/layer`);
    expect(listed.stdout).toContain('--resolve');
    expect(await readFile(file)).toEqual(before);
    expectClean(repo, repo.main);

    const keys = [...listed.stdout.matchAll(/^ {2}(\S+\/\S+)/gm)].map(
      (match) => match[1] as string,
    );

    expect(keys).toHaveLength(2);

    const resolve = (value: unknown, extra: Record<string, unknown> = {}): Result =>
      figkit(repo, repo.main, [
        'merge',
        'feat/x',
        '--resolve',
        JSON.stringify({ ...Object.fromEntries(keys.map((key) => [key, value])), ...extra }),
      ]);

    expect(
      figkit(repo, repo.main, [
        'merge',
        'feat/x',
        '--resolve',
        JSON.stringify({ [keys[0] as string]: 'main' }),
      ]).code,
    ).toBe(1);
    expect(resolve('main', { '999/kind': 'main' }).code).toBe(2);
    expect(resolve('theirs').code).toBe(2);
    expect(await readFile(file)).toEqual(before);
    expectClean(repo, repo.main);

    ok(resolve('branch'));

    const branchSide = await documentOf(file);

    expect((branchSide.nodes[String(ids.Note)] as Node).characters).toBe('branch note');
    expect(branchSide.nodes[String(ids.Swatch)]?.name).toBe('Swatch edited');

    // Back to Git's state, then main's values.
    await writeFile(file, before);
    ok(resolve('main'));

    const mainSide = await documentOf(file);

    expect((mainSide.nodes[String(ids.Note)] as Node).characters).toBe('main note');
    expect(mainSide.nodes[String(ids.Swatch)]).toBeUndefined();
    expectClean(repo, repo.main);
  }, 180_000);

  test('review writes nothing and works before git merge', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      { command: 'text.set', params: { id: ids.Note, characters: 'branch note' } },
    ]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [
      { command: 'text.set', params: { id: ids.Note, characters: 'main note' } },
    ]);
    commit(repo.main, 'main');

    const file = join(repo.main, DESIGN);
    const before = await readFile(file);
    const review = figkit(repo, repo.main, ['merge', 'feat/x', '--review']);

    expect(review.code).toBe(1);
    expect(review.stdout).toContain('branch: layers 0 added, 1 changed');
    expect(review.stdout).toContain('conflicts: 1');
    expect(review.stdout).toContain('main note');
    expect(await readFile(file)).toEqual(before);

    gitMerge(repo.main, '--squash', 'feat/x');

    const real = figkit(repo, repo.main, ['merge', 'feat/x']);

    expect(real.code).toBe(1);
    expect(real.stdout).toBe(review.stdout);
    expectClean(repo, repo.main);

    // Without conflicts the review exits 0.
    const clean = await makeRepo();

    edit(clean, clean.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(clean.worktree, 'branch');
    edit(clean, clean.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(clean.main, 'main');
    expect(figkit(clean, clean.main, ['merge', 'feat/x', '--review']).code).toBe(0);
  }, 180_000);

  test('the life of a branch: from main twice-worked, then squash-merged into main', async () => {
    const repo = await makeRepo();
    const { ids } = repo;
    const branchFile = join(repo.worktree, DESIGN);
    const mainFile = join(repo.main, DESIGN);

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'B1',
          parent: ids.Card,
          x: 0,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.worktree, 'b1');
    edit(repo, repo.worktree, [
      {
        command: 'variable.create',
        params: { collection: 'C', name: 'b2', type: 'number', value: 2 },
      },
    ]);
    commit(repo.worktree, 'b2');
    edit(repo, repo.main, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'M1',
          parent: ids.Card,
          x: 20,
          y: 0,
          width: 5,
          height: 5,
        },
      },
      { command: 'page.add', params: { name: 'MainPage' } },
    ]);
    commit(repo.main, 'm1');

    const rangeBefore = clientOf(
      readNextId(entryBytes(await readArchive(branchFile), 'document.json')),
    );

    expect(rangeBefore).toBeGreaterThan(0);
    expect(gitMerge(repo.worktree, 'main', '--no-edit')).toBe(true);

    const fromMain = ok(figkit(repo, repo.worktree, ['merge', 'main']));

    expectClean(repo, repo.worktree);

    const updated = await readArchive(branchFile);
    const updatedDocument = parseDocument(entryBytes(updated, 'document.json'));

    expect(named(updatedDocument, 'M1')).toHaveLength(1);
    expect(named(updatedDocument, 'B1')).toHaveLength(1);
    expect(pageNames(updatedDocument)).toContain('MainPage');
    expect(clientOf(updatedDocument.next_id)).toBe(rangeBefore);
    expect(updated.entries.some((entry) => /^(versions|branches)\//.test(entry.name))).toBe(false);
    expect(figkit(repo, repo.worktree, ['check']).code).toBe(0);
    gitIn(repo.worktree, 'add', DESIGN);
    gitIn(repo.worktree, 'commit', '-q', '--no-edit');

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'B3',
          parent: ids.Card,
          x: 40,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.worktree, 'b3');
    edit(repo, repo.main, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'M2',
          parent: ids.Card,
          x: 60,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.main, 'm2');

    expect(gitMerge(repo.main, '--squash', 'feat/x')).toBe(true);

    const intoMain = ok(figkit(repo, repo.main, ['merge', 'feat/x']));

    expectClean(repo, repo.main);

    const final = await documentOf(mainFile);

    // The report of each merge: the story's edits, Card (both sides added to it) and no side
    // effect. The counts add up to the layers of the result.
    const fromMainReport = await reportOf(fromMain);
    const intoMainReport = await reportOf(intoMain);

    // From main: main's M1 and its page, the branch's B1, Card.
    expect(fromMainReport.classes).toMatchObject({
      fromOther: 2,
      fromThis: 1,
      merged: 1,
      sideEffect: 0,
    });
    // Into main: the branch's B1 and B3, main's M2, Card.
    expect(intoMainReport.classes).toMatchObject({
      fromOther: 2,
      fromThis: 1,
      merged: 1,
      sideEffect: 0,
    });
    expect(intoMainReport.groups).toEqual([]);
    expect(intoMain).toContain('side effects: none');
    expect(Object.values(intoMainReport.classes).reduce((sum, count) => sum + count, 0)).toBe(
      Object.keys(final.nodes).length,
    );
    expect(intoMain).toContain(`layers in the result: ${Object.keys(final.nodes).length};`);

    for (const name of ['B1', 'B3', 'M1', 'M2']) {
      expect(named(final, name)).toHaveLength(1);
    }

    expect(final.variables?.variables?.filter((variable) => variable.name === 'b2')).toHaveLength(
      1,
    );
    expect(pageNames(final).filter((name) => name === 'MainPage')).toHaveLength(1);
    expect(clientOf(final.next_id)).toBe(0);
    gitIn(repo.main, 'add', DESIGN);
    gitIn(repo.main, 'commit', '-q', '-m', 'merge feat/x');
    expect(figkit(repo, repo.main, ['check']).code).toBe(0);
  }, 240_000);

  test('fast paths do not start figcraft-cli run', async () => {
    const repo = await makeRepo();
    const { ids } = repo;
    const mainFile = join(repo.main, DESIGN);
    const mainBefore = await readArchive(mainFile);

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'Only',
          parent: ids.Card,
          x: 0,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.worktree, 'branch');
    await Bun.write(join(repo.main, 'other.txt'), 'x');
    commit(repo.main, 'not design');
    expect(gitMerge(repo.main, '--squash', 'feat/x')).toBe(false);
    await rm(repo.log, { force: true });

    const result = ok(figkit(repo, repo.main, ['merge', 'feat/x']));

    expect(result).toContain('fast path');
    expect(result).not.toContain('layers in the result');
    expect(result).not.toContain('report:');
    expect(cliCalls(repo).filter((call) => call === 'run')).toEqual([]);

    const merged = await readArchive(mainFile);
    const branchDocument = parseDocument(
      entryBytes(await readArchive(join(repo.worktree, DESIGN)), 'document.json'),
    );
    const mergedDocument = parseDocument(entryBytes(merged, 'document.json'));

    expect(named(mergedDocument, 'Only')).toHaveLength(1);
    expect({ ...mergedDocument, next_id: 0 }).toEqual({ ...branchDocument, next_id: 0 });
    expect(mergedDocument.next_id).toBe(readNextId(entryBytes(mainBefore, 'document.json')));
    expect(versionsOf(merged)).toEqual(versionsOf(mainBefore));
    expect(versionsOf(merged).length).toBeGreaterThan(0);
    expectClean(repo, repo.main);
    gitIn(repo.main, 'add', DESIGN);
    gitIn(repo.main, 'commit', '-q', '-m', 'merge');

    // Only main changed: nothing to merge.
    const second = await makeRepo();

    await Bun.write(join(second.worktree, 'other.txt'), 'x');
    commit(second.worktree, 'not design');
    edit(second, second.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(second.main, 'main');
    await rm(second.log, { force: true });
    expect(ok(figkit(second, second.main, ['merge', 'feat/x']))).toContain('nothing to merge');
    expect(cliCalls(second).filter((call) => call === 'run')).toEqual([]);
  }, 180_000);

  test('refusals with exit 2', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      { command: 'node.set', params: { ids: [ids.Note], name: 'Note b' } },
    ]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [
      { command: 'node.set', params: { ids: [ids.Swatch], name: 'Swatch m' } },
    ]);
    commit(repo.main, 'main');

    // Before git merge.
    const early = figkit(repo, repo.main, ['merge', 'feat/x']);

    expect(early.code).toBe(2);
    expect(early.stderr).toContain('run "git merge feat/x" first');

    // Uncommitted changes in the working file.
    gitMerge(repo.main, '--squash', 'feat/x');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'Uncommitted' } }]);

    const dirty = figkit(repo, repo.main, ['merge', 'feat/x']);

    expect(dirty.code).toBe(2);
    expect(dirty.stderr).toContain('changes that are not committed');

    // A merge with another ref in progress, the working file back to ours.
    await writeFile(join(repo.main, DESIGN), gitBytesOf(repo.main, `HEAD:${DESIGN}`));
    // feat/y: another commit with feat/x's tree.
    gitIn(
      repo.main,
      'branch',
      'feat/y',
      gitIn(repo.main, 'commit-tree', 'feat/x^{tree}', '-p', 'feat/x', '-m', 'y'),
    );

    const another = figkit(repo, repo.main, ['merge', 'feat/y']);

    expect(another.code).toBe(2);
    expect(another.stderr).toContain('run "git merge feat/y" first');

    // Another design branch.

    const other = figkit(repo, repo.worktree, ['merge', 'feat/y']);

    expect(other.code).toBe(2);
    expect(other.stderr).toContain('a design branch merges only with main');

    // A detached HEAD.
    gitIn(repo.worktree, 'checkout', '-q', '--detach');

    const detached = figkit(repo, repo.worktree, ['merge', 'main']);

    expect(detached.code).toBe(2);
    expect(detached.stderr).toContain('detached HEAD');
    expectClean(repo, repo.main);
  }, 180_000);

  test('refused: a branch squash-merged before', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'B1',
          parent: ids.Card,
          x: 0,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.worktree, 'b1');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M1' } }]);
    commit(repo.main, 'm1');
    gitMerge(repo.main, '--squash', 'feat/x');
    ok(figkit(repo, repo.main, ['merge', 'feat/x']));
    commit(repo.main, 'squash');

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name: 'B2',
          parent: ids.Card,
          x: 10,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ]);
    commit(repo.worktree, 'b2');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M2' } }]);
    commit(repo.main, 'm2');
    gitMerge(repo.main, '--squash', 'feat/x');

    const file = join(repo.main, DESIGN);
    const before = await readFile(file);
    const again = figkit(repo, repo.main, ['merge', 'feat/x']);

    expect(again.code).toBe(2);
    expect(again.stderr).toContain('squash-merged into main before');
    expect(await readFile(file)).toEqual(before);
    expectClean(repo, repo.main);
  }, 180_000);

  test('refused: two plain copies with the same new layer id, and the same plain variable id', async () => {
    const layers = await makeRepo();
    const plain = (repo: Repo, cwd: string, commands: unknown[]): void => {
      const script = join(repo.base, `plain-${Math.random()}.json`);
      const file = join(cwd, DESIGN);

      writeFileSync(script, JSON.stringify(commands));

      const result = Bun.spawnSync([bin, 'run', '--in', file, '--out', file, script], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(result.exitCode).toBe(0);
    };
    const rect = (name: string) => [
      {
        command: 'node.create',
        params: {
          type: 'rectangle',
          name,
          parent: layers.ids.Card,
          x: 0,
          y: 0,
          width: 5,
          height: 5,
        },
      },
    ];

    plain(layers, layers.worktree, rect('PlainB'));
    commit(layers.worktree, 'plain branch');
    plain(layers, layers.main, rect('PlainM'));
    commit(layers.main, 'plain main');
    gitMerge(layers.main, '--squash', 'feat/x');

    const same = figkit(layers, layers.main, ['merge', 'feat/x']);

    expect(same.code).toBe(2);
    expect(same.stderr).toContain('not written through figkit');
    expectClean(layers, layers.main);

    const variables = await makeRepo();
    const variable = (name: string) => [
      { command: 'variable.create', params: { collection: 'C', name, type: 'number', value: 1 } },
    ];

    plain(variables, variables.worktree, variable('v-branch'));
    commit(variables.worktree, 'plain branch');
    plain(variables, variables.main, variable('v-main'));
    commit(variables.main, 'plain main');
    gitMerge(variables.main, '--squash', 'feat/x');

    const twice = figkit(variables, variables.main, ['merge', 'feat/x']);

    expect(twice.code).toBe(2);
    expect(twice.stderr).toContain('variable/');
    expect(twice.stderr).toContain('outside figkit');
    expectClean(variables, variables.main);
  }, 180_000);
  test('receipt on a branch: check fails until figkit merge main, and after a later change', async () => {
    const repo = await makeRepo();
    const { ids } = repo;
    const check = (cwd: string): Result => figkit(repo, cwd, ['check']);

    edit(repo, repo.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [
      { command: 'node.set', params: { ids: [ids.Swatch], name: 'Swatch m' } },
    ]);
    commit(repo.main, 'main');
    expect(gitMerge(repo.worktree, 'main', '--no-edit')).toBe(true);

    const message = `both sides changed ${DESIGN}: run "figkit merge main"`;

    expect(check(repo.worktree).stderr).toContain(message);
    gitIn(repo.worktree, 'add', DESIGN);
    expect(check(repo.worktree).code).toBe(1);
    expect(check(repo.worktree).stderr).toContain(message);
    ok(figkit(repo, repo.worktree, ['merge', 'main']));
    expect(
      existsSync(join(gitIn(repo.worktree, 'rev-parse', '--absolute-git-dir'), RECEIPT_NAME)),
    ).toBe(true);

    // The index still holds ours: a commit now would take it.
    const unstaged = check(repo.worktree);

    expect(unstaged.code).toBe(1);
    expect(unstaged.stderr).toContain(
      `the staged ${DESIGN} is not the file in the working tree: run "git add ${DESIGN}"`,
    );
    gitIn(repo.worktree, 'add', DESIGN);
    expect(check(repo.worktree).code).toBe(0);
    edit(repo, repo.worktree, [{ command: 'page.add', params: { name: 'After' } }]);
    expect(check(repo.worktree).stderr).toContain(`the staged ${DESIGN} is not the file`);
    gitIn(repo.worktree, 'add', DESIGN);
    expect(check(repo.worktree).stderr).toContain(message);
  }, 180_000);

  test('receipt on main after git merge --squash', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [
      { command: 'node.set', params: { ids: [ids.Swatch], name: 'Swatch m' } },
    ]);
    commit(repo.main, 'main');
    expect(gitMerge(repo.main, '--squash', 'feat/x')).toBe(true);

    const short = gitIn(repo.main, 'rev-parse', '--short=7', 'feat/x');
    const before = figkit(repo, repo.main, ['check']);

    expect(before.code).toBe(1);
    expect(before.stderr).toContain(`run "figkit merge ${short}"`);
    gitIn(repo.main, 'add', DESIGN);

    const staged = figkit(repo, repo.main, ['check']);

    expect(staged.code).toBe(1);
    expect(staged.stderr).toContain(`run "figkit merge ${short}"`);
    ok(figkit(repo, repo.main, ['merge', 'feat/x']));

    const unstaged = figkit(repo, repo.main, ['check']);

    expect(unstaged.code).toBe(1);
    expect(unstaged.stderr).toContain(
      `the staged ${DESIGN} is not the file in the working tree: run "git add ${DESIGN}"`,
    );
    gitIn(repo.main, 'add', DESIGN);
    expect(figkit(repo, repo.main, ['check']).code).toBe(0);
  }, 180_000);

  test('outside a merge: a staged design file changed again fails until it is staged again', async () => {
    const repo = await makeRepo();
    const message = `the staged ${DESIGN} is not the file in the working tree`;

    for (const cwd of [repo.main, repo.worktree]) {
      // Not staged at all: checked as it is in the working tree.
      edit(repo, cwd, [{ command: 'page.add', params: { name: 'One' } }]);
      expect(figkit(repo, cwd, ['check']).code).toBe(0);
      gitIn(cwd, 'add', DESIGN);
      expect(figkit(repo, cwd, ['check']).code).toBe(0);
      edit(repo, cwd, [{ command: 'page.add', params: { name: 'Two' } }]);

      const changed = figkit(repo, cwd, ['check']);

      expect(changed.code).toBe(1);
      expect(changed.stderr).toContain(message);
      gitIn(cwd, 'add', DESIGN);
      expect(figkit(repo, cwd, ['check']).code).toBe(0);
    }
  }, 180_000);

  test('one side changed needs no receipt, both directions; --review writes none', async () => {
    const repo = await makeRepo();
    const receipt = (cwd: string): boolean =>
      existsSync(join(gitIn(cwd, 'rev-parse', '--absolute-git-dir'), RECEIPT_NAME));

    // Into main: only main changed the file.
    await Bun.write(join(repo.worktree, 'other.txt'), 'x');
    commit(repo.worktree, 'not design');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(repo.main, 'main');
    expect(ok(figkit(repo, repo.main, ['merge', 'feat/x', '--review']))).toContain(
      'nothing to merge',
    );
    gitMerge(repo.main, '--squash', 'feat/x');
    expect(figkit(repo, repo.main, ['check']).code).toBe(0);
    expect(receipt(repo.main)).toBe(false);
    gitIn(repo.main, 'commit', '-q', '-m', 'squash');

    // From main: only main changed the file.
    ok(figkit(repo, repo.worktree, ['merge', 'main', '--review']));
    expect(receipt(repo.worktree)).toBe(false);
    gitMerge(repo.worktree, 'main', '--no-ff', '--no-commit');
    expect(figkit(repo, repo.worktree, ['check']).code).toBe(0);
    expect(receipt(repo.worktree)).toBe(false);

    // --review with both sides changed writes none either.
    const both = await makeRepo();

    edit(both, both.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(both.worktree, 'branch');
    edit(both, both.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(both.main, 'main');
    gitMerge(both.main, '--squash', 'feat/x');
    expect(figkit(both, both.main, ['merge', 'feat/x', '--review']).code).toBe(0);
    expect(receipt(both.main)).toBe(false);
  }, 180_000);
});

type Hooks = {
  /** Before a figcraft-cli run, with its input file. */
  before?(input: string, commands: Command[]): Promise<void>;
  /** After a figcraft-cli run that succeeded, with its output file. */
  after?(commands: Command[], out: string | null): Promise<void>;
};

/** `figkit merge` in-process with the real figcraft-cli, with hooks around each run. */
async function mergeIn(
  repo: Repo,
  cwd: string,
  ref: string,
  hooks: Hooks = {},
  resolve: Record<string, unknown> | null = null,
): Promise<{ code: number; out: string[]; errors: string[] }> {
  const project = resolveProject(cwd, { ...process.env, FIGKIT_FILE: undefined });
  const out: string[] = [];
  const errors: string[] = [];
  const run = async (
    input: string,
    commands: Command[],
    output: string | null,
    dir: string,
  ): Promise<RunResult> => {
    await hooks.before?.(input, commands);
    await mkdir(dir, { recursive: true });

    const script = join(dir, `script-${Math.random()}.json`);

    await Bun.write(script, JSON.stringify(commands));

    const child = Bun.spawnSync(
      [bin, 'run', '--in', input, ...(output ? ['--out', output] : []), script],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const result = parseRunOutput(
      child.stdout.toString(),
      child.stderr.toString(),
      child.exitCode ?? 1,
    );

    if (result.ok) {
      await hooks.after?.(commands, output);
    }

    return result;
  };
  const code = await merge(
    project,
    { ref, review: false, resolve },
    {
      git: (args) => gitBytes(project.root, args),
      cliVersion: () => cliVersion(bin),
      run,
      info: async (path) =>
        Bun.spawnSync([bin, 'info', path], { stdout: 'pipe', stderr: 'pipe' }).exitCode === 0
          ? null
          : 'cannot open',
      tempDir: join(repo.temp, 'figkit'),
      print: (line) => out.push(line),
      printError: (line) => errors.push(line),
    },
  );

  return { code, out, errors };
}

/** The JSON file the report names. */
async function reportOf(stdout: string): Promise<Report> {
  const path = /^report: (.+)$/m.exec(stdout)?.[1];

  expect(path).toBeDefined();

  return JSON.parse(await readFile(path as string, 'utf8')) as Report;
}

type Linked = Node & { styles?: { text?: string | null } | null };

const textStyleOf = (document: FigDocument, name: string): string | null =>
  (named(document, name)[0] as Linked | undefined)?.styles?.text ?? null;

const fontSizeOf = (document: FigDocument, name: string): number | undefined =>
  (named(document, name)[0] as Node | undefined)?.style?.font_size;

const bodyId = (document: FigDocument): string | undefined =>
  document.styles?.find((style) => style.name === 'Body')?.id;

/** Branch: Body gets font size 20. Main: a new text "Fresh" with Body. */
function restyleOnBranch(repo: Repo): void {
  edit(repo, repo.worktree, [
    { command: 'style.update', params: { style: 'Body', value: { fontSize: 20 } } },
  ]);
  commit(repo.worktree, 'branch restyles Body');
  edit(repo, repo.main, [
    {
      command: 'node.create',
      params: {
        type: 'text',
        name: 'Fresh',
        characters: 'Fresh',
        parent: repo.ids.Card,
        x: 10,
        y: 240,
      },
      as: 'f',
    },
    { command: 'style.apply', params: { ids: [{ $ref: 'f' }], style: 'Body' } },
  ]);
  commit(repo.main, 'main adds Fresh');
}

describe.skipIf(!hasCli)('figkit merge: check, report and text style repair', () => {
  test('a component edited on the branch and an instance added on main: an instance side effect', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      { command: 'text.set', params: { id: ids.ChipLabel, characters: 'Chip edited' } },
    ]);
    commit(repo.worktree, 'branch edits Chip');
    edit(repo, repo.main, [
      {
        command: 'instance.create',
        params: { component: ids.Chip, parent: ids.Card, x: 150, y: 60 },
      },
    ]);
    commit(repo.main, 'main adds a Chip');
    gitMerge(repo.main, '--squash', 'feat/x');

    const merged = ok(figkit(repo, repo.main, ['merge', 'feat/x']));
    const report = await reportOf(merged);
    const effects = report.groups.flatMap((group) => group.layers);

    expect(effects.length).toBeGreaterThan(0);
    expect(effects.every((layer) => layer.reason === 'instance')).toBe(true);
    expect(report.groups.map((group) => [group.page, group.frame])).toEqual([
      ['Page 1', { id: ids.Card as number, name: 'Card' }],
    ]);
    expect(merged).toContain(`page "Page 1", frame ${ids.Card} "Card"`);
    expect(merged).toMatch(/^ {4}\d+ "ChipLabel" instance$/m);
    expect(report.restored).toEqual([]);
    expect(merged.indexOf('layers in the result')).toBeLessThan(merged.indexOf('wrote '));
    expectClean(repo, repo.main);
  }, 180_000);

  test('into main: a text style redefined on the branch, a text with it added on main', async () => {
    const repo = await makeRepo();
    const file = join(repo.main, DESIGN);
    const unrepaired = join(repo.base, 'unrepaired.figcraft');

    restyleOnBranch(repo);

    const oursArchive = await readArchive(file);

    gitMerge(repo.main, '--squash', 'feat/x');

    const merged = await mergeIn(repo, repo.main, 'feat/x', {
      before: async (input, commands) => {
        if (commands[0]?.command === 'style.apply') {
          await writeFile(unrepaired, await readFile(input));
        }
      },
    });

    expect(merged.errors).toEqual([]);
    expect(merged.code).toBe(0);

    // FigCraft's own result: the text lost its link and kept the old size.
    const before = await documentOf(unrepaired);

    expect(textStyleOf(before, 'Fresh')).toBeNull();
    expect(fontSizeOf(before, 'Fresh')).toBe(12);

    // After the repair: linked, with the style's new values.
    const archive = await readArchive(file);
    const document = parseDocument(entryBytes(archive, 'document.json'));

    expect(textStyleOf(document, 'Fresh')).toBe(bodyId(document) as string);
    expect(fontSizeOf(document, 'Fresh')).toBe(20);
    expect(fontSizeOf(document, 'Title')).toBe(20);
    // The repair leaves the counter and the versions as they were.
    expect(readNextId(entryBytes(archive, 'document.json'))).toBe(
      readNextId(entryBytes(await readArchive(unrepaired), 'document.json')),
    );
    expect(clientOf(document.next_id)).toBe(0);
    expect(versionsOf(archive).length).toBeGreaterThan(0);

    for (const name of versionsOf(oursArchive)) {
      expect(entryBytes(archive, name)).toEqual(entryBytes(oursArchive, name));
    }

    const stdout = merged.out.join('\n');
    const report = await reportOf(stdout);

    expect(stdout).toContain('text style restored: "Body", 1 layer(s)');
    const fresh = nodes(document).find(([, node]) => node.name === 'Fresh')?.[0];

    expect(report.restored).toEqual([{ style: 'Body', layers: [fresh as number] }]);
    expect(
      report.groups.flatMap((group) => group.layers).find((layer) => layer.name === 'Fresh')
        ?.reason,
    ).toBe('style restored');
    expectClean(repo, repo.main);
  }, 180_000);

  test('from main: the same arrangement is repaired in the branch copy, and the later merge into main keeps it', async () => {
    const repo = await makeRepo();
    const branchFile = join(repo.worktree, DESIGN);
    const mainFile = join(repo.main, DESIGN);

    restyleOnBranch(repo);

    const range = clientOf(readNextId(entryBytes(await readArchive(branchFile), 'document.json')));

    expect(range).toBeGreaterThan(0);
    expect(gitMerge(repo.worktree, 'main', '--no-edit')).toBe(true);

    const merged = ok(figkit(repo, repo.worktree, ['merge', 'main']));
    const updated = await documentOf(branchFile);

    expect(merged).toContain('layers in the result');
    expect(merged).toContain('text style restored: "Body", 1 layer(s)');
    expect((await reportOf(merged)).restored.map((item) => item.style)).toEqual(['Body']);
    expect(textStyleOf(updated, 'Fresh')).toBe(bodyId(updated) as string);
    expect(fontSizeOf(updated, 'Fresh')).toBe(20);
    expect(clientOf(updated.next_id)).toBe(range);
    expectClean(repo, repo.worktree);
    gitIn(repo.worktree, 'add', DESIGN);
    gitIn(repo.worktree, 'commit', '-q', '--no-edit');
    expect(figkit(repo, repo.worktree, ['check']).code).toBe(0);

    // Something else on each side, then into main.
    edit(repo, repo.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(repo.worktree, 'branch page');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(repo.main, 'main page');
    gitMerge(repo.main, '--squash', 'feat/x');

    const final = ok(figkit(repo, repo.main, ['merge', 'feat/x']));
    const document = await documentOf(mainFile);

    expect(final).toContain('layers in the result');
    expect(textStyleOf(document, 'Fresh')).toBe(bodyId(document) as string);
    expect(fontSizeOf(document, 'Fresh')).toBe(20);
  }, 240_000);

  test('a lost layer fails with exit 2 and names it; the working file is unchanged', async () => {
    const repo = await makeRepo();
    const file = join(repo.main, DESIGN);

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: { type: 'rectangle', name: 'Kept', parent: repo.ids.Card, width: 5, height: 5 },
      },
    ]);
    commit(repo.worktree, 'branch adds Kept');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(repo.main, 'main');
    gitMerge(repo.main, '--squash', 'feat/x');

    const kept = Number(
      Object.entries((await documentOf(join(repo.worktree, DESIGN))).nodes).find(
        ([, node]) => node.name === 'Kept',
      )?.[0],
    );
    const before = await readFile(file);
    // FigCraft's result loses the layer: delete it from the merged output.
    const merged = await mergeIn(repo, repo.main, 'feat/x', {
      after: async (commands, out) => {
        if (out && commands.some((item) => item.command === 'branch.merge')) {
          const script = join(repo.base, 'lose.json');

          await Bun.write(
            script,
            JSON.stringify([{ command: 'edit.delete', params: { ids: [kept] } }]),
          );
          expect(
            Bun.spawnSync([bin, 'run', '--in', out, '--out', out, script], {
              stdout: 'pipe',
              stderr: 'pipe',
            }).exitCode,
          ).toBe(0);
        }
      },
    });

    expect(merged.code).toBe(2);
    expect(merged.errors.join('\n')).toContain(`${kept} "Kept" (the other side)`);
    expect(await readFile(file)).toEqual(before);
    expectClean(repo, repo.main);
  }, 180_000);

  test('the design file changes while FigCraft merges: exit 2, the change is kept, no receipt', async () => {
    const repo = await makeRepo();
    const file = join(repo.main, DESIGN);

    edit(repo, repo.worktree, [{ command: 'page.add', params: { name: 'B' } }]);
    commit(repo.worktree, 'branch');
    edit(repo, repo.main, [{ command: 'page.add', params: { name: 'M' } }]);
    commit(repo.main, 'main');
    gitMerge(repo.main, '--squash', 'feat/x');

    let saved: Buffer | null = null;
    // A save from the FigCraft app while figcraft-cli merges.
    const merged = await mergeIn(repo, repo.main, 'feat/x', {
      after: async (commands) => {
        if (!saved && commands.some((item) => item.command === 'branch.merge')) {
          edit(repo, repo.main, [{ command: 'page.add', params: { name: 'Saved' } }]);
          saved = await readFile(file);
        }
      },
    });

    expect(merged.code).toBe(2);
    expect(merged.errors.join('\n')).toContain(
      'the design file changed while the merge ran; nothing was written',
    );
    expect(saved).not.toBeNull();
    expect((await readFile(file)).toString('hex')).toBe(
      (saved as Buffer | null)?.toString('hex') ?? '',
    );
    expect(
      existsSync(join(gitIn(repo.main, 'rev-parse', '--absolute-git-dir'), RECEIPT_NAME)),
    ).toBe(false);
    expectClean(repo, repo.main);
  }, 180_000);

  test('not lost: a frame main deleted with a layer the branch added inside it', async () => {
    const repo = await makeRepo();
    const { ids } = repo;

    edit(repo, repo.worktree, [
      {
        command: 'node.create',
        params: { type: 'rectangle', name: 'Inside', parent: ids.Card, width: 5, height: 5 },
      },
    ]);
    commit(repo.worktree, 'branch adds Inside');
    edit(repo, repo.main, [{ command: 'edit.delete', params: { ids: [ids.Card] } }]);
    commit(repo.main, 'main deletes Card');
    gitMerge(repo.main, '--squash', 'feat/x');

    const merged = ok(
      figkit(repo, repo.main, [
        'merge',
        'feat/x',
        '--resolve',
        JSON.stringify({ [`${ids.Card}/layer`]: 'main' }),
      ]),
    );
    const document = await documentOf(join(repo.main, DESIGN));

    expect(merged).toContain('layers in the result');
    expect(named(document, 'Card')).toEqual([]);
    expect(named(document, 'Inside')).toEqual([]);
    expectClean(repo, repo.main);
  }, 180_000);
});
