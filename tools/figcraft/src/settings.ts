import { existsSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export type Config = {
  figcraftBin: string;
  appPath: string;
  useApp: boolean;
  controlPort: number;
  controlWaitMs: number;
  appStartTimeoutMs: number;
  requestTimeoutMs: number;
  /** Byte cap for one `read` result. */
  maxBytes: number;
  /** Longest side, in pixels, of a `shot` image. */
  maxShotSize: number;
  tempDir: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    figcraftBin:
      env.FIGCRAFT_BIN ??
      Bun.which('figcraft-cli') ??
      join(homedir(), '.local/bin', 'figcraft-cli'),
    appPath: env.FIGCRAFT_APP_PATH ?? '/Applications/FigCraft.app',
    useApp: true,
    controlPort: portEnv(env.FIGCRAFT_CONTROL_PORT, 47_800),
    controlWaitMs: integerEnv(env.FIGKIT_CONTROL_WAIT_MS, 3_000),
    appStartTimeoutMs: integerEnv(env.FIGKIT_APP_TIMEOUT_MS, 15_000),
    requestTimeoutMs: integerEnv(env.FIGKIT_REQUEST_TIMEOUT_MS, 120_000),
    maxBytes: integerEnv(env.FIGKIT_MAX_BYTES, 16_384),
    maxShotSize: integerEnv(env.FIGKIT_MAX_SHOT_SIZE, 1_600),
    tempDir: join(env.TMPDIR ?? tmpdir(), 'figkit'),
  };
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

function portEnv(raw: string | undefined, fallback: number): number {
  const value = Number(raw);

  return raw !== undefined && isValidPort(value) ? value : fallback;
}

function integerEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }

  const value = Math.floor(Number(raw));

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** The oldest figcraft-cli with what figkit relies on: node.find, `fields` and variable fills. */
export const MIN_CLI_VERSION = '0.16.0';

const MISE_INSTALLS = join(homedir(), '.local/share/mise/installs/github-storytold-figcraft');

/**
 * Picks the figcraft-cli to run. `FIGCRAFT_BIN` is used as given. Otherwise the one on `PATH`
 * (a project's mise pin) is used when it is recent enough; a stale copy earlier on `PATH` is
 * replaced by the newest mise-installed version rather than failing on missing commands.
 */
export function resolveBin(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
  installs = MISE_INSTALLS,
): string {
  if (env.FIGCRAFT_BIN) {
    return env.FIGCRAFT_BIN;
  }

  const found = cliVersion(config.figcraftBin);

  if (found && compareVersions(found, MIN_CLI_VERSION) >= 0) {
    return config.figcraftBin;
  }

  const newest = newestInstall(installs);

  if (newest) {
    return newest;
  }

  throw new Error(
    `figcraft-cli ${found ?? '(not found)'} at ${config.figcraftBin} is too old; figkit needs ` +
      `${MIN_CLI_VERSION} or newer. Pin it in the project's mise config or set FIGCRAFT_BIN.`,
  );
}

function cliVersion(bin: string): string | null {
  try {
    const result = Bun.spawnSync([bin, '--version'], { stdout: 'pipe', stderr: 'ignore' });
    const match = /(\d+\.\d+\.\d+)/.exec(new TextDecoder().decode(result.stdout));

    return result.exitCode === 0 && match ? (match[1] as string) : null;
  } catch {
    return null;
  }
}

function newestInstall(installs: string): string | null {
  let versions: string[];

  try {
    versions = readdirSync(installs).filter((name) => /^\d+\.\d+\.\d+$/.test(name));
  } catch {
    return null;
  }

  const usable = versions
    .filter((version) => compareVersions(version, MIN_CLI_VERSION) >= 0)
    .sort(compareVersions)
    .reverse()
    .map((version) => join(installs, version, 'figcraft-cli'))
    .filter((path) => existsSync(path));

  return usable[0] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}
