import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createCatalogStore, findComponent, suggest, toCatalog } from './catalog';
import { createHeadlessEngine } from './engine';
import * as ops from './ops';
import { loadConfig, resolveBin } from './settings';

describe('catalog', () => {
  const catalog = toCatalog([
    {
      collections: [{ id: 'C:1', name: 'Space', modes: [{ name: 'Compact' }, { name: 'Roomy' }] }],
      variables: [
        { id: 'VariableID:1', name: 'space/16', resolvedType: 'number', collection: 'C:1', values: {} },
      ],
    },
    [{ id: 'S:1', name: 'Docs/Body', type: 'text', style: { font_size: 15 } }],
    [
      { id: 2, name: 'Button', type: 'COMPONENT' },
      { id: 1, name: 'Button', type: 'COMPONENT_SET' },
      { id: 3, name: 'State=Hover', type: 'COMPONENT' },
    ],
    [
      { id: 10, name: '  Colors ', divider: false },
      { id: 11, name: '---', divider: true },
    ],
  ]);

  test('keeps names and ids only', () => {
    expect(catalog.variables).toEqual([
      { id: 'VariableID:1', name: 'space/16', type: 'number', collection: 'Space' },
    ]);
    expect(catalog.styles).toEqual([{ id: 'S:1', name: 'Docs/Body', type: 'text' }]);
    expect(catalog.pages).toEqual([{ id: 10, name: 'Colors', index: 0 }]);
    expect(catalog.collections).toEqual([{ name: 'Space', modes: ['Compact', 'Roomy'] }]);
  });

  test('prefers a component set over a variant of the same name', () => {
    expect(findComponent(catalog, 'Button')?.id).toBe(1);
    expect(findComponent(catalog, 'button')?.id).toBe(1);
    expect(findComponent(catalog, 'Missing')).toBeNull();
  });

  test('suggests the closest names first', () => {
    const names = ['space/16', 'space/24', 'color/text/primary', 'radius/card'];

    expect(suggest(names, 'space/18')[0]).toStartWith('space/');
    expect(suggest(names, 'colour/text/primary')).toEqual(['color/text/primary']);
    expect(suggest(names, 'zzz')).toEqual([]);
  });
});

describe('parseCommands', () => {
  test('reads ids, labels, the change marker and parameters', () => {
    const commands = ops.parseCommands(
      [
        'node.create*  Create layer',
        '    {type, name?}',
        'node.get  Get layer',
        '    {id, fields?}',
        'view.zoomIn  Zoom in (Cmd+=)',
      ].join('\n'),
    );

    expect(commands).toEqual([
      { id: 'node.create', mutating: true, label: 'Create layer', params: '{type, name?}' },
      { id: 'node.get', mutating: false, label: 'Get layer', params: '{id, fields?}' },
      { id: 'view.zoomIn', mutating: false, label: 'Zoom in (Cmd+=)', params: '' },
    ]);
  });
});

// The rest runs the real figcraft-cli against a scratch document.
const config = loadConfig();
let hasCli = false;

try {
  config.figcraftBin = resolveBin(config);
  hasCli = existsSync(config.figcraftBin);
} catch {
  // No usable figcraft-cli on this machine: the end-to-end tests are skipped.
}

