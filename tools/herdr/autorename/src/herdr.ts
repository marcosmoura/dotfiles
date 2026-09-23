import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Snapshot } from './types.js';

const execFileAsync = promisify(execFile);

function herdr(): string {
  return process.env.HERDR_BIN_PATH ?? 'herdr';
}

async function command(args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(herdr(), args, { encoding: 'utf8', timeout: 5_000 });
  return stdout.trim() ? JSON.parse(stdout) : undefined;
}

export async function snapshot(): Promise<Snapshot> {
  const response = (await command(['api', 'snapshot'])) as { result?: { snapshot?: Snapshot } };
  const result = response.result?.snapshot;
  if (!result) throw new Error('herdr did not return a session snapshot');
  return result;
}

export async function renamePane(paneID: string, label: string): Promise<void> {
  await command(['pane', 'rename', paneID, label]);
}

export async function clearPaneLabel(paneID: string): Promise<void> {
  await command(['pane', 'rename', paneID, '--clear']);
}

export async function renameTab(tabID: string, label: string): Promise<void> {
  await command(['tab', 'rename', tabID, label]);
}

export async function foregroundBinary(paneID: string): Promise<string | undefined> {
  const response = (await command(['pane', 'process-info', '--pane', paneID])) as {
    result?: { process_info?: { foreground_processes?: Array<{ name?: string; argv0?: string }> } };
  };
  const process = response.result?.process_info?.foreground_processes?.at(-1);
  const name = process?.name ?? process?.argv0;
  return name && !['bash', 'sh', 'zsh', 'fish', 'nu'].includes(name) ? name : undefined;
}
