import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { entryBytes, readArchive } from './archive';
import { highestClient, MAX_CLIENT, parseDocument } from './document';

/** `<git-common-dir>/figkit/clients.json`: the next number and the branch that owns each one. */
export type Registry = {
  next: number;
  owners: Record<string, string>;
};

/** The registry is shared by every worktree of a clone, so it lives in the Git common directory. */
export type RegistryOptions = {
  commonDir: string;
  /** The main checkout's design file, read only when the registry does not exist yet. */
  mainDesignFile: string | null;
  /** How long a claim waits for another process's lock. */
  timeoutMs?: number;
};

const FIRST_CLIENT = 1024;

export function registryPath(commonDir: string): string {
  return join(commonDir, 'figkit', 'clients.json');
}

/** The registry, or null when no number was handed out yet. A corrupt file is an error. */
export async function readRegistry(commonDir: string): Promise<Registry | null> {
  const path = registryPath(commonDir);
  let content: string;

  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  return validate(path, content);
}

export async function clientOwner(commonDir: string, client: number): Promise<string | null> {
  checkLimit(client);

  return (await readRegistry(commonDir))?.owners[String(client)] ?? null;
}

/** Hands out the next number to a branch, once, under an exclusive lock. */
export async function claimClient(options: RegistryOptions, branch: string): Promise<number> {
  const path = registryPath(options.commonDir);

  await mkdir(join(options.commonDir, 'figkit'), { recursive: true });

  const release = await lock(`${path}.lock`, options.timeoutMs ?? 30_000);

  try {
    const registry = (await readRegistry(options.commonDir)) ?? {
      next: await seed(options.mainDesignFile),
      owners: {},
    };
    const client = registry.next;

    checkLimit(client);
    registry.owners[String(client)] = branch;
    registry.next = client + 1;

    const temporary = `${path}.${randomUUID()}.tmp`;

    await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`);
    await rename(temporary, path);

    return client;
  } finally {
    await release();
  }
}

/** Starts above every range the main copy already holds, so no number is handed out twice. */
async function seed(designFile: string | null): Promise<number> {
  if (!designFile || !existsSync(designFile)) {
    return FIRST_CLIENT;
  }

  const document = parseDocument(entryBytes(await readArchive(designFile), 'document.json'));

  return Math.max(FIRST_CLIENT - 1, highestClient(document)) + 1;
}

function checkLimit(client: number): void {
  if (!Number.isInteger(client) || client < 0 || client > MAX_CLIENT) {
    throw new Error(`id range ${client} is outside 0 to ${MAX_CLIENT}`);
  }
}

function validate(path: string, content: string): Registry {
  const fail = (): never => {
    throw new Error(`${path} is corrupt; fix or remove it by hand`);
  };
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    fail();
  }

  const registry = value as Registry;

  if (
    typeof registry !== 'object' ||
    registry === null ||
    !Number.isInteger(registry.next) ||
    typeof registry.owners !== 'object' ||
    registry.owners === null ||
    Array.isArray(registry.owners)
  ) {
    fail();
  }

  for (const [key, owner] of Object.entries(registry.owners)) {
    if (!/^\d+$/.test(key) || Number(key) >= registry.next || typeof owner !== 'string') {
      fail();
    }
  }

  return registry;
}

/** The lock-file approach of `lock.ts`, but a claim waits for the lock instead of giving up. */
async function lock(path: string, timeoutMs: number): Promise<() => Promise<void>> {
  const token = `${process.pid}:${randomUUID()}`;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const handle = await open(path, 'wx');

      try {
        await handle.writeFile(`${token}\n`);
      } finally {
        await handle.close();
      }

      return async () => {
        try {
          if ((await readFile(path, 'utf8')).trim() === token) {
            await unlink(path);
          }
        } catch {
          // The lock is already gone.
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    // Checked on every round, so a takeover that never ends cannot keep a claim waiting forever.
    if (Date.now() > deadline) {
      throw new Error(
        `timed out waiting for ${path}; when no figkit is running, remove it and ${path}.takeover`,
      );
    }

    const owner = await readOwner(path);

    if (owner !== null && !isAlive(owner)) {
      await takeOver(path, owner, token);

      continue;
    }

    await Bun.sleep(10);
  }
}

/**
 * Removes the lock of a dead owner, one process at a time: the holder of an exclusive takeover
 * marker reads the owner again, so a process that found the same dead lock late cannot remove the
 * fresh lock of the process that took it over first. A marker whose own owner died is removed.
 */
async function takeOver(path: string, dead: number, token: string): Promise<void> {
  const marker = `${path}.takeover`;

  try {
    const handle = await open(marker, 'wx');

    try {
      await handle.writeFile(`${token}\n`);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }

    const markerOwner = await readOwner(marker);

    if (markerOwner !== null && !isAlive(markerOwner)) {
      await unlink(marker).catch(() => {});
    } else {
      await Bun.sleep(10);
    }

    return;
  }

  try {
    if ((await readOwner(path)) === dead) {
      await unlink(path).catch(() => {});
    }
  } finally {
    await unlink(marker).catch(() => {});
  }
}

async function readOwner(path: string): Promise<number | null> {
  try {
    const pid = Number((await readFile(path, 'utf8')).split(':', 1)[0]?.trim());

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
