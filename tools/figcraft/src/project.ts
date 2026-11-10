import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export type Project = {
  /** The main checkout, never a linked worktree. */
  root: string;
  /** Absolute path of the design file. */
  file: string;
  /** Why writes are refused, or null when they are allowed. */
  writeBlocked: string | null;
};

type ProjectFile = { file?: unknown; branch?: unknown };

export const CONFIG_NAME = '.figkit.json';

/**
 * Finds the design file. `FIGKIT_FILE` names one directly (scratch copies, tests). Otherwise the
 * project's `.figkit.json` is read from the main checkout, so a worktree's stale copy of a binary
 * design file is never used.
 */
export function resolveProject(cwd: string, env: NodeJS.ProcessEnv = process.env): Project {
  const override = env.FIGKIT_FILE;

  if (override) {
    const file = resolve(cwd, override);

    return { root: dirname(file), file, writeBlocked: null };
  }

  const root = mainCheckout(cwd);

  if (!root) {
    throw new Error(`not inside a git repository: ${cwd}. Set FIGKIT_FILE or run inside a project.`);
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

  const file = isAbsolute(parsed.file) ? parsed.file : join(root, parsed.file);
  const expected = typeof parsed.branch === 'string' && parsed.branch ? parsed.branch : 'main';
  const branch = git(root, ['branch', '--show-current']);

  return {
    root,
    file,
    writeBlocked:
      branch === expected
        ? null
        : `the main checkout is on "${branch ?? 'no branch'}", and the design file changes only on "${expected}"`,
  };
}

function mainCheckout(cwd: string): string | null {
  const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);

  return common ? dirname(common) : null;
}

function git(cwd: string, args: string[]): string | null {
  try {
    const result = Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
      stdout: 'pipe',
      stderr: 'ignore',
    });

    if (result.exitCode !== 0) {
      return null;
    }

    return new TextDecoder().decode(result.stdout).trim() || null;
  } catch {
    return null;
  }
}
