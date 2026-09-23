import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { clean } from './naming.js';
import type { AgentSession } from './types.js';

const execFileAsync = promisify(execFile);

async function sqlite(database: string, query: string, id: string): Promise<string | undefined> {
  if (!existsSync(database)) return undefined;
  try {
    const escapedID = id.replaceAll("'", "''");
    const { stdout } = await execFileAsync(
      'sqlite3',
      ['-noheader', database, query.replace('?', `'${escapedID}'`)],
      {
        encoding: 'utf8',
        timeout: 1_000,
      },
    );
    return clean(stdout);
  } catch {
    return undefined;
  }
}

async function openCodeTitle(id: string): Promise<string | undefined> {
  return sqlite(
    join(process.env.HOME ?? '', '.local/share/opencode/opencode.db'),
    'SELECT title FROM session_v2 WHERE id = ? LIMIT 1;',
    id,
  );
}

function codexTitle(id: string): string | undefined {
  const path = join(process.env.HOME ?? '', '.codex/session_index.jsonl');
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    try {
      const entry = JSON.parse(line) as { id?: string; thread_name?: string };
      if (entry.id === id) return clean(entry.thread_name);
    } catch {
      // Ignore a partially-written index line.
    }
  }
  return undefined;
}

function compact(value: unknown): string | undefined {
  return clean(String(value ?? ''))?.replace(/^[/›>]\s*/, '');
}

async function claudeTitle(id: string): Promise<string | undefined> {
  const root = join(process.env.HOME ?? '', '.claude/projects');
  if (!existsSync(root)) return undefined;
  try {
    const { stdout } = await execFileAsync('find', [root, '-type', 'f', '-name', `${id}.jsonl`], {
      encoding: 'utf8',
      timeout: 1_000,
    });
    const path = stdout.split('\n').find(Boolean);
    if (!path) return undefined;

    let latest: string | undefined;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      try {
        const entry = JSON.parse(line) as {
          type?: string;
          isMeta?: boolean;
          message?: { content?: string | Array<{ text?: string } | string> };
        };
        if (entry.type !== 'user' || entry.isMeta) continue;
        const content = Array.isArray(entry.message?.content)
          ? entry.message.content
              .map((part) => (typeof part === 'string' ? part : part.text))
              .join(' ')
          : entry.message?.content;
        const title = compact(content);
        if (title && !title.startsWith('/clear') && !title.startsWith('<local-command'))
          latest = title;
      } catch {
        // Ignore a partially-written session line.
      }
    }
    return latest;
  } catch {
    return undefined;
  }
}

export async function sessionTitle(
  session: AgentSession | null | undefined,
): Promise<string | undefined> {
  if (!session) return undefined;
  if (session.agent === 'opencode') return openCodeTitle(session.value);
  if (session.agent === 'codex') return codexTitle(session.value);
  if (session.agent === 'claude') return claudeTitle(session.value);
  return undefined;
}