describe.skipIf(!hasCli)('against figcraft-cli', () => {
  let directory = '';
  let ctx: ops.Context;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'figkit-e2e-'));

    const file = join(directory, 'scratch.figcraft');
    const settings = { ...config, tempDir: join(directory, 'tmp') };
    const engine = createHeadlessEngine(settings, file);

    ctx = {
      config: settings,
      project: { root: directory, file, writeBlocked: null },
      engine,
      catalog: createCatalogStore(engine, settings, file),
    };

    // A small design system: variables, a text style and a component.
    const setup = (await ops.run(ctx, {
      commands: [
        { command: 'variable.createCollection', params: { name: 'Tokens' } },
        {
          command: 'variable.create',
          params: { collection: 'Tokens', name: 'space/16', type: 'number', value: 16 },
        },
        {
          command: 'variable.create',
          params: { collection: 'Tokens', name: 'color/card', type: 'color', value: '#336699' },
        },
        { command: 'node.create', params: { type: 'text', characters: 'Sample', name: 'Sample' }, as: 't' },
        { command: 'style.create', params: { type: 'text', name: 'Docs/Body', from: { $ref: 't' } } },
        {
          command: 'node.create',
          params: { type: 'frame', name: 'Badge', x: 600, y: 0, width: 40, height: 20 },
        },
      ],
    })) as { id?: number }[];

    // FigCraft checks that component.create has a target before the script runs, so it needs a
    // real id from an earlier run instead of a $ref.
    await ops.run(ctx, {
      commands: [{ command: 'component.create', params: { ids: [setup.at(-1)?.id] } }],
    });
  }, 60_000);

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('looks up names without dumping the listings', async () => {
    expect(await ops.find(ctx, { kind: 'variable', name: 'space' })).toBe('space/16\tnumber\tTokens');
    expect(await ops.find(ctx, { kind: 'style', name: 'docs' })).toBe('Docs/Body\ttext');
    expect(await ops.find(ctx, { kind: 'component', name: 'badge' })).toMatch(/^\d+\tBadge$/);
  });

  test('builds a tree, saves it and reads it back', async () => {
    const built = (await ops.build(ctx, {
      at: [0, 400],
      tree: {
        frame: 'Card',
        gap: 'space/16',
        pad: ['space/16', 24],
        fill: 'color/card',
        w: 320,
        children: [
          { text: 'Title', style: 'Docs/Body', as: 'title', w: 'fill' },
          { instance: 'Badge', as: 'badge' },
        ],
      },
    })) as { root: number; layers: number; ids: Record<string, number> };

    expect(built.layers).toBe(3);
    expect(Object.keys(built.ids)).toEqual(['title', 'badge']);

    const outline = (await ops.read(ctx, { id: built.root })) as {
      name: string;
      children: { id: number; name: string; type: string }[];
    };

    expect(outline.name).toBe('Card');
    expect(outline.children.map((child) => [child.id, child.type])).toEqual([
      [built.ids.title as number, 'TEXT'],
      [built.ids.badge as number, 'INSTANCE'],
    ]);

    const fields = (await ops.read(ctx, { name: 'Card', fields: ['width', 'boundVariables'] })) as {
      width: number;
      boundVariables: Record<string, unknown>;
    };

    expect(fields.width).toBe(320);
    expect(Object.keys(fields.boundVariables)).toContain('gap');
    // Bound variables come back by name, which is what every other command takes.
    expect(fields.boundVariables.gap).toBe('space/16');
    expect(await ops.find(ctx, { name: 'Card' })).toMatch(new RegExp(`^${built.root}\\tFRAME\\t320×`));

    const deep = (await ops.read(ctx, { id: built.root, deep: true })) as string;
    const [path, count] = deep.split('\t');
    const layers = (await Bun.file(path as string).json()) as {
      id: number;
      parent: number | null;
      children: number[];
      absoluteBounds: { width: number };
    }[];

    expect(count).toBe('3 layers');
    expect(layers[0]).toMatchObject({ id: built.root, parent: null, absoluteBounds: { width: 320 } });
    expect(layers[0]?.children).toEqual([built.ids.title as number, built.ids.badge as number]);
    expect(layers.slice(1).map((layer) => layer.parent)).toEqual([built.root, built.root]);

    // `where` picks layers by exact name, so no script has to look the ids up.
    const changed = await ops.run(ctx, {
      commands: [
        { command: 'node.set', where: { root: [built.root], name: 'Title' }, params: { opacity: 0.5 } },
      ],
    });

    expect(changed).toEqual([expect.objectContaining({ matched: 1 })]);
    expect(await ops.read(ctx, { id: built.ids.title, fields: ['opacity'] })).toMatchObject({
      opacity: 0.5,
    });
    await expect(
      ops.run(ctx, {
        commands: [{ command: 'node.set', where: { root: built.root, name: 'Tit' }, params: {} }],
      }),
    ).rejects.toThrow(/matched no layers/);

    // `expect` stops a change that would reach more layers, or fewer, than the caller means.
    const twins = (await ops.build(ctx, {
      at: [0, 900],
      tree: { frame: 'Twins', children: [{ text: 'One', name: 'Amount' }, { text: 'Two', name: 'Amount' }] },
    })) as { root: number };
    const amounts = { root: twins.root, name: 'Amount', type: 'TEXT' };

    await expect(
      ops.run(ctx, {
        commands: [{ command: 'node.set', where: { ...amounts, expect: 1 }, params: { characters: 'X' } }],
      }),
    ).rejects.toThrow(/nothing was changed\. step 0 \(node\.set\): "where" matched 2 layers \(\d+, \d+\), not the 1 it expects/);
    expect(await ops.find(ctx, { root: twins.root, text: 'X' })).toBe('no layers found');
    expect(
      await ops.run(ctx, {
        commands: [{ command: 'node.set', where: { ...amounts, expect: 2 }, params: { opacity: 0.5 } }],
      }),
    ).toEqual([expect.objectContaining({ matched: 2 })]);
  }, 60_000);

  test('builds a component set with a property and its instances in one step', async () => {
    const variant = (tone: string) => ({
      frame: `Tone=${tone}`,
      pad: 'space/16',
      children: [{ text: 'Label' }, { shape: 'rectangle', name: 'Icon', w: 16, h: 16 }],
    });
    const built = (await ops.build(ctx, {
      at: [0, 1200],
      tree: [
        {
          set: 'Stat',
          as: 'set',
          layout: 'horizontal',
          gap: 'space/16',
          pad: 'space/16',
          properties: [{ name: 'Show Icon?', type: 'boolean', layer: 'Icon', default: true }],
          children: [variant('Neutral'), variant('Positive')],
        },
        {
          frame: 'Doc',
          as: 'doc',
          y: 1600,
          children: [
            { instance: { $ref: 'set' }, properties: { Tone: 'Positive' } },
            { instance: { $ref: 'set' } },
          ],
        },
      ],
    })) as { ids: { set: number; doc: number } };

    const set = (await ops.read(ctx, { id: built.ids.set, fields: ['name', 'type', 'sizing'] })) as {
      name: string;
      type: string;
      sizing: { horizontal: string };
      children: { sizing: { horizontal: string } }[];
    };

    expect(set).toMatchObject({ name: 'Stat', type: 'COMPONENT_SET', sizing: { horizontal: 'hug' } });
    // Combining fixes the variants' size; the build sets them back to hugging.
    expect(set.children.map((child) => child.sizing.horizontal)).toEqual(['hug', 'hug']);

    const [properties] = (await ops.run(ctx, {
      commands: [{ command: 'component.properties', params: { id: built.ids.set } }],
    })) as [{ properties: { name: string; type: string }[] }];

    expect(properties.properties).toContainEqual(
      expect.objectContaining({ name: 'Show Icon?', type: 'boolean' }),
    );

    // An instance shows a variant, whose name is not the set's; the set's name still selects it.
    const hidden = await ops.run(ctx, {
      commands: [
        {
          command: 'node.set',
          where: { root: built.ids.doc, component: 'Stat' },
          params: { opacity: 0.5 },
        },
      ],
    });

    expect(hidden).toEqual([expect.objectContaining({ matched: 2 })]);

    // An id that arrives as a string is still an id.
    await ops.build(ctx, { parent: String(built.ids.doc), tree: { text: 'Caption' } });
    expect(await ops.find(ctx, { name: 'Caption', root: built.ids.doc })).toMatch(/\tCaption$/);

    await expect(
      ops.run(ctx, {
        commands: [
          { command: 'node.set', where: { root: { $ref: 'x' } as never, name: 'Label' }, params: {} },
        ],
      }),
    ).rejects.toThrow(/nothing was changed. step 0 \(node.set\).*cannot use "\$ref"/);
  }, 60_000);

  test('a child that fills a hugging frame is as wide as the widest sibling', async () => {
    const built = (await ops.build(ctx, {
      at: [0, 2400],
      tree: {
        frame: 'Hugging',
        pad: 16,
        as: 'card',
        children: [
          { frame: 'Row', layout: 'horizontal', w: 'fill', as: 'row', children: [{ text: 'Short' }] },
          { text: 'A line that is much wider than the row above it', as: 'line' },
        ],
      },
    })) as { ids: { card: number; row: number; line: number } };
    const [card, row, line] = (await ops.read(ctx, {
      ids: [built.ids.card, built.ids.row, built.ids.line],
      fields: ['width'],
    })) as { width: number }[];

    // Without the second pass FigCraft fixes the frame at its first child's width.
    expect(row?.width).toBe(line?.width as number);
    expect(card?.width).toBe((line?.width as number) + 32);
  }, 60_000);

  test('lists a collection with its modes and exports in a mode without saving', async () => {
    const listed = await ops.find(ctx, { kind: 'collection', name: 'Tokens' });
    const mode = /^Tokens\tmodes: (.+)$/.exec(listed)?.[1] as string;

    expect(mode).toBeTruthy();

    const before = (await stat(ctx.project.file)).mtimeMs;
    const line = await ops.shot(ctx, { name: 'Card', mode: { Tokens: mode } });

    expect((await stat(line.split('\t')[0] as string)).size).toBeGreaterThan(100);
    expect((await stat(ctx.project.file)).mtimeMs).toBe(before);
  }, 60_000);

  test('a failing build changes nothing and suggests the right name', async () => {
    const before = (await stat(ctx.project.file)).mtimeMs;

    await expect(
      ops.build(ctx, { tree: { frame: 'Broken', gap: 'space/61' } }),
    ).rejects.toThrow(/nothing was changed.*Did you mean: space\/16\?/s);
    await expect(ops.build(ctx, { tree: { instance: 'Bagde' } })).rejects.toThrow(
      /no component named "Bagde".*Did you mean: Badge\?/s,
    );

    expect((await stat(ctx.project.file)).mtimeMs).toBe(before);
    expect(await ops.find(ctx, { name: 'Broken' })).toBe('no layers found');
  }, 60_000);

  test('exports a layer to a file instead of returning image data', async () => {
    const line = await ops.shot(ctx, { name: 'Card' });
    const path = line.split('\t')[0] as string;

    expect(path).toEndWith('.png');
    expect((await stat(path)).size).toBeGreaterThan(100);
    expect(line.length).toBeLessThan(300);
  }, 60_000);

  test('run saves only when a command changes the document', async () => {
    const before = (await stat(ctx.project.file)).mtimeMs;

    expect(await ops.run(ctx, { commands: [{ command: 'page.list', params: {} }] })).toHaveLength(1);
    expect((await stat(ctx.project.file)).mtimeMs).toBe(before);
    await expect(ops.run(ctx, { commands: [{ command: 'node.set', params: { ids: [999_999_999] } }] }))
      .rejects.toThrow(/nothing was changed/);
  }, 60_000);

  test('saves what an instance overrides and puts it back after its component is rebuilt', async () => {
    await ops.run(ctx, {
      commands: [
        {
          command: 'variable.create',
          params: { collection: 'Tokens', name: 'color/group', type: 'color', value: '#CC3366' },
        },
      ],
    });

    const built = (await ops.build(ctx, {
      at: [0, 1400],
      tree: [
        {
          frame: 'Row',
          component: true,
          as: 'row',
          layout: 'horizontal',
          children: [
            { text: '€0.00', name: 'Amount', as: 'amount' },
            { frame: 'Dot', w: 8, h: 8, fill: 'color/card' },
            { frame: 'Solid', w: 40, h: 4, fill: 'color/card', as: 'solid' },
          ],
        },
        { frame: 'Doc', as: 'doc', y: 200, children: [{ instance: { $ref: 'row' }, as: 'one' }] },
      ],
    })) as { ids: Record<string, number> };
    const { row, amount, solid, doc, one } = built.ids as Record<string, number>;
    const inside = (name: string) => ({ root: one, name, expect: 1 });

    await ops.run(ctx, {
      commands: [
        { command: 'node.set', where: inside('Amount'), params: { characters: '€57.00' } },
        {
          command: 'variable.bind',
          where: inside('Dot'),
          params: { field: 'fill', variable: 'color/group' },
        },
        { command: 'node.set', where: inside('Solid'), params: { width: 20 } },
      ],
    });

    const [path, summary] = ((await ops.read(ctx, { id: doc, overrides: true })) as string).split('\t');

    expect(summary).toBe('3 overrides in 1 instances');
    expect(await Bun.file(path as string).json()).toEqual([
      { instance: one, layer: 'Amount', type: 'TEXT', parent: 'Row', index: 0, characters: '€57.00' },
      { instance: one, layer: 'Dot', type: 'FRAME', parent: 'Row', index: 0, fill: 'color/group' },
      { instance: one, layer: 'Solid', type: 'FRAME', parent: 'Row', index: 0, width: 20, height: 4 },
    ]);

    // A layer of the component that is built again gets a new id, and the instance shows its
    // default again. A deleted layer takes its override with it.
    await ops.run(ctx, {
      commands: [
        { command: 'edit.delete', params: { ids: [amount, solid] } },
        {
          command: 'node.create',
          params: { type: 'text', name: 'Amount', characters: '€0.00', parent: row, index: 0 },
        },
      ],
    });
    expect(await ops.find(ctx, { root: one, text: '€57.00' })).toBe('no layers found');

    expect(await ops.run(ctx, { overrides: path })).toEqual({
      set: 1,
      unchanged: 1,
      missing: { 'FRAME "Solid" in "Row"': 1 },
    });
    expect(await ops.find(ctx, { root: one, text: '€57.00' })).toMatch(/\tAmount$/);

    // Nothing is left to do the second time, so nothing is written.
    const before = (await stat(ctx.project.file)).mtimeMs;

    expect(await ops.run(ctx, { overrides: path })).toMatchObject({ set: 0, unchanged: 2 });
    expect((await stat(ctx.project.file)).mtimeMs).toBe(before);
    await expect(
      ops.run(ctx, { overrides: [{ instance: one as number, layer: 'Amount' }] }),
    ).rejects.toThrow(/nothing was changed\. override 0 sets nothing/);
  }, 60_000);

  test('run replaces an oversized result with a pointer to the right command', async () => {
    const [listing] = (await ops.run(ctx, {
      commands: [{ command: 'help.shortcuts', params: {} }],
    }).catch(() => [null])) as unknown[];

    // Whatever the command returns, a single step never exceeds the per-step budget.
    expect(JSON.stringify(listing ?? null).length).toBeLessThan(5_000);
  }, 60_000);

  test('refuses to write when the project blocks it', async () => {
    const blocked = { ...ctx, project: { ...ctx.project, writeBlocked: 'the checkout is on "feat/x"' } };

    await expect(ops.build(blocked, { tree: { frame: 'Nope' } })).rejects.toThrow(/refusing to change/);
  });

  test('help returns one command in full and an index for a topic', async () => {
    expect(await ops.help(ctx, { query: 'node.get' })).toMatch(/^node\.get: Get layer\n {2}\{id/);
    expect(await ops.help(ctx, { query: 'variable' })).toContain('Ask again with one command id');
  });
});
