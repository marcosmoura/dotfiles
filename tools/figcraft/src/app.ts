import { connect, type Socket } from 'node:net';
import { basename, join } from 'node:path';

import { isValidPort, type Config } from './settings';
import { log } from './logger';

export type RunningApp = {
  pids: number[];
  controlPorts: number[];
};

export type AppDependencies = {
  detect: (appPath: string) => Promise<RunningApp>;
  isPortOpen: (port: number) => Promise<boolean>;
  portOwnerPids: (port: number) => Promise<number[]>;
  launch: (appPath: string, controlPort: number) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
};

export type ProcessEntry = {
  pid: number;
  command: string;
};

export async function ensureAppControl(
  config: Config,
  deps: AppDependencies = defaultDependencies,
): Promise<number | null> {
  if (!config.useApp) {
    return null;
  }

  const appPath = normalizeAppPath(config.appPath);

  try {
    const running = await deps.detect(appPath);

    if (running.pids.length > 0) {
      if (running.controlPorts.length === 0) {
        log(
          'FigCraft is running without a --control channel; quit it and let figkit ' +
            `launch it with --control, or run it as figcraft --control ${config.controlPort}. ` +
            'Live mode is unavailable until then.',
        );

        return null;
      }

      const port = await waitForRunningApp(config, appPath, running, deps);

      if (port !== null) {
        return port;
      }

      log(
        'FigCraft is running with --control, but no control channel owned by it answered on ' +
          `${running.controlPorts.join(', ')} within ${config.controlWaitMs} ms; ` +
          'live mode is unavailable.',
      );

      return null;
    }

    log(`launching FigCraft with its control channel on 127.0.0.1:${config.controlPort}`);

    if (!(await deps.launch(appPath, config.controlPort))) {
      return null;
    }

    const port = await waitForLaunchedApp(config, appPath, deps);

    if (port !== null) {
      return port;
    }

    log(
      `FigCraft did not open its control channel on 127.0.0.1:${config.controlPort} ` +
        `within ${config.appStartTimeoutMs} ms; live mode is unavailable.`,
    );

    return null;
  } catch (error) {
    log(
      "could not determine FigCraft's control channel " +
        `(${error instanceof Error ? error.message : String(error)}); live mode is unavailable.`,
    );

    return null;
  }
}

async function waitForRunningApp(
  config: Config,
  appPath: string,
  running: RunningApp,
  deps: AppDependencies,
): Promise<number | null> {
  const deadline = Date.now() + config.controlWaitMs;
  let current = running;

  for (;;) {
    const port = await firstOwnedPort(current.controlPorts, current.pids, deps);

    if (port !== null) {
      return port;
    }

    if (Date.now() >= deadline) {
      return null;
    }

    await deps.sleep(pollDelay(config.controlWaitMs));
    current = await deps.detect(appPath);
  }
}

async function waitForLaunchedApp(
  config: Config,
  appPath: string,
  deps: AppDependencies,
): Promise<number | null> {
  const deadline = Date.now() + config.appStartTimeoutMs;
  const port = config.controlPort;

  for (;;) {
    if (await deps.isPortOpen(port)) {
      const running = await deps.detect(appPath);

      if (await isOwnedByApp(port, running.pids, deps)) {
        return port;
      }
    }

    if (Date.now() >= deadline) {
      return null;
    }

    await deps.sleep(pollDelay(config.appStartTimeoutMs));
  }
}

async function firstOwnedPort(
  ports: number[],
  pids: number[],
  deps: AppDependencies,
): Promise<number | null> {
  for (const port of ports) {
    if (await isOwnedByApp(port, pids, deps)) {
      return port;
    }
  }

  return null;
}

async function isOwnedByApp(port: number, pids: number[], deps: AppDependencies): Promise<boolean> {
  if (pids.length === 0) {
    return false;
  }

  if (!(await deps.isPortOpen(port))) {
    return false;
  }

  const owners = await deps.portOwnerPids(port);

  return owners.some((owner) => pids.includes(owner));
}

function pollDelay(timeoutMs: number): number {
  return Math.max(1, Math.min(250, timeoutMs));
}

