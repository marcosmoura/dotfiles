import { describe, expect, test } from 'bun:test';

import { collectOverrides, planRestore, type Layer, type Override } from './overrides';

const map = (list: Layer[]): Map<number, Layer> => new Map(list.map((layer) => [layer.id, layer]));
const text = (id: number, name: string, characters: string, overrides?: string[]): Layer => ({
  id,
  name,
  type: 'TEXT',
  children: [],
  characters,
  overrides,
});
const frame = (id: number, name: string, children: number[], more: Partial<Layer> = {}): Layer => ({
  id,
  name,
  type: 'FRAME',
  children,
  ...more,
});

/** A doc frame with a group instance that holds two row instances; the first has a bar instance. */
function saved(): Map<number, Layer> {
  return map([
    frame(1, 'Doc', [10, 20]),
    { id: 10, name: 'Group', type: 'INSTANCE', children: [11], overrides: ['props'] },
    frame(11, 'Rows', [2, 12]),
    { id: 2, name: 'Row', type: 'INSTANCE', children: [3, 4, 5, 6, 7], overrides: ['props'] },
    frame(3, 'Assigned', [31]),
    text(31, 'Total', '€1.00', ['characters']),
    frame(4, 'Activity', [41]),
    text(41, 'Total', '€0.00'),
    frame(5, 'Available', [51]),
    text(51, 'Total', '€3.00', ['characters', 'textStyle']),
    frame(6, 'Dot', [], { boundVariables: { fill: 'color/group/3' }, overrides: ['fills'] }),
    { id: 7, name: 'Bar', type: 'INSTANCE', children: [8], overrides: ['props'] },
    frame(8, 'Solid', [], { width: 146.3, height: 4, overrides: ['size'] }),
    { id: 12, name: 'Row', type: 'INSTANCE', children: [13] },
    frame(13, 'Assigned', [131]),
    text(131, 'Total', '€7.00', ['characters']),
    text(20, 'Plain', 'Not in an instance', ['characters']),
  ]);
}

/**
 * The same doc after the row component was rebuilt: the layers inside the first row have new ids,
 * the bar instance too, a field with its own "Total" was added before the others, "Available" is
 * gone and the dot sits in a new box.
 */
function rebuilt(): Map<number, Layer> {
  return map([
    { id: 10, name: 'Group', type: 'INSTANCE', children: [11] },
    frame(11, 'Rows', [2, 12]),
    { id: 2, name: 'Row', type: 'INSTANCE', children: [60, 61, 62, 66, 37] },
    frame(60, 'Field', [601]),
    text(601, 'Total', '€0.50'),
    frame(61, 'Assigned', [611]),
    text(611, 'Total', '€9.99'),
    frame(62, 'Activity', [621]),
    text(621, 'Total', '€0.00'),
    frame(66, 'Dot box', [661]),
    frame(661, 'Dot', [], { boundVariables: { fill: 'color/group/1' } }),
    { id: 37, name: 'Bar', type: 'INSTANCE', children: [38] },
    frame(38, 'Solid', [], { width: 193.14, height: 4 }),
    { id: 12, name: 'Row', type: 'INSTANCE', children: [13] },
    frame(13, 'Assigned', [131]),
    text(131, 'Total', '€7.00'),
  ]);
}

describe('collectOverrides', () => {
  test('names each overridden layer by the instances it is in, its name, type and parent', () => {
    const { entries, skipped } = collectOverrides(saved(), [1]);

    expect(entries).toEqual([
      {
        instance: 2,
        layer: 'Total',
        type: 'TEXT',
        parent: 'Assigned',
        index: 0,
        outer: [[10, 0]],
        characters: '€1.00',
      },
      {
        instance: 2,
        layer: 'Total',
        type: 'TEXT',
        parent: 'Available',
        index: 0,
        outer: [[10, 0]],
        characters: '€3.00',
      },
      {
        instance: 2,
        layer: 'Dot',
        type: 'FRAME',
        parent: 'Row',
        index: 0,
        outer: [[10, 0]],
        fill: 'color/group/3',
      },
      // Inside the bar instance, which is inside the row, which is inside the group.
      {
        instance: 7,
        layer: 'Solid',
        type: 'FRAME',
        parent: 'Bar',
        index: 0,
        outer: [
          [2, 0],
          [10, 0],
        ],
        width: 146.3,
        height: 4,
      },
      // The second row's total is the second one under an "Assigned" in the group.
      {
        instance: 12,
        layer: 'Total',
        type: 'TEXT',
        parent: 'Assigned',
        index: 0,
        outer: [[10, 1]],
        characters: '€7.00',
      },
    ]);
    // A layer outside every instance has no override; the kinds that are not saved are counted.
    expect(skipped).toEqual({ props: 2, textStyle: 1 });
  });
});

describe('planRestore', () => {
  test('finds each layer again under new ids and changes only what differs', () => {
    const { commands, report } = planRestore(collectOverrides(saved(), [1]).entries, rebuilt());

    expect(commands).toEqual([
      // Not the field's new "Total", which has another parent.
      { command: 'node.set', params: { ids: [611], characters: '€1.00' } },
      // The dot has a new parent and is the only layer of its name.
      { command: 'variable.bind', params: { ids: [661], field: 'fill', variable: 'color/group/3' } },
      // The bar instance is new, so the layer is found from the row. Its height is as saved.
      { command: 'node.set', params: { ids: [38], width: 146.3 } },
    ]);
    // The total under "Available" is gone, and no other "Total" is taken for it.
    expect(report).toEqual({ set: 3, unchanged: 1, missing: { 'TEXT "Total" in "Available"': 1 } });
  });

  test('falls back to an outer instance when the inner ones are gone', () => {
    const entry: Override = {
      instance: 999,
      layer: 'Total',
      type: 'TEXT',
      parent: 'Assigned',
      index: 0,
      outer: [[10, 1]],
      characters: '€8.00',
    };

    expect(planRestore([entry], rebuilt()).commands).toEqual([
      { command: 'node.set', params: { ids: [131], characters: '€8.00' } },
    ]);
    expect(planRestore([{ ...entry, outer: [[998, 0]] }], rebuilt()).report).toEqual({
      set: 0,
      unchanged: 0,
      missing: { 'instance 999': 1 },
    });
  });

  test('takes a table written by hand and refuses what it cannot place for certain', () => {
    const now = rebuilt();

    // Without a parent, the index counts every layer of that name in the instance.
    expect(
      planRestore(
        [
          { instance: 2, layer: 'Total', index: 2, characters: '€2.00' },
          { instance: 2, layer: 'Solid', width: 10 },
        ],
        now,
      ).commands,
    ).toEqual([
      { command: 'node.set', params: { ids: [621], characters: '€2.00' } },
      { command: 'node.set', params: { ids: [38], width: 10 } },
    ]);
    expect(() => planRestore([{ instance: 2, layer: 'Total', characters: 'x' }], now)).toThrow(
      'override 0: instance 2 has 3 layers named "Total". Give "index", from 0 to 2',
    );
    expect(() => planRestore([{ instance: 2, layer: 'Dot' }], now)).toThrow('override 0 sets nothing');
    expect(() => planRestore([{ layer: 'Dot', fill: 'x' } as Override], now)).toThrow(
      'override 0 needs an "instance" id',
    );
  });
});
