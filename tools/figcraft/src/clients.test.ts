import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeArchive } from './archive';
import { claimClient, clientOwner, readRegistry, registryPath } from './clients';
import { firstIdOf, MAX_CLIENT } from './document';

let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'figkit-clients-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function designFile(highestLayer: number): Promise<string> {
  const file = join(directory, 'main.figcraft');
  const json = `{"next_id":5,"nodes":{"1":{},"${highestLayer}":{}},"styles":[],"variables":{}}`;

  await writeArchive(file, [
    { name: 'document.json', data: new TextEncoder().encode(json), method: 'deflate' },
  ]);

  return file;
}

describe('registry', () => {
  test('a fresh registry starts at 1024 and records owners', async () => {
    const options = { commonDir: directory, mainDesignFile: join(directory, 'missing.figcraft') };

    expect(await readRegistry(directory)).toBeNull();
    expect(await claimClient(options, 'feat/a')).toBe(1024);
    expect(await claimClient(options, 'feat/b')).toBe(1025);
    expect(await clientOwner(directory, 1024)).toBe('feat/a');
    expect(await clientOwner(directory, 1025)).toBe('feat/b');
    expect(await clientOwner(directory, 1026)).toBeNull();
    expect(JSON.parse(await readFile(registryPath(directory), 'utf8'))).toEqual({
      next: 1026,
      owners: { '1024': 'feat/a', '1025': 'feat/b' },
    });
  });

  test('a main copy with low ranges still starts at 1024', async () => {
    const options = { commonDir: directory, mainDesignFile: await designFile(firstIdOf(7)) };

    expect(await claimClient(options, 'feat/a')).toBe(1024);
  });

  test('starts above the highest range in the main copy', async () => {
    const options = { commonDir: directory, mainDesignFile: await designFile(firstIdOf(2000)) };

    expect(await claimClient(options, 'feat/a')).toBe(2001);
  });

  test('refuses numbers above the highest client', async () => {
    await mkdir(join(directory, 'figkit'));
    await writeFile(registryPath(directory), JSON.stringify({ next: MAX_CLIENT + 1, owners: {} }));
    await expect(claimClient({ commonDir: directory, mainDesignFile: null }, 'x')).rejects.toThrow(
      String(MAX_CLIENT),
    );
    await expect(clientOwner(directory, MAX_CLIENT + 1)).rejects.toThrow(String(MAX_CLIENT));
  });

  test('a corrupt file is an error and is left alone', async () => {
    await mkdir(join(directory, 'figkit'));

    for (const content of ['{', '{"next":1024}', '{"next":1024,"owners":{"1030":"x"}}']) {
      await writeFile(registryPath(directory), content);
      await expect(
        claimClient({ commonDir: directory, mainDesignFile: null }, 'x'),
      ).rejects.toThrow('corrupt');
      expect(await readFile(registryPath(directory), 'utf8')).toBe(content);
    }
  });

  test('takes over the lock of a process that is gone and waits for a live one', async () => {
    const options = { commonDir: directory, mainDesignFile: null, timeoutMs: 200 };
    const lock = `${registryPath(directory)}.lock`;
    const child = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore', stderr: 'ignore' });

    await child.exited;
    await mkdir(join(directory, 'figkit'));
    await writeFile(lock, `${child.pid}:stale\n`);
    expect(await claimClient(options, 'feat/a')).toBe(1024);

    await writeFile(lock, `${process.pid}:held\n`);
    await expect(claimClient(options, 'feat/b')).rejects.toThrow('timed out');
    expect(await readFile(lock, 'utf8')).toBe(`${process.pid}:held\n`);
    expect((await readRegistry(directory))?.next).toBe(1025);
  });

  test('a takeover that cannot finish still ends at the timeout', async () => {
    // A process died between making the takeover marker and writing its owner into it.
    const lock = `${registryPath(directory)}.lock`;
    const child = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore', stderr: 'ignore' });

    await child.exited;
    await mkdir(join(directory, 'figkit'));
    await writeFile(lock, `${child.pid}:stale\n`);
    await writeFile(`${lock}.takeover`, '');
    await expect(
      claimClient({ commonDir: directory, mainDesignFile: null, timeoutMs: 200 }, 'feat/a'),
    ).rejects.toThrow('timed out');
  });

  test('two processes claiming at once get different numbers', async () => {
    const repository = join(directory, 'repo');

    await mkdir(repository);
    expect(
      Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', 'init', '-q', repository]).exitCode,
    ).toBe(0);

    const common = Bun.spawnSync([
      'git',
      '-c',
      'core.fsmonitor=false',
      '-C',
      repository,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ])
      .stdout.toString()
      .trim();
    const script = join(directory, 'claim.ts');

    await writeFile(
      script,
      `import { claimClient } from ${JSON.stringify(join(import.meta.dir, 'clients.ts'))};\n` +
        `const branch = process.argv[2]!;\n` +
        `const numbers = [];\n` +
        `for (let i = 0; i < 10; i += 1) numbers.push(await claimClient({ commonDir: ${JSON.stringify(common)}, mainDesignFile: null }, branch));\n` +
        `console.log(JSON.stringify(numbers));\n`,
    );

    const run = (branch: string) =>
      Bun.spawn([process.execPath, script, branch], { stdout: 'pipe', stderr: 'inherit' });
    const processes = [run('feat/a'), run('feat/b')];
    const outputs = await Promise.all(
      processes.map(async (child) => {
        expect(await child.exited).toBe(0);

        return JSON.parse(await new Response(child.stdout).text()) as number[];
      }),
    );
    const all = outputs.flat();

    expect(new Set(all).size).toBe(20);

    const registry = await readRegistry(common);

    expect(registry?.next).toBe(1044);
    outputs[0]!.forEach((client) => expect(registry?.owners[String(client)]).toBe('feat/a'));
    outputs[1]!.forEach((client) => expect(registry?.owners[String(client)]).toBe('feat/b'));
  });

  test('processes that find the same dead lock take it over one at a time', async () => {
    const dead = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore', stderr: 'ignore' });

    await dead.exited;

    const script = join(directory, 'claim-stale.ts');

    await writeFile(
      script,
      `import { claimClient } from ${JSON.stringify(join(import.meta.dir, 'clients.ts'))};\n` +
        `const [dir, branch] = process.argv.slice(2);\n` +
        `console.log(JSON.stringify(await claimClient({ commonDir: dir!, mainDesignFile: null }, branch!)));\n`,
    );

    const count = 8;

    for (let round = 0; round < 5; round += 1) {
      const common = join(directory, `stale-${round}`);

      await mkdir(join(common, 'figkit'), { recursive: true });
      await writeFile(`${registryPath(common)}.lock`, `${dead.pid}:stale\n`);

      const branches = Array.from({ length: count }, (_, index) => `feat/${index}`);
      const numbers = await Promise.all(
        branches.map(async (branch) => {
          const child = Bun.spawn([process.execPath, script, common, branch], {
            stdout: 'pipe',
            stderr: 'inherit',
          });

          expect(await child.exited).toBe(0);

          return JSON.parse(await new Response(child.stdout).text()) as number;
        }),
      );

      expect(new Set(numbers).size).toBe(count);

      const registry = await readRegistry(common);

      expect(registry?.next).toBe(1024 + count);
      branches.forEach((branch, index) =>
        expect(registry?.owners[String(numbers[index])]).toBe(branch),
      );
    }
  }, 60_000);
});
