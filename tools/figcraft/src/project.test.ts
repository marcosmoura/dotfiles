import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveProject } from './project';
import { gitIn } from './testing';

const env = { ...process.env, FIGKIT_FILE: undefined };

describe('resolveProject', () => {
  let directory = '';
  let main = '';
  let worktree = '';

  beforeAll(async () => {
    directory = await realpath(await mkdtemp(join(tmpdir(), 'figkit-project-')));
    main = join(directory, 'repo');
    worktree = join(directory, 'wt');

    await Bun.write(join(main, '.figkit.json'), JSON.stringify({ file: 'design/test.figcraft' }));
    await Bun.write(join(main, 'design', 'test.figcraft'), 'not a real file');
    gitIn(directory, 'init', '-q', '-b', 'main', main);
    gitIn(main, 'add', '-A');
    gitIn(main, 'commit', '-q', '-m', 'init');
    gitIn(main, 'worktree', 'add', '-q', '-b', 'feat/x', worktree);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('the main checkout holds the main copy', () => {
    expect(resolveProject(join(main, 'design'), env)).toEqual({
      root: main,
      file: join(main, 'design', 'test.figcraft'),
      writeBlocked: null,
      copy: 'main',
      branch: 'main',
      mainBranch: 'main',
      commonDir: join(main, '.git'),
      mainFile: join(main, 'design', 'test.figcraft'),
    });
  });

  test('a linked worktree on another branch holds a branch copy of its own', () => {
    expect(resolveProject(worktree, env)).toEqual({
      root: worktree,
      file: join(worktree, 'design', 'test.figcraft'),
      writeBlocked: null,
      copy: 'branch',
      branch: 'feat/x',
      mainBranch: 'main',
      commonDir: join(main, '.git'),
      mainFile: join(main, 'design', 'test.figcraft'),
    });
  });

  test('.figkit.json "branch" names the branch of the main copy', async () => {
    const config = join(worktree, '.figkit.json');

    await Bun.write(config, JSON.stringify({ file: 'design/test.figcraft', branch: 'feat/x' }));

    try {
      expect(resolveProject(worktree, env)).toMatchObject({ copy: 'main', mainBranch: 'feat/x' });
      expect(resolveProject(main, env)).toMatchObject({ copy: 'main' });
    } finally {
      gitIn(worktree, 'checkout', '--', '.figkit.json');
    }
  });

  test('a main checkout on another branch simply holds a branch copy', () => {
    gitIn(main, 'checkout', '-q', '-b', 'feat/other');

    try {
      expect(resolveProject(main, env)).toMatchObject({
        copy: 'branch',
        branch: 'feat/other',
        writeBlocked: null,
      });
    } finally {
      gitIn(main, 'checkout', '-q', 'main');
    }
  });

  test('a detached HEAD refuses writes', () => {
    gitIn(worktree, 'checkout', '-q', '--detach');

    try {
      expect(resolveProject(worktree, env)).toMatchObject({
        branch: null,
        copy: 'branch',
        writeBlocked: 'the checkout is not on a branch (detached HEAD)',
      });
    } finally {
      gitIn(worktree, 'checkout', '-q', 'feat/x');
    }
  });

  test('FIGKIT_FILE names the file: plain writes, no Git', () => {
    expect(resolveProject(worktree, { FIGKIT_FILE: 'scratch.figcraft' })).toEqual({
      root: worktree,
      file: join(worktree, 'scratch.figcraft'),
      writeBlocked: null,
      copy: 'main',
      branch: null,
      mainBranch: 'main',
      commonDir: null,
      mainFile: null,
    });
  });

  test('fails outside a checkout and without .figkit.json', async () => {
    expect(() => resolveProject(directory, env)).toThrow(/not inside a git checkout/);

    const bare = join(directory, 'bare');

    gitIn(directory, 'init', '-q', '-b', 'main', bare);
    expect(() => resolveProject(bare, env)).toThrow(/\.figkit\.json not found/);
  });
});
