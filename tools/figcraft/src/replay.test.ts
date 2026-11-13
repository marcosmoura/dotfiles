import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { conflictPaths } from './check';
import { loadConfig, resolveBin } from './settings';
import { gitIn } from './testing';

const CLI = join(import.meta.dir, 'cli.ts');
const DESIGN = join('design', 'test.figcraft');
const REBASE_MESSAGE =
  `error: rebasing would replay 1 design commit(s). Git cannot merge ${DESIGN}, and a replay ` +
  'onto another version of it loses work. Merge instead: git merge main, then figkit merge main';
const REPLAY_MESSAGE =
  `a design commit cannot be cherry-picked or reverted onto another version of ${DESIGN}: Git ` +
  'cannot merge that file. Abort it and make the change again with a designer';
const PICK_MESSAGE =
  `${DESIGN} was in a conflict that figkit did not merge, and the staged copy is one side of it. ` +
  'Abort it (git reset --merge) and make the change again with a designer';

let bin = '';

try {
  bin = resolveBin(loadConfig());
} catch {
  // No usable figcraft-cli on this machine: the tests that need a real design file are skipped.
}

const hasCli = bin !== '' && existsSync(bin);

let directory = '';
let repoCount = 0;

beforeAll(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'figkit-replay-')));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

type Result = { code: number; stdout: string; stderr: string };

