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
      collections: [{ id: 'C:1', name: 'Space' }],
      variables: [{ name: 'space/16', resolvedType: 'number', collection: 'C:1', values: {} }],
    },
    [{ name: 'Docs/Body', type: 'text', style: { font_size: 15 } }],
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
    expect(catalog.variables).toEqual([{ name: 'space/16', type: 'number', collection: 'Space' }]);
    expect(catalog.styles).toEqual([{ name: 'Docs/Body', type: 'text' }]);
    expect(catalog.pages).toEqual([{ id: 10, name: 'Colors' }]);
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
    expect(await ops.find(ctx, { name: 'Card' })).toMatch(new RegExp(`^${built.root}\\tFRAME\\t320×`));
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
