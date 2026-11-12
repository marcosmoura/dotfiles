import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createContext } from './context';
import { log } from './logger';
import type { Context } from './ops';
import { findTool, render, TOOLS } from './tools';

type Request = { jsonrpc?: string; id?: string | number; method?: string; params?: unknown };

const PROTOCOL_VERSION = '2024-11-05';

/**
 * A minimal MCP server over stdio. The context is created on the first tool call, so starting the
 * server never launches or attaches to the FigCraft app by itself.
 */
export async function serve(options: { live: boolean }): Promise<number> {
  const state: { context: Promise<Context> | null } = { context: null };

  const handle = async (request: Request): Promise<unknown> => {
    switch (request.method) {
      case 'initialize': {
        const params = (request.params ?? {}) as { protocolVersion?: string };

        return {
          protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'figkit', version: '1.0.0' },
        };
      }

      case 'ping':
        return {};

      case 'tools/list':
        return {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: { readOnlyHint: tool.readOnly },
          })),
        };

      case 'tools/call': {
        const params = (request.params ?? {}) as { name?: string; arguments?: unknown };
        const tool = findTool(String(params.name));

        if (!tool) {
          throw new RpcError(-32602, `unknown tool "${params.name}"`);
        }

        const started = Date.now();
        let text: string;
        let failed = false;

        try {
          // A server takes many calls, so headless work keeps the file open between them.
          state.context ??= createContext({ ...options, session: true });

          const args = await fromFile(
            tool.name,
            params.arguments && typeof params.arguments === 'object'
              ? (params.arguments as Record<string, unknown>)
              : {},
          );

          text = render(await tool.call(await state.context, args));
        } catch (error) {
          // A failed attach should be retried on the next call rather than cached.
          await state.context?.catch(() => {
            state.context = null;
          });

          failed = true;
          text = error instanceof Error ? error.message : String(error);
        }

        await record(state.context, {
          at: new Date(started).toISOString(),
          pid: process.pid,
          tool: tool.name,
          ms: Date.now() - started,
          ok: !failed,
          bytes: text.length,
        });

        return failed
          ? { isError: true, content: [{ type: 'text', text }] }
          : { content: [{ type: 'text', text }] };
      }

      default:
        throw new RpcError(-32601, `method not found: ${request.method}`);
    }
  };

  // Tool calls run one at a time: FigCraft has one document and one writer.
  let queue: Promise<void> = Promise.resolve();

  for await (const line of lines(Bun.stdin.stream())) {
    let request: Request;

    try {
      request = JSON.parse(line) as Request;
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      continue;
    }

    if (request.id === undefined) {
      continue; // A notification needs no answer.
    }

    queue = queue.then(async () => {
      try {
        send({ jsonrpc: '2.0', id: request.id, result: await handle(request) });
      } catch (error) {
        const code = error instanceof RpcError ? error.code : -32603;
        const message = error instanceof Error ? error.message : String(error);

        send({ jsonrpc: '2.0', id: request.id, error: { code, message } });
      }
    });
  }

  await queue;

  if (state.context) {
    try {
      await (await state.context).engine.close();
    } catch (error) {
      log(`could not close the engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return 0;
}

/**
 * `file` names a JSON file holding the input, so a generated tree or command list is not pasted
 * into the call. The other arguments override its keys.
 */
async function fromFile(
  tool: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { file, ...rest } = args;

  if (typeof file !== 'string') {
    return args;
  }

  const parsed = JSON.parse(await Bun.file(file).text()) as unknown;
  const input = Array.isArray(parsed)
    ? { [tool === 'run' ? 'commands' : 'tree']: parsed }
    : (parsed as Record<string, unknown>);

  return { ...input, ...rest };
}

/**
 * Appends one line per tool call to `calls.jsonl` in the temp folder: the time spent in figkit.
 * A client's transcript cannot show that, because the gap between a call and its result also
 * holds the client's own work, such as a permission check.
 */
async function record(context: Promise<Context> | null, entry: Record<string, unknown>): Promise<void> {
  try {
    const { tempDir } = ((await context) as Context).config;

    await mkdir(tempDir, { recursive: true });
    await appendFile(join(tempDir, 'calls.jsonl'), `${JSON.stringify(entry)}\n`);
  } catch {
    // The log is a diagnostic: a call never fails because of it.
  }
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });

    let newline: number;

    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();

      buffer = buffer.slice(newline + 1);

      if (line) {
        yield line;
      }
    }
  }

  if (buffer.trim()) {
    yield buffer.trim();
  }
}
