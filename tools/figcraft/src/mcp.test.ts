import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, resolveBin } from './settings';

type Reply = {
  id: number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const CLI = join(import.meta.dir, 'cli.ts');

let directory = '';
let file = '';

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'figkit-mcp-'));
  file = join(directory, 'scratch.figcraft');
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** Runs the server as a client would: one process, lines in, lines out. */
async function converse(lines: (string | object)[]): Promise<{ replies: Reply[]; raw: string }> {
  const child = Bun.spawn(['bun', CLI, 'mcp'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'ignore',
    env: { ...process.env, FIGKIT_FILE: file, FIGKIT_LOG: '0', TMPDIR: directory },
  });

  for (const line of lines) {
    child.stdin.write(`${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
  }

  child.stdin.end();

  const raw = await new Response(child.stdout).text();

  expect(await child.exited).toBe(0);

  return { raw, replies: raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Reply) };
}

const request = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

const call = (id: number, name: string, args: unknown) =>
  request(id, 'tools/call', { name, arguments: args });

function text(reply: Reply | undefined): string {
  const content = (reply?.result?.content ?? []) as { text: string }[];

  return content.map((part) => part.text).join('\n');
}

describe('mcp server protocol', () => {
  test('answers initialize, ping and tools/list', async () => {
    const { replies } = await converse([
      request(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {} }),
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      request(2, 'ping'),
      request(3, 'tools/list'),
    ]);

    // The notification gets no reply.
    expect(replies.map((reply) => reply.id)).toEqual([1, 2, 3]);
    expect(replies[0]?.result).toMatchObject({
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'figkit' },
    });
    expect(replies[1]?.result).toEqual({});

    const tools = replies[2]?.result?.tools as {
      name: string;
      description: string;
      inputSchema: { type: string; properties: object };
      annotations: { readOnlyHint: boolean };
    }[];

    expect(tools.map((tool) => tool.name)).toEqual(['find', 'read', 'build', 'run', 'shot', 'help']);

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeObject();
    }

    expect(tools.filter((tool) => !tool.annotations.readOnlyHint).map((tool) => tool.name)).toEqual([
      'build',
      'run',
    ]);
  });

  test('keeps the tool list small', async () => {
    const { replies } = await converse([request(1, 'tools/list')]);

    // The old proxy forwarded 32 KB of schemas. This budget is what every session pays.
    expect(JSON.stringify(replies[0]?.result?.tools).length).toBeLessThan(6_000);
  });

  test('reports protocol errors without stopping', async () => {
    const { replies } = await converse([
      '{not json',
      request(1, 'resources/list'),
      call(2, 'nope', {}),
      request(3, 'ping'),
    ]);
    const byId = new Map(replies.map((reply) => [reply.id, reply]));

    expect(byId.get(null)?.error?.code).toBe(-32700);
    expect(byId.get(1)?.error).toMatchObject({ code: -32601 });
    expect(byId.get(2)?.error).toMatchObject({ code: -32602, message: 'unknown tool "nope"' });
    expect(byId.get(3)?.result).toEqual({});
  });

  test('returns a bad tree as a tool error, not a protocol error', async () => {
    const { replies } = await converse([call(1, 'build', { tree: { frame: 'A', nope: 1 } })]);

    expect(replies[0]?.error).toBeUndefined();
    expect(replies[0]?.result?.isError).toBe(true);
    expect(text(replies[0])).toContain('unknown key "nope"');
  });

  test('writes only JSON-RPC lines to stdout', async () => {
    const { raw } = await converse([request(1, 'ping'), call(2, 'help', {})]);

    for (const line of raw.trim().split('\n')) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' });
    }
  });
});

let hasCli = false;

try {
  hasCli = existsSync(resolveBin(loadConfig()));
} catch {
  // No usable figcraft-cli on this machine: the tool-call tests are skipped.
}

describe.skipIf(!hasCli)('mcp server tool calls', () => {
  test('builds, reads back and exports through tools/call in one session', async () => {
    const { replies } = await converse([
      call(1, 'build', {
        tree: {
          frame: 'Card',
          w: 200,
          gap: 8,
          fill: '#336699',
          children: [{ text: 'Hello', as: 'title' }],
        },
      }),
      call(2, 'find', { name: 'Card' }),
      call(3, 'help', { query: 'node.get' }),
    ]);

    expect(replies.map((reply) => reply.id)).toEqual([1, 2, 3]);

    const built = JSON.parse(text(replies[0])) as { root: number; layers: number; ids: { title: number } };

    expect(replies[0]?.result?.isError).toBeUndefined();
    expect(built.layers).toBe(2);
    expect(text(replies[1])).toStartWith(`${built.root}\tFRAME\t200×`);
    expect(text(replies[2])).toStartWith('node.get: Get layer');

    // A second session sees what the first one saved.
    const second = await converse([
      call(1, 'read', { id: built.root }),
      call(2, 'shot', { ids: [built.root] }),
      call(3, 'run', { commands: [{ command: 'node.set', params: { ids: [999_999_999], name: 'x' } }] }),
    ]);
    const outline = JSON.parse(text(second.replies[0])) as { name: string; children: { id: number }[] };

    expect(outline.name).toBe('Card');
    expect(outline.children.map((child) => child.id)).toEqual([built.ids.title]);

    const shot = text(second.replies[1]);

    expect(shot.split('\t')[0]).toEndWith('.png');
    expect(existsSync(shot.split('\t')[0] as string)).toBe(true);
    // An image is a path, never inline data.
    expect(JSON.stringify(second.replies[1]).length).toBeLessThan(500);

    expect(second.replies[2]?.result?.isError).toBe(true);
    expect(text(second.replies[2])).toContain('nothing was changed');

    // The session keeps the file open, so a change that is not saved must not stay in it.
    const third = await converse([
      call(1, 'run', {
        write: false,
        commands: [{ command: 'node.set', params: { ids: [built.root], opacity: 0.25 } }],
      }),
      call(2, 'read', { id: built.root, fields: ['opacity'] }),
      call(3, 'shot', { ids: [built.root], scale: 1 }),
    ]);

    expect(third.replies[0]?.result?.isError).toBeUndefined();
    // FigCraft leaves a default value out, so full opacity reads as no value at all.
    expect((JSON.parse(text(third.replies[1])) as { opacity?: number }).opacity ?? 1).toBe(1);
    expect(text(third.replies[2]).split('\t')[0]).toEndWith('.png');
  }, 60_000);
});
