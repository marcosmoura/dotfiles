import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Config } from './settings';

/** Test-only helpers. Nothing in the runtime imports this file. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    figcraftBin: 'figcraft-cli',
    appPath: '/Applications/FigCraft.app',
    useApp: false,
    controlPort: 47_800,
    controlWaitMs: 50,
    appStartTimeoutMs: 50,
    requestTimeoutMs: 0,
    maxBytes: 16_384,
    maxShotSize: 1_600,
    tempDir: join(tmpdir(), 'figkit-test'),
    ...overrides,
  };
}

/** Runs Git in a test repository with the machine's own identity. */
export function gitIn(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(['git', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')}: ${new TextDecoder().decode(result.stderr)}`);
  }

  return new TextDecoder().decode(result.stdout).trim();
}
