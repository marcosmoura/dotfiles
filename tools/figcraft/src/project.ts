import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export type Project = {
  /** The checkout the command runs in: the main checkout or a linked worktree. */
  root: string;
  /** Absolute path of the design file. */
  file: string;
  /** Why writes are refused, or null when they are allowed. */
  writeBlocked: string | null;
  /** `main` on the branch `.figkit.json` names (and with `FIGKIT_FILE`), `branch` otherwise. */
  copy: 'main' | 'branch';
  /** The checkout's branch; null on a detached HEAD and with `FIGKIT_FILE`. */
  branch: string | null;
  /** The branch whose copy is the main copy. */
  mainBranch: string;
  /** The Git common directory, shared by every worktree; null with `FIGKIT_FILE`. */
  commonDir: string | null;
  /** The design file at the same path in the main checkout; null with `FIGKIT_FILE`. */
  mainFile: string | null;
};

type ProjectFile = { file?: unknown; branch?: unknown };

export const CONFIG_NAME = '.figkit.json';

/**
 * Finds the design file. `FIGKIT_FILE` names one directly (scratch copies, tests): plain writes, no
 * Git. Otherwise `.figkit.json` is read from the checkout that holds `cwd`, and that checkout's
 * copy is the file. Its branch decides whether it is the main copy or a branch copy.
 */
export function resolveProject(cwd: string, env: NodeJS.ProcessEnv = process.env): Project {
  const override = env.FIGKIT_FILE;

  if (override) {
    const file = resolve(cwd, override);

    return {
      root: dirname(file),
      file,
      writeBlocked: null,
      copy: 'main',
      branch: null,
      mainBranch: 'main',
      commonDir: null,
      mainFile: null,
    };
  }

  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const commonDir = gitCommonDir(cwd);

  if (!root || !commonDir) {
    throw new Error(`not inside a git checkout: ${cwd}. Set FIGKIT_FILE or run inside a project.`);
  }

  const configPath = join(root, CONFIG_NAME);

  if (!existsSync(configPath)) {
    throw new Error(`${configPath} not found. Create it as {"file": "<path to the .figcraft file>"}.`);
  }

  let parsed: ProjectFile;

  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as ProjectFile;
  } catch (error) {
    throw new Error(`${configPath} is not valid JSON: ${(error as Error).message}`);
  }

  if (typeof parsed.file !== 'string' || !parsed.file) {
    throw new Error(`${configPath} must have a "file" string.`);
  }

  const mainCheckout = dirname(commonDir);
  const file = isAbsolute(parsed.file) ? parsed.file : join(root, parsed.file);
  const mainFile = isAbsolute(parsed.file) ? parsed.file : join(mainCheckout, parsed.file);
  const mainBranch = typeof parsed.branch === 'string' && parsed.branch ? parsed.branch : 'main';
  const branch = git(root, ['branch', '--show-current']);

  return {
    root,
    file,
    writeBlocked: branch ? null : 'the checkout is not on a branch (detached HEAD)',
    copy: branch === mainBranch ? 'main' : 'branch',
    branch,
    mainBranch,
    commonDir,
    mainFile,
  };
}

/** The absolute Git common directory of the checkout that holds `cwd`, or null outside one. */
export function gitCommonDir(cwd: string): string | null {
  return git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
}

export function git(cwd: string, args: string[]): string | null {
  const output = gitBytes(cwd, args);

  return output ? new TextDecoder().decode(output).trim() || null : null;
}

/** Git's raw output, or null when it fails: `git show <rev>:<path>` of a binary file. */
export function gitBytes(cwd: string, args: string[]): Uint8Array | null {
  try {
    const result = Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
      stdout: 'pipe',
      stderr: 'ignore',
    });

    return result.exitCode === 0 ? result.stdout : null;
  } catch {
    return null;
  }
}
