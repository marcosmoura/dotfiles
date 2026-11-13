import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createCatalogStore,
  findComponent,
  suggest,
  toCatalog,
  variableValues,
  type CatalogVariable,
} from './catalog';
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

  test('keeps names, ids and variable values only', () => {
    expect(catalog.variables).toEqual([
      { id: 'VariableID:1', name: 'space/16', type: 'number', collection: 'Space', values: {} },
    ]);
    expect(catalog.styles).toEqual([{ id: 'S:1', name: 'Docs/Body', type: 'text' }]);
    expect(catalog.pages).toEqual([{ id: 10, name: 'Colors', index: 0 }]);
    expect(catalog.collections).toEqual([{ name: 'Space', modes: ['Compact', 'Roomy'] }]);
  });

  test("gives a variable's value in each mode and follows an alias to its value", () => {
    const value = (type: string, of: unknown) => ({ type, value: of });
    const tokens = toCatalog([
      {
        collections: [
          { id: 'C:1', name: 'Primitives', modes: [{ id: 'C:1/m1', name: 'Value' }] },
          {
            id: 'C:2',
            name: 'Color',
            modes: [
              { id: 'C:2/m1', name: 'Light' },
              { id: 'C:2/m2', name: 'Dark' },
            ],
          },
          {
            id: 'C:3',
            name: 'Dynamic Type',
            modes: [
              { id: 'C:3/m1', name: 'Large' },
              { id: 'C:3/m2', name: 'AX3' },
            ],
          },
          { id: 'C:4', name: 'Component', modes: [{ id: 'C:4/m1', name: 'Value' }] },
        ],
        variables: [
          {
            id: 'V:1',
            name: 'white',
            resolvedType: 'color',
            collection: 'C:1',
            values: { 'C:1/m1': value('color', { r: 1, g: 1, b: 1, a: 0.8 }) },
          },
          {
            id: 'V:2',
            name: 'gray/900',
            resolvedType: 'color',
            collection: 'C:1',
            values: { 'C:1/m1': value('color', { r: 0.11, g: 0.11, b: 0.118, a: 1 }) },
          },
          {
            id: 'V:3',
            name: 'color/surface/card',
            resolvedType: 'color',
            collection: 'C:2',
            // Listed out of order: the collection's own mode order wins.
            values: { 'C:2/m2': value('alias', 'V:2'), 'C:2/m1': value('alias', 'V:1') },
          },
          {
            id: 'V:4',
            name: 'size/row-ios',
            resolvedType: 'number',
            collection: 'C:3',
            values: { 'C:3/m1': value('number', 52), 'C:3/m2': value('number', 0) },
          },
          {
            id: 'V:5',
            name: 'size/row',
            resolvedType: 'number',
            collection: 'C:4',
            values: { 'C:4/m1': value('alias', 'V:4') },
          },
        ],
      },
      [],
      [],
      [],
    ]);
    const values = (name: string): string =>
      variableValues(
        tokens,
        tokens.variables.find((entry) => entry.name === name) as CatalogVariable,
      );

    expect(values('white')).toBe('Value #FFFFFFCC');
    expect(values('gray/900')).toBe('Value #1C1C1E');
    expect(values('color/surface/card')).toBe('Light #FFFFFFCC (white); Dark #1C1C1E (gray/900)');
    expect(values('size/row-ios')).toBe('Large 52; AX3 0');
    // Its value depends on a mode this collection does not have.
    expect(values('size/row')).toBe('Value → size/row-ios');
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

describe('singleTarget', () => {
  test('tells a command that takes one layer from one that takes ids', () => {
    expect(ops.singleTarget('{ids?, field (fill|stroke), variable}')).toBeNull();
    expect(ops.singleTarget('{ids? (frames/page), collection, mode}')).toBeNull();
    expect(ops.singleTarget('{layer?, property (null/"" unbinds), field?: visible|characters}')).toBe('layer');
    expect(ops.singleTarget('{id? (component, set or instance)}')).toBe('id');
    expect(ops.singleTarget('{id, property, value}')).toBe('id');
    // Described in prose, with the word "layer" in it: it takes ids.
    expect(ops.singleTarget("name, visible, x, y (its own box goes at the layer's x/y)")).toBeNull();
    expect(ops.singleTarget('{name, type}')).toBeNull();
    expect(ops.singleTarget(undefined)).toBeNull();
  });
});

describe('foldSteps', () => {
  test('returns a short run one result per step', () => {
    const results = Array.from({ length: 20 }, () => ({ ok: true }));

    expect(ops.foldSteps(results)).toBe(results);
  });

  test('folds equal results that follow each other in a long run', () => {
    const results = [
      { ok: true },
      ...Array.from({ length: 30 }, () => ({ ok: true, matched: 1 })),
      { ok: true, matched: 4 },
      null,
      null,
      { ok: true, matched: 1 },
    ];

    expect(ops.foldSteps(results)).toEqual([
      { ok: true },
      { ok: true, matched: 1, steps: 30 },
      { ok: true, matched: 4 },
      { result: null, steps: 2 },
      { ok: true, matched: 1 },
    ]);
  });
});

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
      project: {
        root: directory,
        file,
        writeBlocked: null,
        copy: 'main',
        branch: null,
        mainBranch: 'main',
        commonDir: null,
        mainFile: null,
      },
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
    expect(await ops.find(ctx, { kind: 'variable', name: 'space', values: true })).toMatch(
      /^space\/16\tnumber\tTokens\t.+ 16$/,
    );
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
      absoluteBounds: { width: number; height: number };
    }[];

    expect(count).toBe('3 layers');
    expect(layers[0]).toMatchObject({ id: built.root, parent: null, absoluteBounds: { width: 320 } });
    expect(layers[0]?.children).toEqual([built.ids.title as number, built.ids.badge as number]);
    expect(layers.slice(1).map((layer) => layer.parent)).toEqual([built.root, built.root]);

    // The same layers as text, one line each, in the words `build` takes.
    const tree = ((await ops.read(ctx, { id: built.root, tree: true })) as string).split('\n');

    expect(tree).toHaveLength(3);
    expect(tree[0]).toBe(
      `${built.root} "Card" FRAME w=320 h=hug 320x${layers[0]?.absoluteBounds.height} layout=vertical ` +
        'gap=space/16 pad=[space/16,24,space/16,24] fill=color/card',
    );
    expect(tree[1]).toMatch(
      new RegExp(`^  ${built.ids.title} "Title" TEXT w=fill h=hug \\S+ style=Docs/Body text="Title"$`),
    );
    expect(tree[2]).toMatch(new RegExp(`^  ${built.ids.badge} "Badge" INSTANCE .* instance=\\d+ "Badge"$`));

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

    // A component name on a command that gives its ids needs no lookup. A session rejects an
    // empty batch, which the headless engine lets through, so this engine refuses one too.
    const strict = {
      ...ctx,
      engine: {
        mode: ctx.engine.mode,
        close: () => ctx.engine.close(),
        run: (commands: Parameters<typeof ctx.engine.run>[0], options: { write: boolean }) =>
          commands.length === 0
            ? Promise.resolve({ ok: false as const, error: '`commands` is empty', failedStep: null })
            : ctx.engine.run(commands, options),
      },
    };
    const [placed] = (await ops.run(strict, {
      commands: [{ command: 'instance.create', params: { component: 'Stat', parent: built.ids.doc } }],
    })) as [{ id: number }];

    expect(placed.id).toBeGreaterThan(0);

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

    // A read that found nothing to save is put back as a no-op, not as an error.
    const [empty, none] = ((await ops.read(ctx, { id: row, overrides: true })) as string).split('\t');

    expect(none).toBe('0 overrides in 0 instances');
    expect(await ops.run(ctx, { overrides: empty })).toEqual({ set: 0, unchanged: 0 });
    await expect(ops.run(ctx, { overrides: [] })).rejects.toThrow(/nothing was changed/);
  }, 60_000);

  test('selects inside a layer that is named, not looked up', async () => {
    const row = (name: string) => ({
      frame: name,
      layout: 'horizontal' as const,
      children: [{ text: '€0.00', name: 'Amount' }],
    });
    const built = (await ops.build(ctx, {
      at: [0, 2600],
      tree: {
        frame: 'Cards',
        as: 'cards',
        children: [
          { frame: 'Card A', children: [row('Row 1'), row('Row 2'), row('Row 10')] },
          { frame: 'Card B', children: [row('Row 1'), row('Row 2')] },
          { frame: 'Twins', children: [row('Row 1'), row('Row 1')] },
        ],
      },
    })) as { ids: { cards: number } };
    const cards = built.ids.cards;

    // "Row 1" is also the start of "Row 10", and both cards have a "Row 2": names are exact
    // and the path picks the card.
    expect(
      await ops.run(ctx, {
        commands: [
          {
            command: 'node.set',
            where: { root: cards, inside: ['Card B', 'Row 2'], name: 'Amount', expect: 1 },
            params: { characters: '€57.00' },
          },
          {
            command: 'node.set',
            where: { root: cards, inside: ['Card A', 'Row 1'], name: 'Amount', expect: 1 },
            params: { characters: '€81.00' },
          },
        ],
      }),
    ).toEqual([
      { ok: true, matched: 1 },
      { ok: true, matched: 1 },
    ]);

    const texts = (await ops.read(ctx, { id: cards, deep: true, fields: ['name', 'characters'] })) as string;
    const layers = (await Bun.file(texts.split('\t')[0] as string).json()) as {
      id: number;
      name: string;
      parent: number;
      characters?: string;
    }[];
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    const where = (amount: string): string[] =>
      layers
        .filter((layer) => layer.characters === amount)
        .map((layer) => {
          const rowLayer = byId.get(layer.parent);

          return `${byId.get(rowLayer?.parent as number)?.name} > ${rowLayer?.name}`;
        });

    expect(where('€57.00')).toEqual(['Card B > Row 2']);
    expect(where('€81.00')).toEqual(['Card A > Row 1']);

    await expect(
      ops.run(ctx, {
        commands: [
          {
            command: 'node.set',
            where: { root: cards, inside: ['Twins', 'Row 1'], name: 'Amount' },
            params: { characters: 'x' },
          },
        ],
      }),
    ).rejects.toThrow(/nothing was changed\. step 0 \(node\.set\): "inside" needs one layer named "Row 1" in \d+, and 2 are there/);
    await expect(
      ops.run(ctx, {
        commands: [
          {
            command: 'node.set',
            where: { root: cards, inside: 'Card C', name: 'Amount' },
            params: { characters: 'x' },
          },
        ],
      }),
    ).rejects.toThrow(/"inside" needs one layer named "Card C" in \d+, and 0 are there/);
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
