import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compareVersions, resolveBin } from './settings';
import { testConfig } from './testing';

describe('resolveBin', () => {
  let directory = '';

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function fakeCli(path: string, version: string): Promise<string> {
    await mkdir(join(path, '..'), { recursive: true });
    await Bun.write(path, `#!/bin/sh\necho "figcraft-cli ${version}"\n`);
    await chmod(path, 0o755);

    return path;
  }

  async function setup(pathVersion: string, installed: string[]): Promise<[string, string]> {
    directory = await mkdtemp(join(tmpdir(), 'figkit-bin-'));

    const installs = join(directory, 'installs');
    const onPath = await fakeCli(join(directory, 'bin', 'figcraft-cli'), pathVersion);

    await mkdir(installs, { recursive: true });

    for (const version of installed) {
      await fakeCli(join(installs, version, 'figcraft-cli'), version);
    }

    return [onPath, installs];
  }

  test('keeps a recent CLI from PATH', async () => {
    const [onPath, installs] = await setup('0.17.0', ['0.18.0']);

    expect(resolveBin(testConfig({ figcraftBin: onPath }), {}, installs)).toBe(onPath);
  });

  test('replaces a stale CLI with the newest installed one', async () => {
    const [onPath, installs] = await setup('0.6.0', ['0.9.0', '0.16.0', '0.17.0']);

    expect(resolveBin(testConfig({ figcraftBin: onPath }), {}, installs)).toBe(
      join(installs, '0.17.0', 'figcraft-cli'),
    );
  });

  test('fails clearly when nothing recent enough exists', async () => {
    const [onPath, installs] = await setup('0.6.0', ['0.9.0']);

    expect(() => resolveBin(testConfig({ figcraftBin: onPath }), {}, installs)).toThrow(
      /0\.6\.0.*too old.*0\.16\.0/,
    );
  });

  test('uses FIGCRAFT_BIN as given', async () => {
    const [onPath, installs] = await setup('0.6.0', []);

    expect(resolveBin(testConfig({ figcraftBin: onPath }), { FIGCRAFT_BIN: '/x/cli' }, installs)).toBe(
      '/x/cli',
    );
  });

  test('compares versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.16.0', '0.16.0')).toBe(0);
  });
});