async function detectRunningApp(appPath: string): Promise<RunningApp> {
  const executable = await executableName(appPath);

  if (!executable) {
    return { pids: [], controlPorts: [] };
  }

  const ps = Bun.spawnSync(['ps', '-axo', 'pid=,comm='], {
    stdout: 'pipe',
    stderr: 'ignore',
  });

  if (ps.exitCode !== 0) {
    return { pids: [], controlPorts: [] };
  }

  const pids = parseProcessList(new TextDecoder().decode(ps.stdout))
    .filter((entry) => basename(entry.command) === executable)
    .map((entry) => entry.pid);

  const controlPorts = new Set<number>();

  for (const pid of pids) {
    const command = Bun.spawnSync(['ps', '-o', 'command=', '-p', String(pid)], {
      stdout: 'pipe',
      stderr: 'ignore',
    });

    if (command.exitCode !== 0) {
      continue;
    }

    for (const port of parseControlPorts(new TextDecoder().decode(command.stdout))) {
      controlPorts.add(port);
    }
  }

  return { pids, controlPorts: [...controlPorts] };
}

async function executableName(appPath: string): Promise<string> {
  try {
    const plist = Bun.spawnSync(
      [
        'plutil',
        '-extract',
        'CFBundleExecutable',
        'raw',
        '-o',
        '-',
        join(appPath, 'Contents', 'Info.plist'),
      ],
      { stdout: 'pipe', stderr: 'ignore' },
    );

    if (plist.exitCode === 0) {
      const name = new TextDecoder().decode(plist.stdout).trim();

      if (name) {
        return name;
      }
    }
  } catch {
    // fall through to the bundle name
  }

  return basename(appPath, '.app');
}

export function normalizeAppPath(appPath: string): string {
  const normalized = appPath.replace(/\/+$/, '');

  return normalized === '' ? '/' : normalized;
}

export function parseProcessList(output: string): ProcessEntry[] {
  const entries: ProcessEntry[] = [];

  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const pid = Number(match[1]);
    const command = match[2]?.trim() ?? '';

    if (Number.isInteger(pid) && pid > 0 && command) {
      entries.push({ pid, command });
    }
  }

  return entries;
}

export function parseControlPorts(command: string): number[] {
  const ports = new Set<number>();

  for (const match of command.matchAll(/--control(?:=|\s+)(\d+)(?!\d)/g)) {
    const port = Number(match[1]);

    if (isValidPort(port)) {
      ports.add(port);
    }
  }

  return [...ports];
}

async function launchApp(appPath: string, controlPort: number): Promise<boolean> {
  try {
    const child = Bun.spawn(['open', '-a', appPath, '--args', '--control', String(controlPort)], {
      stdout: 'ignore',
      stderr: 'pipe',
    });

    if ((await child.exited) === 0) {
      return true;
    }

    const error = new TextDecoder().decode(await new Response(child.stderr).arrayBuffer()).trim();

    log(`could not launch FigCraft${error ? `: ${error}` : ''}`);

    return false;
  } catch (error) {
    log(`could not launch FigCraft: ${error instanceof Error ? error.message : String(error)}`);

    return false;
  }
}

async function portOwnerPids(port: number): Promise<number[]> {
  if (!isValidPort(port)) {
    return [];
  }

  try {
    const lsof = Bun.spawnSync(['lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      stdout: 'pipe',
      stderr: 'ignore',
    });

    if (lsof.exitCode !== 0) {
      return [];
    }

    return new TextDecoder()
      .decode(lsof.stdout)
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

export function isPortOpen(port: number, timeoutMs = 300): Promise<boolean> {
  if (!isValidPort(port)) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let socket: Socket;

    try {
      socket = connect({ host: '127.0.0.1', port });
    } catch {
      resolve(false);

      return;
    }

    let settled = false;

    const finish = (open: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

const defaultDependencies: AppDependencies = {
  detect: detectRunningApp,
  isPortOpen,
  portOwnerPids,
  launch: launchApp,
  sleep: (ms) => Bun.sleep(ms),
};
