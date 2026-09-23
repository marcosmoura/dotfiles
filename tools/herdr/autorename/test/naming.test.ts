import { expect, test } from 'bun:test';

import { tabLabel, terminalTitle } from '../src/naming.js';

const pane = (paneID: string, focused = false) => ({
  pane_id: paneID,
  tab_id: 'w1:t1',
  focused,
});

test('uses the single pane context as the tab label', () => {
  expect(
    tabLabel([{ label: 'Review config', binary: 'opencode', project: 'dotfiles' }], 'p1', [
      pane('p1'),
    ]),
  ).toBe('Review config');
});

test('summarizes tabs that run one binary', () => {
  expect(
    tabLabel(
      [
        { label: 'First session', binary: 'opencode', project: 'dotfiles' },
        { label: 'Second session', binary: 'opencode', project: 'dotfiles' },
      ],
      'p1',
      [pane('p1', true), pane('p2')],
    ),
  ).toBe('Opencode: 2 sessions');
});

test('uses the focused pane project for mixed tabs', () => {
  expect(
    tabLabel(
      [
        { label: 'npm', binary: 'npm', project: 'api' },
        { label: 'vim', binary: 'vim', project: 'web' },
      ],
      'p2',
      [pane('p1'), pane('p2', true)],
    ),
  ).toBe('web');
});

test('removes the OpenCode terminal title prefix', () => {
  expect(
    terminalTitle({
      ...pane('p1'),
      agent: 'opencode',
      terminal_title_stripped: 'OC | Review tabs',
    }),
  ).toBe('Review tabs');
});
