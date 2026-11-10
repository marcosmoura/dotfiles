import { afterEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:net';

import {
  ensureAppControl,
  isPortOpen,
  normalizeAppPath,
  parseControlPorts,
  parseProcessList,
  type AppDependencies,
} from './app';
import { testConfig } from './testing';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function listen(): Promise<number> {
  const server = createServer();

  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('expected a TCP address');
  }

  return address.port;
}

function deps(overrides: Partial<AppDependencies> = {}): AppDependencies {
  return {
    detect: async () => ({ pids: [], controlPorts: [] }),
    isPortOpen: async () => false,
    portOwnerPids: async () => [],
    launch: async () => false,
    sleep: async () => {},
    ...overrides,
  };
}

describe('isPortOpen', () => {
  test('reports a listening port as open', async () => {
    expect(await isPortOpen(await listen())).toBe(true);
  });

  test('reports a closed port as closed', async () => {
    const port = await listen();
    const server = servers.pop();

    await new Promise<void>((resolve) => server?.close(() => resolve()));

    expect(await isPortOpen(port)).toBe(false);
  });

  test('resolves false for invalid ports', async () => {
    for (const port of [0, -1, 65_536, 70_000, 1.5, Number.NaN]) {
      expect(await isPortOpen(port)).toBe(false);
    }
  });
});

describe('parseProcessList', () => {
  test('parses pid and command pairs, keeping paths with spaces', () => {
    const output = [
      '  123 /Applications/FigCraft.app/Contents/MacOS/FigCraft',
      '  456 /Applications/FigCraft Beta.app/Contents/MacOS/FigCraft Beta',
      '  789 /Applications/FigCraft.app/Contents/Frameworks/FigCraft Helper.app/Contents/MacOS/FigCraft Helper',
      '',
    ].join('\n');

    expect(parseProcessList(output)).toEqual([
      { pid: 123, command: '/Applications/FigCraft.app/Contents/MacOS/FigCraft' },
      { pid: 456, command: '/Applications/FigCraft Beta.app/Contents/MacOS/FigCraft Beta' },
      {
        pid: 789,
        command:
          '/Applications/FigCraft.app/Contents/Frameworks/FigCraft Helper.app/Contents/MacOS/FigCraft Helper',
      },
    ]);
  });

  test('ignores blank, malformed, and pid-less lines', () => {
    expect(parseProcessList('\nnot a process\n  0 /zero\n  -4 /negative\n')).toEqual([]);
  });
});

describe('parseControlPorts', () => {
  test('parses space-separated and equals-separated ports', () => {
    expect(parseControlPorts('FigCraft --control 47800')).toEqual([47_800]);
    expect(parseControlPorts('FigCraft --control=7979')).toEqual([7979]);
    expect(parseControlPorts('FigCraft --control 47800 --control=7979')).toEqual([47_800, 7979]);
  });

  test('deduplicates repeated ports', () => {
    expect(parseControlPorts('--control 47800 --control 47800')).toEqual([47_800]);
  });

  test('ignores missing and out-of-range ports', () => {
    expect(parseControlPorts('FigCraft')).toEqual([]);
    expect(parseControlPorts('--control 0 --control 65536 --control 70000')).toEqual([]);
  });
});

describe('normalizeAppPath', () => {
  test('strips trailing slashes', () => {
    expect(normalizeAppPath('/Applications/FigCraft.app/')).toBe('/Applications/FigCraft.app');
    expect(normalizeAppPath('/Applications/FigCraft.app')).toBe('/Applications/FigCraft.app');
  });
});

