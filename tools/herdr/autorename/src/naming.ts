import { basename } from 'node:path';

import type { Pane } from './types.js';

export interface PaneContext {
  label: string;
  binary?: string;
  project: string;
}

export function clean(value: string | null | undefined): string | undefined {
  const result = value
    ?.replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return result || undefined;
}

export function label(value: string): string {
  return clean(value)?.slice(0, 80) ?? 'terminal';
}

export function directoryName(pane: Pane): string {
  return basename(pane.foreground_cwd ?? pane.cwd ?? 'terminal') || 'terminal';
}

export function displayBinary(binary: string): string {
  return binary ? `${binary[0]?.toUpperCase() ?? ''}${binary.slice(1)}` : 'Terminal';
}

export function terminalTitle(pane: Pane): string | undefined {
  const title = clean(pane.terminal_title_stripped);
  return pane.agent === 'opencode' ? clean(title?.replace(/^OC\s*\|\s*/i, '')) : title;
}

export function tabLabel(
  contexts: PaneContext[],
  focusedPaneID: string | null,
  panes: Pane[],
): string {
  if (contexts.length === 1) return contexts[0]?.label ?? 'terminal';

  const binaries = contexts
    .map((context) => context.binary)
    .filter((binary): binary is string => !!binary);
  if (binaries.length === contexts.length && new Set(binaries).size === 1) {
    return `${displayBinary(binaries[0] ?? '')}: ${contexts.length} sessions`;
  }

  const index = panes.findIndex((pane) => pane.pane_id === focusedPaneID || pane.focused);
  return contexts[index]?.project ?? contexts[0]?.project ?? 'terminal';
}