function figkit(cwd: string, args: string[]): Result {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'FIGKIT_FILE') {
      env[key] = value;
    }
  }

  const result = Bun.spawnSync(['bun', CLI, ...args], {
    cwd,
    env: { ...env, TMPDIR: join(directory, 'tmp'), FIGKIT_LOG: '0' },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    code: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

/** A repository on `main` with a design file, committed. */
async function makeRepo(content: (file: string) => Promise<void>): Promise<string> {
  repoCount += 1;

  const repo = join(directory, `repo-${repoCount}`);

  gitIn(directory, 'init', '-q', '-b', 'main', repo);
  await Bun.write(join(repo, '.figkit.json'), JSON.stringify({ file: DESIGN }));
  await Bun.write(join(repo, '.gitattributes'), '*.figcraft binary\n');
  await content(join(repo, DESIGN));
  commit(repo, 'init');

  return repo;
}

function commit(cwd: string, message: string): void {
  gitIn(cwd, 'add', '-A');
  gitIn(cwd, 'commit', '-q', '-m', message);
}

/** A stand-in design file: `check --rebase` compares blob ids and opens no document. */
async function standIn(repo: string, bytes: number[]): Promise<void> {
  await Bun.write(join(repo, DESIGN), new Uint8Array([0, ...bytes]));
}

/** A Git command that may stop at a conflict; returns whether it did. */
function stops(cwd: string, ...args: string[]): boolean {
  const result = Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return result.exitCode !== 0;
}

describe('figkit check --rebase', () => {
  test('refuses to replay a design commit onto a design file main changed since the fork', async () => {
    const repo = await makeRepo((file) => Bun.write(file, new Uint8Array([0, 1])).then(() => {}));

    gitIn(repo, 'checkout', '-q', '-b', 'feat/x');
    await standIn(repo, [2]);
    commit(repo, 'branch design');
    gitIn(repo, 'checkout', '-q', 'main');
    await standIn(repo, [3]);
    commit(repo, 'main design');
    gitIn(repo, 'checkout', '-q', 'feat/x');

    const refused = figkit(repo, ['check', '--rebase', 'main']);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toBe(REBASE_MESSAGE);

    // The branch given as the second argument, from another branch.
    gitIn(repo, 'checkout', '-q', 'main');
    expect(figkit(repo, ['check', '--rebase', 'main', 'feat/x'])).toMatchObject({
      code: 1,
      stderr: REBASE_MESSAGE,
    });
  });

  test('refuses a design commit whether or not main changed the design file', async () => {
    const repo = await makeRepo((file) => Bun.write(file, new Uint8Array([0, 1])).then(() => {}));
    const refuse = (args: string[], count = 1): void =>
      expect(figkit(repo, ['check', '--rebase', ...args])).toEqual({
        code: 1,
        stdout: '',
        stderr: REBASE_MESSAGE.replace('replay 1 ', `replay ${count} `),
      });

    gitIn(repo, 'checkout', '-q', '-b', 'feat/design');
    await standIn(repo, [2]);
    commit(repo, 'branch design');
    await standIn(repo, [4]);
    commit(repo, 'more branch design');
    gitIn(repo, 'checkout', '-q', 'main');
    await Bun.write(join(repo, 'main.txt'), 'main');
    commit(repo, 'main code');

    // Main did not change the design file.
    refuse(['main', 'feat/design'], 2);

    await standIn(repo, [3]);
    commit(repo, 'main design');
    gitIn(repo, 'checkout', '-q', 'feat/design');

    // Main changed it.
    refuse(['main'], 2);
    // `git rebase --onto main <fork point>`: the hook gets the fork point as the upstream.
    refuse([gitIn(repo, 'merge-base', 'main', 'HEAD').trim()], 2);
    // Onto an ancestor whose next commit is a design commit.
    refuse(['HEAD~1']);
  });

  test('passes when no commit in the range changes the design file', async () => {
    const repo = await makeRepo((file) => Bun.write(file, new Uint8Array([0, 1])).then(() => {}));
    const pass = (args: string[]): void =>
      expect(figkit(repo, ['check', '--rebase', ...args])).toEqual({
        code: 0,
        stdout: '',
        stderr: '',
      });

    gitIn(repo, 'checkout', '-q', '-b', 'feat/code');
    await Bun.write(join(repo, 'code.txt'), 'code');
    commit(repo, 'code');
    gitIn(repo, 'checkout', '-q', 'main');
    await standIn(repo, [3]);
    commit(repo, 'main design');

    // A branch without design commits, main changed the design file.
    pass(['main', 'feat/code']);
    // A design commit before the upstream: outside the range.
    gitIn(repo, 'checkout', '-q', 'feat/code');
    await standIn(repo, [5]);
    commit(repo, 'branch design');
    await Bun.write(join(repo, 'code.txt'), 'more code');
    commit(repo, 'more code');
    pass(['HEAD~1']);
  });

  test('passes outside a checkout and without .figkit.json', async () => {
    const outside = await mkdtemp(join(directory, 'outside-'));
    const bare = join(directory, 'no-config');

    gitIn(directory, 'init', '-q', '-b', 'main', bare);

    for (const cwd of [outside, bare]) {
      expect(figkit(cwd, ['check', '--rebase', 'x'])).toEqual({ code: 0, stdout: '', stderr: '' });
    }
  });
});

describe('conflictPaths', () => {
  const message = (list: string): string => `Side design\n\n${list}`;

  test('reads the conflict list of MERGE_MSG', () => {
    expect(conflictPaths(message(`# Conflicts:\n#\t${DESIGN}\n`))).toEqual([DESIGN]);
    expect(conflictPaths(message('# Conflicts:\n#\tother.txt\n'))).toEqual(['other.txt']);
    expect(conflictPaths(message(''))).toEqual([]);
  });
});

describe.skipIf(!hasCli)('figkit check during a cherry-pick or a revert', () => {
  let count = 0;

  /** Adds a frame to the design file with figcraft-cli. */
  async function addFrame(file: string, name: string): Promise<void> {
    count += 1;

    const script = join(directory, `script-${count}.json`);
    const input = existsSync(file) ? ['--in', file] : [];

    await Bun.write(
      script,
      JSON.stringify([
        { command: 'node.create', params: { type: 'frame', name, width: 100, height: 100 } },
      ]),
    );

    const result = Bun.spawnSync([bin, 'run', ...input, '--out', file, script], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (result.exitCode !== 0) {
      throw new Error(`figcraft-cli: ${result.stdout.toString()} ${result.stderr.toString()}`);
    }
  }

  test('a cherry-pick of a design commit onto another version fails', async () => {
    const repo = await makeRepo((file) => addFrame(file, 'Base'));

    gitIn(repo, 'checkout', '-q', '-b', 'side');
    await addFrame(join(repo, DESIGN), 'Side');
    commit(repo, 'side design');
    gitIn(repo, 'checkout', '-q', 'main');
    await addFrame(join(repo, DESIGN), 'Main');
    commit(repo, 'main design');

    expect(stops(repo, 'cherry-pick', 'side')).toBe(true);
    expect(existsSync(join(repo, '.git', 'CHERRY_PICK_HEAD'))).toBe(true);

    const result = figkit(repo, ['check']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`error: ${REPLAY_MESSAGE}`);
  }, 60_000);

  test('a revert fails onto another version and passes onto the same one', async () => {
    const repo = await makeRepo((file) => addFrame(file, 'Base'));

    await addFrame(join(repo, DESIGN), 'First');
    commit(repo, 'first design');
    await addFrame(join(repo, DESIGN), 'Second');
    commit(repo, 'second design');

    // Reverting the first design commit after the second: a conflict.
    expect(stops(repo, 'revert', '--no-edit', 'HEAD~1')).toBe(true);
    expect(existsSync(join(repo, '.git', 'REVERT_HEAD'))).toBe(true);

    const refused = figkit(repo, ['check']);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(`error: ${REPLAY_MESSAGE}`);

    gitIn(repo, 'revert', '--abort');

    // Reverting the last design commit applies cleanly.
    gitIn(repo, 'revert', '--no-commit', 'HEAD');
    expect(existsSync(join(repo, '.git', 'REVERT_HEAD'))).toBe(true);
    expect(figkit(repo, ['check'])).toEqual({ code: 0, stdout: '', stderr: '' });
  }, 60_000);

  test('a cherry-pick -n of a design commit that took one side fails until restored', async () => {
    const repo = await makeRepo((file) => addFrame(file, 'Base'));

    gitIn(repo, 'checkout', '-q', '-b', 'side');
    await addFrame(join(repo, DESIGN), 'Side');
    commit(repo, 'side design');
    gitIn(repo, 'checkout', '-q', 'main');
    await addFrame(join(repo, DESIGN), 'Main');
    commit(repo, 'main design');

    expect(stops(repo, 'cherry-pick', '-n', 'side')).toBe(true);
    expect(existsSync(join(repo, '.git', 'CHERRY_PICK_HEAD'))).toBe(false);
    gitIn(repo, 'checkout', '--theirs', '--', DESIGN);
    gitIn(repo, 'add', DESIGN);

    const refused = figkit(repo, ['check']);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(`error: ${PICK_MESSAGE}`);

    // Restoring the file alone leaves MERGE_MSG and its conflict list behind: the change made
    // again would be refused as well. The abort the message names clears it.
    gitIn(repo, 'reset', '--merge');
    expect(existsSync(join(repo, '.git', 'MERGE_MSG'))).toBe(false);
    expect(figkit(repo, ['check'])).toEqual({ code: 0, stdout: '', stderr: '' });

    await addFrame(join(repo, DESIGN), 'Again');
    gitIn(repo, 'add', DESIGN);
    expect(figkit(repo, ['check'])).toEqual({ code: 0, stdout: '', stderr: '' });
  }, 60_000);
});
