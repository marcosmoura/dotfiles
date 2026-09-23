import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';

import { clearPaneLabel, foregroundBinary, renamePane, renameTab, snapshot } from './herdr.js';
import {
  clean,
  directoryName,
  label,
  terminalTitle,
  type PaneContext,
  tabLabel,
} from './naming.js';
import { sessionTitle } from './session-title.js';
import { load, save } from './state.js';
import type { Pane } from './types.js';

const execFileAsync = promisify(execFile);

async function projectName(pane: Pane): Promise<string> {
  const cwd = pane.foreground_cwd ?? pane.cwd;
  if (!cwd) return directoryName(pane);
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 1_000,
    });
    return basename(stdout.trim()) || directoryName(pane);
  } catch {
    return directoryName(pane);
  }
}

async function context(pane: Pane): Promise<PaneContext> {
  const project = await projectName(pane);
  const binary = pane.agent ?? (await foregroundBinary(pane.pane_id));
  const value =
    clean(pane.title) ??
    (await sessionTitle(pane.agent_session)) ??
    terminalTitle(pane) ??
    binary ??
    project;
  return { label: label(value), binary, project };
}

function isManaged(
  current: string | null | undefined,
  previous: string | undefined,
  defaultLabel = false,
): boolean {
  const normalized = clean(current);
  return !normalized || normalized === previous || (defaultLabel && /^\d+$/.test(normalized));
}

async function main(): Promise<void> {
  const [current, state] = await Promise.all([snapshot(), load()]);
  const panesByTab = new Map<string, Pane[]>();
  for (const pane of current.panes) {
    const panes = panesByTab.get(pane.tab_id) ?? [];
    panes.push(pane);
    panesByTab.set(pane.tab_id, panes);
  }

  for (const tab of current.tabs) {
    const panes = panesByTab.get(tab.tab_id) ?? [];
    if (!panes.length) continue;
    const contexts = await Promise.all(panes.map(context));

    if (panes.length === 1) {
      const pane = panes[0];
      if (pane && state.panes[pane.pane_id] && isManaged(pane.label, state.panes[pane.pane_id])) {
        await clearPaneLabel(pane.pane_id);
        delete state.panes[pane.pane_id];
      }
    } else {
      for (const [index, pane] of panes.entries()) {
        const next = contexts[index]?.label;
        if (next && isManaged(pane.label, state.panes[pane.pane_id]) && pane.label !== next) {
          await renamePane(pane.pane_id, next);
          state.panes[pane.pane_id] = next;
        }
      }
    }

    const next = tabLabel(contexts, current.focused_pane_id, panes);
    if (isManaged(tab.label, state.tabs[tab.tab_id], true) && tab.label !== next) {
      await renameTab(tab.tab_id, next);
      state.tabs[tab.tab_id] = next;
    }
  }

  await save(state);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
