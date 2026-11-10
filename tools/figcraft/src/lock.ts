import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { log } from './logger';

export type AppLock = {
  release: () => Promise<void>;
};

const DEFAULT_LOCK_DIRECTORY = join(tmpdir(), 'figkit-locks');

/**
 * One proxy per app control port. A second `figcraft-cli mcp --attach` can hang behind the first,
 * so a proxy that cannot take the lock must use the headless backend instead.
 */
export async function acquireAppLock(
  port: number,
  directory = process.env.FIGKIT_LOCK_DIR ?? DEFAULT_LOCK_DIRECTORY,
): Promise<AppLock | null> {
  const path = join(directory, `${port}.lock`);
  const token = `${process.pid}:${randomUUID()}`;

  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    log(`could not create the FigCraft lock directory (${describe(error)})`);

    return null;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, 'wx');

      try {
        await handle.writeFile(`${token}\n`);
      } finally {
        await handle.close();
      }

      let released = false;
      const release = async (): Promise<void> => {
        if (released) {
          return;
        }

        released = true;
        await removeOwnedLock(path, token);
      };

      process.once('exit', () => removeOwnedLockSync(path, token));

      return { release };
    } catch (error) {
      if (!isExists(error)) {
        log(`could not create the FigCraft lock (${describe(error)})`);

        return null;
      }

      const owner = await readLockOwner(path);

      if (owner !== null && isAlive(owner)) {
        return null;
      }

      try {
        await unlink(path);
      } catch {
        // Another process may have removed it first.
      }
    }
  }

  return null;
}

async function readLockOwner(path: string): Promise<number | null> {
  try {
    const content = await readFile(path, 'utf8');
    const pid = Number(content.split(':', 1)[0]?.trim());

    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function removeOwnedLock(path: string, token: string): Promise<void> {
  try {
    const content = await readFile(path, 'utf8');

    if (content.trim() !== token) {
      return;
    }

    await unlink(path);
  } catch {
    // The lock is already gone or was replaced.
  }
}

function removeOwnedLockSync(path: string, token: string): void {
  try {
    if (readFileSync(path, 'utf8').trim() !== token) {
      return;
    }

    unlinkSync(path);
  } catch {
    // The lock is already gone or was replaced.
  }
}

function isExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'EEXIST';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
