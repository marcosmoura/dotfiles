import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { acquireAppLock } from './lock';

const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function lockDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'figcraft-mcp-lock-test-'));

  directories.push(directory);

  return directory;
}

describe('acquireAppLock', () => {
  test('allows one owner and releases the lock', async () => {
    const directory = await lockDirectory();

    const first = await acquireAppLock(47_800, directory);

    expect(first).not.toBeNull();

    expect(await acquireAppLock(47_800, directory)).toBeNull();

    await first?.release();
    expect(await acquireAppLock(47_800, directory)).not.toBeNull();
  });

  test('reclaims a lock whose owner is gone', async () => {
    const directory = await lockDirectory();
    const path = join(directory, '47800.lock');

    await writeFile(path, '999999:stale\n');

    const lock = await acquireAppLock(47_800, directory);

    expect(lock).not.toBeNull();
    expect(await readFile(path, 'utf8')).toStartWith(`${process.pid}:`);

    await lock?.release();
  });

  test('does not take a lock owned by a live process', async () => {
    const directory = await lockDirectory();
    const path = join(directory, '47800.lock');

    await writeFile(path, `${process.pid}:other\n`);

    expect(await acquireAppLock(47_800, directory)).toBeNull();
  });

  test('release does not remove a lock replaced by another owner', async () => {
    const directory = await lockDirectory();
    const path = join(directory, '47800.lock');

    const lock = await acquireAppLock(47_800, directory);

    await writeFile(path, '12345:replacement\n');

    await lock?.release();
    expect(await readFile(path, 'utf8')).toBe('12345:replacement\n');
  });
});
