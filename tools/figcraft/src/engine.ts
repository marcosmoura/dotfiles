import { existsSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { ensureAppControl } from './app';
import { truncateToBytes } from './bytes';
import { acquireAppLock, type AppLock } from './lock';
import { log } from './logger';
import type { Config } from './settings';
import { changesVariables } from './variables';

export type Command = { command: string; params?: Record<string, unknown>; as?: string };

export type Step = { command: string; result?: unknown };

export type RunResult =
  | { ok: true; steps: Step[] }
  | { ok: false; error: string; failedStep: number | null };

export type RunOptions = {
  /** Save the document after the commands. A failed run never saves. */
  write: boolean;
};

/** Runs FigCraft commands as one all-or-nothing step against the project's design file. */
export type Engine = {
  mode: 'headless' | 'live';
  run(commands: Command[], options: RunOptions): Promise<RunResult>;
  close(): Promise<void>;
};

/** Long enough for FigCraft's "valid keys" lists, which are the useful part of its errors. */
const MAX_ERROR_BYTES = 3_000;

export function shortError(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim();

  return text.length > MAX_ERROR_BYTES ? `${truncateToBytes(text, MAX_ERROR_BYTES)}…` : text;
}

// ---------------------------------------------------------------------------------------------
// Headless: one `figcraft-cli run` process per call. Never starts the app.
// ---------------------------------------------------------------------------------------------

let scriptCounter = 0;

export function createHeadlessEngine(config: Config, file: string): Engine {
  return {
    mode: 'headless',
    close: async () => {},
    async run(commands, { write }) {
      // A missing file starts from a new document, which only makes sense for a write.
      if (!write && !existsSync(file)) {
        return { ok: false, error: `design file not found: ${file}`, failedStep: null };
      }

      await mkdir(config.tempDir, { recursive: true });

      scriptCounter += 1;

      const script = join(config.tempDir, `script-${process.pid}-${scriptCounter}.json`);
      const args = ['run'];

      if (existsSync(file)) {
        args.push('--in', file);
      }

      if (write) {
        args.push('--out', file);
      }

      await Bun.write(script, JSON.stringify(commands));

      try {
        const child = Bun.spawn([config.figcraftBin, ...args, script], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const [stdout, stderr, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);

        return parseRunOutput(stdout, stderr, code);
      } finally {
        await rm(script, { force: true });
      }
    },
  };
}

export function parseRunOutput(stdout: string, stderr: string, code: number): RunResult {
  const steps: Step[] = [];

  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) {
      continue;
    }

    let record: Record<string, unknown>;

    try {
      record = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (typeof record.command !== 'string') {
      continue;
    }

    if (record.ok === false) {
      return {
        ok: false,
        error: shortError(String(record.error ?? 'command failed')),
        failedStep: typeof record.step === 'number' ? record.step : null,
      };
    }

    steps.push({ command: record.command, result: record.result });
  }

  if (code !== 0) {
    return {
      ok: false,
      error: shortError(stderr || stdout || `figcraft-cli exited with ${code}`),
      failedStep: null,
    };
  }

  return { ok: true, steps };
}

// ---------------------------------------------------------------------------------------------
// Session: one headless `figcraft-cli mcp` process that keeps the file open, for a server that
// takes many calls. Loading a large file costs seconds; a command on an open one, milliseconds.
// ---------------------------------------------------------------------------------------------

/** A batch that changes many variables can take minutes on a large file. */
const SESSION_TIMEOUT_MS = 600_000;

export function createSessionEngine(
  config: Config,
  file: string,
  spawn: (config: Config) => LiveProcess = (settings) =>
    Bun.spawn([settings.figcraftBin, 'mcp'], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' }),
): Engine {
  let client: RpcClient | null = null;
  // The file as it was when the session read or wrote it; null before the first read.
  let loaded: string | null = null;

  const onDisk = (): string => {
    try {
      const stat = statSync(file);

      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return 'missing';
    }
  };

  const stop = (): void => {
    client?.stop();
    client = null;
    loaded = null;
  };

  /** Makes the session's document the file as it is on disk now. */
  const sync = async (): Promise<RpcClient> => {
    const current = onDisk();

    if (client && loaded === current) {
      return client;
    }

    // Someone else wrote the file (the app, another tool): start again from what is on disk.
    stop();

    const started = new RpcClient(spawn(config), Math.max(config.requestTimeoutMs, SESSION_TIMEOUT_MS));

    try {
      await started.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'figkit', version: '1' },
      });
      started.notify('notifications/initialized');

      if (current !== 'missing') {
        await started.tool('open_file', { path: file });
      }
    } catch (error) {
      started.stop();
      throw error;
    }

    client = started;
    loaded = current;

    return started;
  };

  const oneOff = createHeadlessEngine(config, file);

  return {
    mode: 'headless',
    async close() {
      stop();
    },
    async run(commands, { write }) {
      if (!write && !existsSync(file)) {
        return { ok: false, error: `design file not found: ${file}`, failedStep: null };
      }

      // FigCraft's recompute after a variable changes takes about twice as long in a session as
      // in a one-off run (45 against 25 seconds on a 200,000-layer file, figcraft-cli 0.17.0),
      // which is more than loading the file again costs. The session follows the file afterwards.
      if (write && commands.some((entry) => changesVariables(entry.command))) {
        return oneOff.run(commands, { write });
      }

      try {
        const session = await sync();
        // A failed batch is rolled back by FigCraft, so the open document stays the saved one.
        const results = await session.tool('batch', { commands, onError: 'abort' });
        const list = Array.isArray(results) ? results : [];

        if (write) {
          await session.tool('save_file', { path: file });
          loaded = onDisk();
        } else {
          const documents = await session.tool('run_command', { command: 'doc.list' });
          const changed =
            Array.isArray(documents) &&
            documents.some((entry: { active?: boolean; dirty?: boolean }) => entry.active && entry.dirty);

          // A run that is not saved must leave no trace, as a one-off process would not.
          if (changed) {
            stop();
          }
        }

        return {
          ok: true,
          steps: commands.map((entry, index) => ({ command: entry.command, result: list[index] })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const step = /step (\d+)/.exec(message);

        // A dead or timed-out process cannot be trusted; a rejected command leaves it usable.
        if (/connection closed|did not respond/.test(message)) {
          stop();
        }

        return { ok: false, error: shortError(message), failedStep: step ? Number(step[1]) : null };
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Live: attached to the open FigCraft app, so edits appear there. Saves after each write.
// ---------------------------------------------------------------------------------------------

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

type LiveProcess = Bun.Subprocess<'pipe', 'pipe', 'inherit'>;

export type LiveDependencies = {
  resolvePort: (config: Config) => Promise<number | null>;
  acquireLock: (port: number) => Promise<AppLock | null>;
  spawn: (config: Config, port: number) => LiveProcess;
};

const liveDefaults: LiveDependencies = {
  resolvePort: ensureAppControl,
  acquireLock: acquireAppLock,
  spawn: (config, port) =>
    Bun.spawn([config.figcraftBin, 'mcp', '--attach', String(port)], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
    }),
};

export async function createLiveEngine(
  config: Config,
  file: string,
  deps: LiveDependencies = liveDefaults,
): Promise<Engine> {
  const port = await deps.resolvePort(config);

  if (port === null) {
    throw new Error(
      'the FigCraft app has no reachable control channel. Quit it and let figkit launch it, ' +
        `or start it as "figcraft --control ${config.controlPort}". Headless mode needs no app.`,
    );
  }

  const lock = await deps.acquireLock(port);

  if (lock === null) {
    throw new Error(`another client is already attached to the FigCraft app on port ${port}.`);
  }

  let child: LiveProcess;

  try {
    child = deps.spawn(config, port);
  } catch (error) {
    await lock.release();
    throw error;
  }

  const client = new RpcClient(child, config.requestTimeoutMs);

  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'figkit', version: '1' },
    });
    client.notify('notifications/initialized');
  } catch (error) {
    client.stop();
    await lock.release();
    throw error;
  }

  log(`attached to the FigCraft app at 127.0.0.1:${port}`);

  let documentReady = false;

  const ensureDocument = async (): Promise<void> => {
    if (documentReady) {
      return;
    }

    const documents = (await client.tool('run_command', { command: 'doc.list' })) as
      | { active?: boolean; path?: string }[]
      | undefined;
    const active = Array.isArray(documents) ? documents.find((entry) => entry.active) : undefined;

    if (active?.path !== file) {
      await client.tool('open_file', { path: file });
    }

    documentReady = true;
  };

  return {
    mode: 'live',
    async close() {
      client.stop();
      await lock.release();
    },
    async run(commands, { write }) {
      try {
        await ensureDocument();

        const results = await client.tool('batch', { commands, onError: 'abort' });
        const list = Array.isArray(results) ? results : [];

        if (write) {
          await client.tool('save_file', {});
        }

        return {
          ok: true,
          steps: commands.map((entry, index) => ({ command: entry.command, result: list[index] })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const step = /step (\d+)/.exec(message);

        return { ok: false, error: shortError(message), failedStep: step ? Number(step[1]) : null };
      }
    },
  };
}

class RpcClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(
    private readonly child: LiveProcess,
    private readonly timeoutMs: number,
  ) {
    void this.pump();
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;

    this.nextId += 1;

    return new Promise((resolve, reject) => {
      const timer =
        this.timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`FigCraft did not respond within ${this.timeoutMs} ms`));
            }, this.timeoutMs)
          : null;

      this.pending.set(id, {
        resolve: (value) => {
          if (timer) clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          if (timer) clearTimeout(timer);
          reject(error);
        },
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string): void {
    this.send({ jsonrpc: '2.0', method });
  }

  /** Calls an upstream MCP tool and returns its JSON payload. Throws on a tool error. */
  async tool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = (await this.request('tools/call', { name, arguments: args })) as {
      isError?: boolean;
      content?: { type?: string; text?: string }[];
    };
    const text = (result.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');

    if (result.isError) {
      throw new Error(text || `${name} failed`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  stop(): void {
    this.failPending();

    try {
      this.child.kill();
    } catch {
      // Already gone.
    }
  }

  private send(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
    this.child.stdin.flush();
  }

  private async pump(): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of this.child.stdout) {
      buffer += decoder.decode(chunk, { stream: true });

      let newline: number;

      while ((newline = buffer.indexOf('\n')) >= 0) {
        this.receive(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }

    this.failPending();
  }

  private failPending(): void {
    for (const entry of this.pending.values()) {
      entry.reject(new Error('the FigCraft connection closed'));
    }

    this.pending.clear();
  }

  private receive(line: string): void {
    if (!line.trim()) {
      return;
    }

    let message: { id?: unknown; result?: unknown; error?: { message?: string } };

    try {
      message = JSON.parse(line) as typeof message;
    } catch {
      return;
    }

    if (typeof message.id !== 'number') {
      return;
    }

    const entry = this.pending.get(message.id);

    if (!entry) {
      return;
    }

    this.pending.delete(message.id);

    if (message.error) {
      entry.reject(new Error(message.error.message ?? 'FigCraft returned an error'));
    } else {
      entry.resolve(message.result);
    }
  }
}
