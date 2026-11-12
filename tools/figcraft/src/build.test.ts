import { describe, expect, test } from 'bun:test';

import { expandTree, TreeError, UnknownName, type TreeNode } from './build';

const components: Record<string, number> = { 'Icon/Wallet': 500 };
const options = { component: (name: string) => components[name] ?? null };

const card: TreeNode = {
  frame: 'Card',
  layout: 'vertical',
  gap: 'space/16',
  pad: ['space/24', 'space/32'],
  fill: 'color/surface/card',
  radius: 'radius/card',
  w: 'fill',
  children: [
    { text: 'Title', style: 'Docs/Heading', fill: 'color/text/primary', as: 'title' },
    { instance: 'Icon/Wallet', mode: { 'Icon size': '16' } },
  ],
};

describe('expandTree', () => {
  test('turns a styled frame into create, binds and sizing', () => {
    const { commands, roots, layers } = expandTree({ frame: 'Card', gap: 'space/16', pad: 8 }, options);

    expect(layers).toBe(1);
    expect(roots).toEqual([0]);
    expect(commands).toEqual([
      {
        command: 'node.create',
        as: 'n1',
        params: { type: 'frame', name: 'Card', props: { layout: 'vertical', fills: [], padding: 8 } },
      },
      {
        command: 'variable.bind',
        params: { ids: [{ $ref: 'n1' }], field: 'gap', variable: 'space/16' },
      },
      { command: 'node.set', params: { ids: [{ $ref: 'n1' }], sizingH: 'hug', sizingV: 'hug' } },
    ]);
  });

  test('builds children under their parent and reports named layers', () => {
    const expansion = expandTree(card, options);
    const create = expansion.commands[0];

    expect(create?.params).toMatchObject({
      type: 'frame',
      name: 'Card',
      props: { layout: 'vertical', fill: { $var: 'color/surface/card' } },
    });
    expect(expansion.layers).toBe(3);

    const title = expansion.commands[expansion.named.title as number];

    expect(title).toMatchObject({
      command: 'node.create',
      params: { type: 'text', characters: 'Title', parent: { $ref: 'n1' } },
    });

    const instance = expansion.commands.find((entry) => entry.command === 'instance.create');

    expect(instance?.params).toEqual({ component: 500, parent: { $ref: 'n1' } });
    expect(expansion.commands.some((entry) => entry.command === 'variable.setMode')).toBe(true);
  });

  test('binds strings and sets numbers', () => {
    const { commands } = expandTree(
      { frame: 'Box', gap: 12, pad: [8, 'space/16'], radius: 4, w: 320, h: 'size/row' },
      options,
    );
    const binds = commands
      .filter((entry) => entry.command === 'variable.bind')
      .map((entry) => [entry.params?.field, entry.params?.variable]);

    expect(commands[0]?.params).toMatchObject({
      width: 320,
      props: { gap: 12, paddingTop: 8, paddingBottom: 8, cornerRadius: 4 },
    });
    expect(binds).toEqual([
      ['paddingHorizontal', 'space/16'],
      ['height', 'size/row'],
    ]);
    expect(commands.at(-1)?.params).toMatchObject({ sizingH: 'fixed', sizingV: 'hug' });
  });

  test('treats hex colours as raw and other strings as variables', () => {
    const { commands, uses } = expandTree(
      { shape: 'rectangle', w: 10, h: 10, fill: '#ff0000', stroke: 'color/border' },
      options,
    );

    expect(commands[0]?.params?.props).toEqual({ fill: '#ff0000', stroke: { $var: 'color/border' } });
    expect(uses.get(0)).toEqual([{ kind: 'variable', name: 'color/border' }]);
  });

  test('sizes text by its width', () => {
    const fill = expandTree({ text: 'A', w: 'fill' }, options).commands;
    const fixed = expandTree({ text: 'A', w: 200 }, options).commands;
    const auto = expandTree({ text: 'A' }, options).commands;

    expect(fill[1]?.params).toMatchObject({ sizingH: 'fill', textAutoResize: 'height' });
    expect(fixed[1]?.params).toMatchObject({ width: 200, textAutoResize: 'height' });
    expect(fixed[2]?.params).toMatchObject({ sizingH: 'fixed' });
    expect(auto[1]?.params).toMatchObject({ textAutoResize: 'widthAndHeight' });
  });

  test('places top-level layers under a parent and at a position', () => {
    const { commands, roots } = expandTree([{ frame: 'A' }, { frame: 'B' }], {
      ...options,
      parent: 7,
      at: [100, 200],
    });

    expect(roots.map((index) => commands[index]?.params)).toMatchObject([
      { name: 'A', parent: 7, x: 100, y: 200 },
      { name: 'B', parent: 7, x: 100, y: 200 },
    ]);
  });

  test('sets variable modes on any kind of layer', () => {
    const { commands } = expandTree({ frame: 'A', mode: { 'Dynamic Type': 'AX3' } }, options);

    expect(commands.at(-1)).toEqual({
      command: 'variable.setMode',
      params: { ids: [{ $ref: 'n1' }], collection: 'Dynamic Type', mode: 'AX3' },
    });
  });

  test("colours an icon's glyph, found inside the new instance", () => {
    const { commands, uses } = expandTree({ instance: 'Icon/Wallet', glyph: 'color/icon/secondary' }, options);
    const find = commands.find((entry) => entry.command === 'node.find');
    const bind = commands.findLast((entry) => entry.command === 'variable.bind');

    expect(find).toEqual({
      command: 'node.find',
      as: 'n1-glyph',
      params: { root: { $ref: 'n1' }, name: 'Glyph', limit: 1 },
    });
    expect(bind?.params).toEqual({
      ids: [{ $ref: 'n1-glyph', field: 'ids/0' }],
      field: 'stroke',
      variable: 'color/icon/secondary',
    });
    expect([...uses.values()].flat().map((use) => use.name)).toContain('color/icon/secondary');
  });

  test("sets an instance's swaps in a call of their own, after its other properties", () => {
    const { commands } = expandTree(
      {
        instance: 'Icon/Wallet',
        properties: { Sign: 'Negative', Icon: 52925, Name: 'Car Loan', 'Show Base?': true },
      },
      options,
    );
    const sets = commands.filter((entry) => entry.command === 'instance.setProperties');

    expect(sets.map((entry) => entry.params?.properties)).toEqual([
      { Sign: 'Negative', Name: 'Car Loan', 'Show Base?': true },
      { Icon: 52925 },
    ]);
  });

  test('sets the properties of an instance in one call when none is a swap', () => {
    const { commands } = expandTree(
      { instance: 'Icon/Wallet', properties: { Sign: 'Negative', Name: 'Car Loan' } },
      options,
    );

    expect(commands.filter((entry) => entry.command === 'instance.setProperties')).toHaveLength(1);
  });

  test("sets a frame's mode once its children exist, and before it is sized to them", () => {
    const { commands } = expandTree(
      {
        frame: 'Stage',
        mode: { 'Dynamic Type': 'AX3' },
        children: [{ instance: 'Icon/Wallet', w: 'fill' }],
      },
      options,
    );
    const order = commands.map((entry) => entry.command);
    const mode = order.indexOf('variable.setMode');
    const hug = commands.findLastIndex(
      (entry) => entry.command === 'node.set' && entry.params?.sizingH === 'hug',
    );

    expect(mode).toBeGreaterThan(order.indexOf('instance.create'));
    expect(hug).toBeGreaterThan(mode);
    expect(commands[mode]?.params).toEqual({
      ids: [{ $ref: 'n1' }],
      collection: 'Dynamic Type',
      mode: 'AX3',
    });
  });

  test('builds a top-level node inside its own parent, at its place there', () => {
    const { commands } = expandTree(
      [{ frame: 'Section', parent: 7, index: 2 }, { frame: 'Note' }],
      { ...options, parent: 9 },
    );
    const created = commands.filter((entry) => entry.command === 'node.create');

    expect(created.map((entry) => entry.params?.parent)).toEqual([7, 9]);
    expect(commands.find((entry) => entry.command === 'node.reparent')?.params).toEqual({
      ids: [{ $ref: 'n1' }],
      parent: 7,
      index: 2,
    });
    expect(() => expandTree({ frame: 'A', index: 0 }, options)).toThrow(/"index" needs a "parent"/);
    expect(() =>
      expandTree({ frame: 'A', children: [{ frame: 'B', parent: 7 }] }, options),
    ).toThrow(/tree\.children\[0\]: only a top-level node takes "parent" and "index"/);
  });

  test('applies an effect style', () => {
    const { commands, uses } = expandTree({ frame: 'Lifted', effect: 'Elevation/1' }, options);
    const index = commands.findIndex((entry) => entry.command === 'style.apply');

    expect(commands[index]?.params).toEqual({ ids: [{ $ref: 'n1' }], style: 'Elevation/1' });
    expect(uses.get(index)).toEqual([{ kind: 'style', name: 'Elevation/1' }]);
  });

  test('records the names each command uses', () => {
    const { commands, uses } = expandTree({ text: 'A', style: 'Docs/Body' }, options);
    const index = commands.findIndex((entry) => entry.command === 'style.apply');

    expect(uses.get(index)).toEqual([{ kind: 'style', name: 'Docs/Body' }]);
  });

  test('rejects malformed trees with the path of the problem', () => {
    expect(() => expandTree({ frame: 'A', children: [{ nope: 1 } as TreeNode] }, options)).toThrow(
      /tree\.children\[0\]: unknown key "nope"/,
    );
    expect(() => expandTree({ frame: 'A', text: 'B' }, options)).toThrow(/exactly one of/);
    expect(() => expandTree({ text: 'A', children: [] }, options)).toThrow(/only a frame/);
    expect(() => expandTree([], options)).toThrow(TreeError);
    expect(() => expandTree({ frame: 'A', pad: [1, 2, 3] }, options)).toThrow(/"pad" takes/);
    expect(() =>
      expandTree({ frame: 'A', children: [{ text: 'x', as: 'a' }, { text: 'y', as: 'a' }] }, options),
    ).toThrow(/used twice/);
  });

  test('reports an unknown component by name', () => {
    try {
      expandTree({ instance: 'Icon/Walet' }, options);
      throw new Error('expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownName);
      expect((error as UnknownName).use).toEqual({ kind: 'component', name: 'Icon/Walet' });
    }
  });
});
