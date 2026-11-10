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