describe('ensureAppControl', () => {
  test('returns null without probing when app mode is disabled', async () => {
    let detected = 0;
    const result = await ensureAppControl(
      testConfig({ useApp: false }),
      deps({
        detect: async () => {
          detected += 1;

          return { pids: [], controlPorts: [] };
        },
      }),
    );

    expect(result).toBeNull();
    expect(detected).toBe(0);
  });

  test('attaches to the control port owned by the running app', async () => {
    const result = await ensureAppControl(
      testConfig({ useApp: true, controlWaitMs: 0 }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [47_800] }),
        isPortOpen: async () => true,
        portOwnerPids: async () => [111],
      }),
    );

    expect(result).toBe(47_800);
  });

  test('tries each control port and accepts the one owned by the app', async () => {
    const result = await ensureAppControl(
      testConfig({ useApp: true, controlWaitMs: 0 }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [47_801, 47_800] }),
        isPortOpen: async (port) => port === 47_800,
        portOwnerPids: async () => [111],
      }),
    );

    expect(result).toBe(47_800);
  });

  test('waits for a booting app whose control port opens after the first probe', async () => {
    let probes = 0;

    const result = await ensureAppControl(
      testConfig({ useApp: true, controlWaitMs: 1_000 }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [47_800] }),
        isPortOpen: async () => {
          probes += 1;

          return probes > 1;
        },
        portOwnerPids: async () => [111],
      }),
    );

    expect(result).toBe(47_800);
    expect(probes).toBe(2);
  });

  test('ignores a control port whose listener is another process', async () => {
    let launched = 0;

    const result = await ensureAppControl(
      testConfig({ useApp: true, controlWaitMs: 0 }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [47_800] }),
        isPortOpen: async () => true,
        portOwnerPids: async () => [222],
        launch: async () => {
          launched += 1;

          return true;
        },
      }),
    );

    expect(result).toBeNull();
    expect(launched).toBe(0);
  });

  test('falls back immediately when the running app has no control argument', async () => {
    let probes = 0;
    let launched = 0;

    const result = await ensureAppControl(
      testConfig({ useApp: true }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [] }),
        isPortOpen: async () => {
          probes += 1;

          return true;
        },
        launch: async () => {
          launched += 1;

          return true;
        },
      }),
    );

    expect(result).toBeNull();
    expect(probes).toBe(0);
    expect(launched).toBe(0);
  });

  test('launches the app and verifies the new listener belongs to it', async () => {
    let running = false;
    let launched = 0;

    const result = await ensureAppControl(
      testConfig({
        useApp: true,
        appPath: '/Applications/FigCraft.app/',
        controlPort: 7979,
        appStartTimeoutMs: 500,
      }),
      deps({
        detect: async () =>
          running ? { pids: [111], controlPorts: [7979] } : { pids: [], controlPorts: [] },
        isPortOpen: async () => running,
        portOwnerPids: async () => [111],
        launch: async (appPath, controlPort) => {
          launched += 1;
          expect(appPath).toBe('/Applications/FigCraft.app');
          expect(controlPort).toBe(7979);
          running = true;

          return true;
        },
      }),
    );

    expect(result).toBe(7979);
    expect(launched).toBe(1);
  });

  test("does not attach when the launched app's listener belongs to another process", async () => {
    let launched = false;

    const result = await ensureAppControl(
      testConfig({ useApp: true, appStartTimeoutMs: 20 }),
      deps({
        detect: async () =>
          launched ? { pids: [111], controlPorts: [47_800] } : { pids: [], controlPorts: [] },
        isPortOpen: async () => launched,
        portOwnerPids: async () => [222],
        launch: async () => {
          launched = true;

          return true;
        },
        sleep: (ms) => Bun.sleep(ms),
      }),
    );

    expect(result).toBeNull();
  });

  test('returns null when detection fails', async () => {
    const result = await ensureAppControl(
      testConfig({ useApp: true }),
      deps({
        detect: async () => {
          throw new Error('ps failed');
        },
      }),
    );

    expect(result).toBeNull();
  });

  test('returns null when probing the port owner fails', async () => {
    const result = await ensureAppControl(
      testConfig({ useApp: true, controlWaitMs: 0 }),
      deps({
        detect: async () => ({ pids: [111], controlPorts: [47_800] }),
        isPortOpen: async () => true,
        portOwnerPids: async () => {
          throw new Error('lsof failed');
        },
      }),
    );

    expect(result).toBeNull();
  });

  test('returns null when launching fails', async () => {
    const result = await ensureAppControl(
      testConfig({ useApp: true }),
      deps({ launch: async () => false }),
    );

    expect(result).toBeNull();
  });
});
