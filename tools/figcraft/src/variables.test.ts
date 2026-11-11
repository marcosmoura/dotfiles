import { describe, expect, test } from 'bun:test';

import type { Command } from './engine';
import { mergeVariableCommands, worthMerging, type VariableSnapshot } from './variables';

const snapshot = (): VariableSnapshot => ({
  variableCollections: {
    'C:1': {
      id: 'C:1',
      name: 'Viewport',
      defaultModeId: 'C:1/m1',
      modes: [
        { modeId: 'C:1/m1', name: 'Mobile' },
        { modeId: 'C:1/m2', name: 'Desktop' },
      ],
    },
  },
  variables: {
    'V:1': {
      id: 'V:1',
      name: 'size/column',
      resolvedType: 'FLOAT',
      variableCollectionId: 'C:1',
      valuesByMode: { 'C:1/m1': 10, 'C:1/m2': 20 },
    },
  },
});

const set = (variable: string, mode: string, value: unknown): Command => ({
  command: 'variable.set',
  params: { variable, mode, value },
});
const create = (name: string, values: Record<string, unknown>): Command => ({
  command: 'variable.create',
  params: { collection: 'Viewport', name, type: 'number', values },
});
const bind: Command = { command: 'variable.bind', params: { ids: [1], field: 'gap' } };

type Payload = { variables: Record<string, { name: string; valuesByMode: object }> };

const imported = (command: Command | undefined) =>
  Object.values((command?.params?.variables as Payload).variables).map((entry) => ({
    name: entry.name,
    values: entry.valuesByMode,
  }));

describe('mergeVariableCommands', () => {
  test('folds creates and sets into one import where the first one was', () => {
    const commands = [
      bind,
      set('size/column', 'Mobile', 12),
      bind,
      create('size/wide', { Mobile: 1, Desktop: 2 }),
      set('size/wide', 'Desktop', 3),
    ];
    const merged = mergeVariableCommands(commands, snapshot());

    expect(merged.commands.map((entry) => entry.command)).toEqual([
      'variable.bind',
      'variable.import',
      'variable.bind',
    ]);
    expect(merged.stepOf).toEqual([0, 1, 2, 1, 1]);
    // Every mode is written, since an import fills a missing one from another.
    expect(imported(merged.commands[1])).toEqual([
      { name: 'size/column', values: { 'C:1/m1': 12, 'C:1/m2': 20 } },
      { name: 'size/wide', values: { 'C:1/m1': 1, 'C:1/m2': 3 } },
    ]);
  });

  test('a rename starts a new import that uses the new name', () => {
    const rename: Command = {
      command: 'variable.update',
      params: { variable: 'size/column', name: 'size/min' },
    };
    const merged = mergeVariableCommands(
      [
        set('size/column', 'Mobile', 1),
        set('size/column', 'Desktop', 2),
        rename,
        set('size/min', 'Mobile', 3),
        set('size/min', 'Desktop', 4),
      ],
      snapshot(),
    );

    expect(merged.commands.map((entry) => entry.command)).toEqual([
      'variable.import',
      'variable.update',
      'variable.import',
    ]);
    expect(imported(merged.commands[0])).toEqual([
      { name: 'size/column', values: { 'C:1/m1': 1, 'C:1/m2': 2 } },
    ]);
    expect(imported(merged.commands[2])).toEqual([
      { name: 'size/min', values: { 'C:1/m1': 3, 'C:1/m2': 4 } },
    ]);
  });

  test('leaves what it cannot account for as written', () => {
    const cases: Command[][] = [
      // An unknown variable, an unknown mode and a value of the wrong type.
      [set('missing', 'Mobile', 1), set('size/column', 'Mobile', 1)],
      [set('size/column', 'Tablet', 1), set('size/column', 'Mobile', 1)],
      [set('size/column', 'Mobile', { alias: 'x' }), set('size/column', 'Desktop', 1)],
      // A create that leaves a mode out, and one whose id a later step may use.
      [create('a', { Mobile: 1 }), create('b', { Mobile: 1, Desktop: 2 })],
      [{ ...create('a', { Mobile: 1, Desktop: 2 }), as: 'a' }, set('size/column', 'Mobile', 1)],
      // Anything else that changes variables.
      [
        { command: 'variable.delete', params: { variable: 'size/column' } },
        create('a', { Mobile: 1, Desktop: 2 }),
        create('b', { Mobile: 1, Desktop: 2 }),
      ],
      // One command alone gains nothing from an import.
      [bind, set('size/column', 'Mobile', 1)],
    ];

    for (const commands of cases) {
      const merged = mergeVariableCommands(commands, snapshot());

      expect(merged.commands).toEqual(commands);
      expect(merged.stepOf).toEqual(commands.map((_, index) => index));
    }
  });

  test('is only worth it for two or more plain creates and sets', () => {
    expect(worthMerging([set('a', 'Mobile', 1), bind])).toBe(false);
    expect(worthMerging([set('a', 'Mobile', 1), create('b', { Mobile: 1 })])).toBe(true);
  });
});
