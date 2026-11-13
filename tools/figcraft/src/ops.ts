import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { branchTarget, copyRange, prepareCopy } from './branch-copy';
import { expandTree, UnknownName, type NameUse, type TreeNode } from './build';
import { byteLength, truncateToBytes } from './bytes';
import {
  findComponent,
  findPage,
  suggest,
  variableValues,
  type Catalog,
  type CatalogComponent,
  type CatalogStore,
} from './catalog';
import type { Command, Engine } from './engine';
import {
  anchors,
  collectOverrides,
  OVERRIDE_FIELDS,
  planRestore,
  type Layer,
  type Override,
} from './overrides';
import { fit, prune } from './prune';
import type { Project } from './project';
import type { Config } from './settings';
import { mergeVariableCommands, parseSnapshot, worthMerging } from './variables';

export type Context = {
  config: Config;
  project: Project;
  engine: Engine;
  catalog: CatalogStore;
};

/** A failure the caller can fix: bad input, an unknown name, a rejected command. */
export class OpError extends Error {}

// ---------------------------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------------------------

export type FindInput = {
  kind?: 'layer' | 'variable' | 'style' | 'component' | 'page' | 'collection';
  name?: string;
  type?: string;
  text?: string;
  page?: string | number;
  root?: number;
  limit?: number;
  /** With kind variable: add each variable's value in every mode. */
  values?: boolean;
};

export async function find(ctx: Context, input: FindInput): Promise<string> {
  const kind = input.kind ?? 'layer';
  const limit = clamp(input.limit ?? 20, 1, 200);

  if (kind !== 'layer') {
    return findName(await ctx.catalog.get(), kind, input, limit);
  }

  if (!input.name && !input.type && !input.text) {
    throw new OpError('find needs "name", "type" or "text" for layers.');
  }

  const roots = await searchRoots(ctx, input);
  const filter: Record<string, unknown> = { limit };

  if (input.name) filter.name = input.name;
  if (input.type) filter.type = input.type;
  if (input.text) filter.text = input.text;

  const found = await must(
    ctx,
    roots.map((root) => ({ command: 'node.find', params: { ...filter, root } })),
  );
  const ids: number[] = [];
  let total = 0;

  for (const step of found) {
    const result = (step.result ?? {}) as { ids?: number[]; total?: number };

    total += result.total ?? 0;
    ids.push(...(result.ids ?? []));
  }

  if (ids.length === 0) {
    return 'no layers found';
  }

  const shown = ids.slice(0, limit);
  const details = await must(
    ctx,
    shown.map((id) => ({
      command: 'node.get',
      params: { id, fields: ['name', 'type', 'width', 'height'] },
    })),
  );
  const lines = details.map((step) => {
    const node = (step.result ?? {}) as Record<string, unknown>;

    return `${node.id}\t${node.type ?? ''}\t${size(node)}\t${node.name ?? ''}`;
  });

  if (total > shown.length) {
    lines.push(`… ${total - shown.length} more; narrow the search or raise "limit"`);
  }

  return lines.join('\n');
}

function findName(catalog: Catalog, kind: string, input: FindInput, limit: number): string {
  const wanted = (input.name ?? '').toLowerCase();
  const matches = (name: string): boolean => name.toLowerCase().includes(wanted);
  let rows: string[];

  if (kind === 'variable') {
    rows = catalog.variables
      .filter((entry) => matches(entry.name) && (!input.type || entry.type === input.type))
      .map(
        (entry) =>
          `${entry.name}\t${entry.type}\t${entry.collection}` +
          (input.values ? `\t${variableValues(catalog, entry)}` : ''),
      );
  } else if (kind === 'style') {
    rows = catalog.styles
      .filter((entry) => matches(entry.name) && (!input.type || entry.type === input.type))
      .map((entry) => `${entry.name}\t${entry.type}`);
  } else if (kind === 'component') {
    rows = catalog.components
      .filter((entry) => matches(entry.name))
      .map((entry) => `${entry.id}\t${entry.name}${entry.set ? '\t(set)' : ''}`);
  } else if (kind === 'page') {
    // The index is the page's place in the document, which is what page.move takes.
    rows = catalog.pages
      .filter((entry) => matches(entry.name))
      .map((entry) => `${entry.id}\t${entry.name}\tindex ${entry.index}`);
  } else if (kind === 'collection') {
    rows = catalog.collections
      .filter((entry) => matches(entry.name))
      .map((entry) => `${entry.name}\tmodes: ${entry.modes.join(', ')}`);
  } else {
    throw new OpError(
      `unknown kind "${kind}". Use layer, variable, style, component, page or collection.`,
    );
  }

  if (rows.length === 0) {
    return `no ${kind} matches "${input.name ?? ''}"`;
  }

  const shown = rows.slice(0, limit);

  if (rows.length > shown.length) {
    shown.push(`… ${rows.length - shown.length} more; narrow "name" or raise "limit"`);
  }

  return shown.join('\n');
}

async function searchRoots(ctx: Context, input: FindInput): Promise<number[]> {
  if (input.root !== undefined) {
    return [input.root];
  }

  const catalog = await ctx.catalog.get();

  if (input.page !== undefined) {
    return [pageId(catalog, input.page)];
  }

  return catalog.pages.map((page) => page.id);
}

/** An id that arrived as a string of digits, as some clients send numbers, is still an id. */
function asId<T>(value: T): T | number {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}

function pageId(catalog: Catalog, page: string | number): number {
  if (typeof page === 'number') {
    return page;
  }

  const found = findPage(catalog, page);

  if (!found && typeof asId(page) === 'number') {
    return Number(page);
  }

  if (!found) {
    const names = suggest(
      catalog.pages.map((entry) => entry.name),
      page,
    );

    throw new OpError(`no page named "${page}".${didYouMean(names)}`);
  }

  return found.id;
}

// ---------------------------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------------------------

export type ReadInput = {
  id?: number;
  /** Several layers in one call; the result is a list in the same order. */
  ids?: number[];
  name?: string;
  page?: string | number;
  /** Properties to return instead of the outline. */
  fields?: string[];
  /** Write the layers and every layer inside them to a JSON file, and return its path. */
  deep?: boolean;
  /** Write what the instances inside the layers override to a JSON file, and return its path. */
  overrides?: boolean;
  /** Print the layers inside as an indented list with what a copy of them needs. */
  tree?: boolean;
};

/** The most layers one `node.find` returns. */
const MAX_FOUND = 10_000;

/** The most layers one deep read takes: a page's frames, never the whole file. */
const MAX_DEEP_LAYERS = 50_000;

const DEEP_FIELDS = ['name', 'type', 'absoluteBounds'];

export async function read(ctx: Context, input: ReadInput): Promise<unknown> {
  const ids = input.ids?.length ? input.ids : [await layerId(ctx, input)];

  if (input.overrides) {
    return readOverrides(ctx, ids);
  }

  if (input.deep) {
    return readDeep(ctx, ids, [...DEEP_FIELDS, ...(input.fields ?? [])]);
  }

  if (input.tree) {
    return readTree(ctx, ids);
  }

  const shape = input.fields?.length ? { fields: input.fields } : { outline: true };
  const steps = await must(
    ctx,
    ids.map((id) => ({ command: 'node.get', params: { id, ...shape } })),
  );
  const results = (await withNames(
    ctx,
    steps.map((step) => step.result ?? null),
  )) as unknown[];
  // The byte budget is shared, so asking for many layers cannot return more than one would.
  const budget = Math.floor(ctx.config.maxBytes / ids.length);
  const nodes = results.map((result, index) => {
    if (!result) {
      throw new OpError(`no layer with id ${ids[index]}.`);
    }

    // The layer's own values come before its children's, which can be many.
    const { children, ...own } = prune(result, true) as Record<string, unknown>;

    return fit('get_node', children === undefined ? own : { ...own, children }, budget).value;
  });

  return input.ids?.length ? nodes : nodes[0];
}

/**
 * FigCraft reports a bound variable or an applied style by id ("VariableID:48", "S:2"), and every
 * other command takes names. Replaces those ids with the names, wherever they appear.
 */
async function withNames(ctx: Context, value: unknown): Promise<unknown> {
  const text = JSON.stringify(value);

  if (!/"(VariableID|S):\d+"/.test(text)) {
    return value;
  }

  const catalog = await ctx.catalog.get();
  const names = new Map(
    [...catalog.variables, ...catalog.styles].map((entry) => [entry.id, entry.name]),
  );

  return JSON.parse(text, (_key, item: unknown) =>
    typeof item === 'string' ? (names.get(item) ?? item) : item,
  );
}

/**
 * A subtree is far too large for a model to read, and measuring it is a script's job: the layers
 * go to a file as a flat list, each with its `parent` and `children` ids.
 */
async function readDeep(ctx: Context, roots: number[], fields: string[]): Promise<string> {
  const layers = await subtree(ctx, roots, fields);
  const parents = new Map<number, number>();

  for (const layer of layers) {
    for (const child of layer.children) {
      parents.set(child, layer.id);
    }
  }

  const directory = join(ctx.config.tempDir, 'reads');
  const path = join(directory, `${roots[0]}-${Date.now()}.json`);

  await mkdir(directory, { recursive: true });
  await Bun.write(
    path,
    JSON.stringify(
      await withNames(
        ctx,
        layers.map((layer) => ({ ...layer, parent: parents.get(layer.id) ?? null })),
      ),
    ),
  );

  return `${path}\t${layers.length} layers`;
}

const TREE_FIELDS = [
  'name',
  'type',
  'visible',
  'width',
  'height',
  'layout',
  'sizing',
  'boundVariables',
  'styles',
  'characters',
  'mainComponent',
  'mainComponentName',
  'componentProperties',
  'clip',
];

const PADDING_SIDES = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

/** What a copy of the layer needs, on one line, in the words `build` takes. */
function treeLine(layer: Record<string, unknown>, glyph?: string): string {
  const bound = { ...((layer.boundVariables ?? {}) as Record<string, unknown>) };
  // A bound value is shown by its variable's name, an unbound one by its number.
  const take = (key: string): string | undefined => {
    const name = bound[key];

    delete bound[key];

    return typeof name === 'string' ? name : undefined;
  };
  const sizing = (layer.sizing ?? {}) as { horizontal?: string; vertical?: string };
  const size = (axis: 'width' | 'height', mode?: string): string =>
    mode === 'fill' || mode === 'hug' ? mode : (take(axis) ?? String(layer[axis]));
  const parts = [`${layer.id} ${JSON.stringify(layer.name)} ${layer.type}`];

  if (layer.visible === false) {
    parts.push('hidden');
  }

  parts.push(
    `w=${size('width', sizing.horizontal)} h=${size('height', sizing.vertical)}`,
    `${layer.width}x${layer.height}`,
  );

  const layout = (layer.layout ?? {}) as Record<string, unknown>;

  if (typeof layout.mode === 'string' && layout.mode !== 'none') {
    const grid = layout.mode === 'grid';

    parts.push(`layout=${layout.mode}`);

    if (layout.wrap === true) parts.push('wrap');
    if (typeof layout.mainAlign === 'string' && layout.mainAlign !== 'min') parts.push(`align=${layout.mainAlign}`);
    if (typeof layout.crossAlign === 'string' && layout.crossAlign !== 'min') parts.push(`cross=${layout.crossAlign}`);

    const gap = take('gap') ?? (layout.gap ? String(layout.gap) : undefined);
    const crossGap = take('crossGap') ?? (layout.crossGap ? String(layout.crossGap) : undefined);

    if (gap) parts.push(`gap=${gap}`);
    if (crossGap && (grid || layout.wrap === true)) parts.push(`crossGap=${crossGap}`);

    const raw = Array.isArray(layout.padding) ? (layout.padding as number[]) : [];
    const vertical = take('paddingVertical');
    const horizontal = take('paddingHorizontal');
    const pad = PADDING_SIDES.map(
      (side, index) => take(side) ?? (index % 2 === 0 ? vertical : horizontal) ?? String(raw[index] ?? 0),
    );

    if (pad.some((value) => value !== '0' && value !== 'space/0')) parts.push(`pad=[${pad.join(',')}]`);

    if (grid) {
      parts.push(
        `grid=${layout.gridColumns}x${layout.gridRows}`,
        `columnTracks=${JSON.stringify(layout.columnTracks)}`,
        `rowTracks=${JSON.stringify(layout.rowTracks)}`,
      );
    }

    if (layout.strokesIncluded === false) parts.push('strokesIncluded=false');
  }

  // Frames clip unless told otherwise, so only the exception is said.
  if (layer.clip === false && (layer.type === 'FRAME' || layer.type === 'COMPONENT')) parts.push('clip=false');

  for (const [key, word] of [
    ['cornerRadius', 'radius'],
    ['fill', 'fill'],
    ['stroke', 'stroke'],
  ] as const) {
    const name = take(key);

    if (name) parts.push(`${word}=${name}`);
  }

  const rest = Object.entries(bound).filter(([, name]) => typeof name === 'string');

  if (rest.length > 0) {
    parts.push(`bind={${rest.map(([key, name]) => `${key}:${name}`).join(',')}}`);
  }

  const style = (layer.styles as { text?: string } | undefined)?.text;

  if (style) parts.push(`style=${style}`);

  if (typeof layer.characters === 'string') {
    parts.push(`text=${JSON.stringify(truncateToBytes(layer.characters, 48))}`);
  }

  if (layer.type === 'INSTANCE') {
    parts.push(`instance=${layer.mainComponent} ${JSON.stringify(layer.mainComponentName ?? '')}`);

    const properties = (layer.componentProperties ?? {}) as Record<string, unknown>;

    if (Object.keys(properties).length > 0) {
      parts.push(`properties=${JSON.stringify(properties)}`);
    }

    // An icon's colour is the stroke of the glyph inside it.
    if (glyph) parts.push(`glyph=${glyph}`);
  }

  return parts.join(' ');
}

/**
 * The anatomy of a layer as text, one indented line per layer, for copying a component's
 * structure without a script over a deep read. It stops at instances: what is inside one belongs
 * to another component.
 */
async function readTree(ctx: Context, roots: number[]): Promise<string> {
  const layers = (await withNames(ctx, await subtree(ctx, roots, TREE_FIELDS))) as SubtreeLayer[];
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const lines: string[] = [];
  const walk = (id: number, depth: number): void => {
    const layer = byId.get(id);

    if (!layer) {
      return;
    }

    const glyph = layer.children
      .map((child) => byId.get(child))
      .find((child) => child?.name === 'Glyph')?.boundVariables as { stroke?: string } | undefined;

    lines.push(`${'  '.repeat(depth)}${treeLine(layer, glyph?.stroke)}`);

    if (layer.type !== 'INSTANCE') {
      for (const child of layer.children) {
        walk(child, depth + 1);
      }
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }

  const shown: string[] = [];
  let bytes = 0;

  for (const line of lines) {
    bytes += byteLength(line) + 1;

    if (bytes > ctx.config.maxBytes) {
      shown.push(`… ${lines.length - shown.length} more layers: read a layer further down.`);
      break;
    }

    shown.push(line);
  }

  return shown.join('\n');
}

/**
 * What the instances under the roots override, as a file `run` puts back with `overrides`. Take it
 * before the layer tree of a main component changes: the change resets the overrides.
 */
async function readOverrides(ctx: Context, roots: number[]): Promise<string> {
  const layers = (await withNames(ctx, await subtree(ctx, roots, OVERRIDE_FIELDS))) as Layer[];
  const { entries, skipped } = collectOverrides(
    new Map(layers.map((layer) => [layer.id, layer])),
    roots,
  );
  const directory = join(ctx.config.tempDir, 'overrides');
  const path = join(directory, `${roots[0]}-${Date.now()}.json`);

  await mkdir(directory, { recursive: true });
  // One override per line, so two files can be compared.
  await Bun.write(path, `[\n${entries.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`);

  const instances = new Set(entries.map((entry) => entry.instance)).size;
  const left = Object.entries(skipped)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(', ');

  return (
    `${path}\t${entries.length} overrides in ${instances} instances` +
    (left ? `\tnot saved: ${left}` : '')
  );
}

type SubtreeLayer = Record<string, unknown> & { id: number; children: number[] };

/** The roots and every layer inside them, with the named fields and each layer's child ids. */
async function subtree(ctx: Context, roots: number[], fields: string[]): Promise<SubtreeLayer[]> {
  const ids = [...new Set([...roots, ...(await idsInside(ctx, roots))])];
  const steps = await must(
    ctx,
    ids.map((id) => ({
      command: 'node.get',
      params: { id, fields: [...new Set([...fields, 'children'])] },
    })),
  );

  return steps.map((step, index) => {
    const node = (step.result ?? {}) as Record<string, unknown> & { children?: { id: number }[] };

    return {
      ...node,
      id: ids[index] as number,
      children: (node.children ?? []).map((child) => child.id),
    };
  });
}

/**
 * One `node.find` returns at most 10,000 layers, so a layer with more inside it is searched child
 * by child.
 */
async function idsInside(ctx: Context, roots: number[]): Promise<number[]> {
  const found = await must(
    ctx,
    roots.map((root) => ({ command: 'node.find', params: { root, limit: MAX_FOUND } })),
  );
  const ids: number[] = [];
  const large: number[] = [];

  for (const [index, step] of found.entries()) {
    const result = (step.result ?? {}) as { ids?: number[]; total?: number };
    const total = result.total ?? 0;

    if (total > MAX_DEEP_LAYERS) {
      throw new OpError(
        `layer ${roots[index]} has ${total} layers inside it, and a deep read stops at ` +
          `${MAX_DEEP_LAYERS}. Read its children instead.`,
      );
    }

    if (total > MAX_FOUND) {
      large.push(roots[index] as number);
    } else {
      ids.push(...(result.ids ?? []));
    }
  }

  if (large.length > 0) {
    const parents = await must(
      ctx,
      large.map((id) => ({ command: 'node.get', params: { id, fields: ['children'] } })),
    );
    const children = parents.flatMap((step) =>
      ((step.result ?? {}) as { children?: { id: number }[] }).children ?? [],
    ).map((child) => child.id);

    ids.push(...children, ...(await idsInside(ctx, children)));
  }

  return ids;
}

/** Resolves `id`, or a `name` that matches exactly one layer. */
async function layerId(ctx: Context, input: { id?: number; name?: string; page?: string | number }) {
  if (input.id !== undefined) {
    return input.id;
  }

  if (!input.name) {
    throw new OpError('give an "id" or a "name".');
  }

  const roots = await searchRoots(ctx, { page: input.page });
  const found = await must(
    ctx,
    roots.map((root) => ({ command: 'node.find', params: { name: input.name, root, limit: 50 } })),
  );
  const ids = found.flatMap((step) => ((step.result ?? {}) as { ids?: number[] }).ids ?? []);

  if (ids.length === 0) {
    throw new OpError(`no layer named "${input.name}".`);
  }

  if (ids.length === 1) {
    return ids[0] as number;
  }

  // Names match as substrings, so prefer the one layer whose name is exactly the query.
  const details = await must(
    ctx,
    ids.slice(0, 50).map((id) => ({ command: 'node.get', params: { id, fields: ['name', 'type'] } })),
  );
  const nodes = details.map((step) => (step.result ?? {}) as { id: number; name?: string });
  const exact = nodes.filter((node) => node.name === input.name);

  if (exact.length === 1) {
    return (exact[0] as { id: number }).id;
  }

  const listed = (exact.length ? exact : nodes)
    .slice(0, 8)
    .map((node) => `${node.id} "${node.name}"`)
    .join(', ');

  throw new OpError(`"${input.name}" matches several layers: ${listed}. Use an id.`);
}

// ---------------------------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------------------------

export type BuildInput = {
  tree: TreeNode | TreeNode[];
  /** Layer id or name to build inside; the page when absent. */
  parent?: number | string;
  /** Page to build on when there is no parent. */
  page?: string | number;
  at?: [number, number];
  /** Also export the built layers and return the image paths. */
  shot?: boolean;
};

export async function build(ctx: Context, input: BuildInput): Promise<unknown> {
  assertWritable(ctx);

  if (!input.tree) {
    throw new OpError('build needs a "tree".');
  }

  const needsCatalog = input.page !== undefined || usesComponentNames(input.tree);
  const catalog = needsCatalog ? await ctx.catalog.get() : null;
  const given = asId(input.parent);
  const parent =
    typeof given === 'string' ? await layerId(ctx, { name: given, page: input.page }) : given;
  let expansion;

  try {
    expansion = expandTree(input.tree, {
      parent,
      at: input.at,
      component: (name) => (catalog ? (findComponent(catalog, name)?.id ?? null) : null),
    });
  } catch (error) {
    if (error instanceof UnknownName && catalog) {
      throw new OpError(`${error.message}.${didYouMean(namesFor(catalog, error.use))}`);
    }

    throw new OpError((error as Error).message);
  }

  const prefix: Command[] =
    parent === undefined && input.page !== undefined && catalog
      ? [{ command: 'page.select', params: { id: pageId(catalog, input.page) } }]
      : [];
  const result = await ctx.engine.run([...prefix, ...expansion.commands], { write: true });

  if (!result.ok) {
    const index = result.failedStep === null ? null : result.failedStep - prefix.length;
    const uses = index === null ? [] : (expansion.uses.get(index) ?? []);
    let hint = '';

    if (uses.length > 0) {
      const names = await ctx.catalog.get();

      hint = uses
        .map((use) => {
          const close = namesFor(names, use);

          return close.length === 0 || close.includes(use.name)
            ? ''
            : ` For "${use.name}":${didYouMean(close)}`;
        })
        .join('');
    }

    throw new OpError(`nothing was changed. ${result.error}${hint}`);
  }

  // Layers leave the known names as they were; a new component or set adds one.
  if (expansion.commands.some((entry) => entry.command.startsWith('component.'))) {
    ctx.catalog.invalidate();
  } else {
    await ctx.catalog.carry();
  }

  const idAt = (index: number): number =>
    ((result.steps[index + prefix.length]?.result ?? {}) as { id: number }).id;
  const roots = expansion.roots.map(idAt);
  const output: Record<string, unknown> = {
    root: roots.length === 1 ? roots[0] : roots,
    layers: expansion.layers,
  };

  if (Object.keys(expansion.named).length > 0) {
    output.ids = Object.fromEntries(
      Object.entries(expansion.named).map(([name, index]) => [name, idAt(index)]),
    );
  }

  if (input.shot) {
    output.shot = await shot(ctx, { ids: roots });
  }

  return output;
}

function usesComponentNames(tree: TreeNode | TreeNode[]): boolean {
  const nodes = Array.isArray(tree) ? tree : [tree];

  return nodes.some(
    (node) =>
      node &&
      typeof node === 'object' &&
      (typeof node.instance === 'string' || usesComponentNames(node.children ?? [])),
  );
}

/** The name itself when the document has it, otherwise the closest names of that kind. */
function namesFor(catalog: Catalog, use: NameUse): string[] {
  const names = namesOfKind(catalog, use.kind);

  return names.includes(use.name) ? [use.name] : suggest(names, use.name);
}

function namesOfKind(catalog: Catalog, kind: NameUse['kind']): string[] {
  if (kind === 'variable') {
    return catalog.variables.map((entry) => entry.name);
  }

  if (kind === 'style') {
    return catalog.styles.map((entry) => entry.name);
  }

  // Variants ("State=Hover") are not what a tree refers to.
  return catalog.components.filter((entry) => !entry.name.includes('=')).map((entry) => entry.name);
}

// ---------------------------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------------------------

export type RunInput = {
  commands?: (Command & { where?: Where })[];
  /** Save afterwards. Defaults to true when a command changes the document. */
  write?: boolean;
  /**
   * In place of `commands`: instance overrides to put back, as the path of a file written by
   * `read` with `overrides`, or as the entries themselves.
   */
  overrides?: string | Override[];
};

/** Picks a command's layers by what they are instead of by id; fills its `ids`. */
export type Where = {
  /** Search inside this layer or these layers, or on this page. One of the two is required. */
  root?: number | number[];
  page?: string | number;
  /**
   * Narrows the search to a layer inside each root, by exact name: one name, or names from the
   * outer layer to the inner one. Each must name exactly one layer there.
   */
  inside?: string | string[];
  /** The exact layer name. */
  name?: string;
  type?: string;
  /** Text content, as a substring. */
  text?: string;
  /** Instances of the main component with this name (substring). */
  component?: string;
  /** How many layers must match. Any other number fails the call before anything changes. */
  expect?: number;
};

const MAX_STEP_BYTES = 4_096;

/** Commands that can add, rename or remove a variable, style, component or page. */
const NAME_COMMANDS = /^(variable|style|component|page|library)\./;

export async function run(ctx: Context, input: RunInput): Promise<unknown> {
  if (input.overrides !== undefined) {
    if (input.commands?.length) {
      throw new OpError(
        'give "commands" or "overrides", not both: overrides are matched to the layers as they ' +
          'are before the call. Change the layers first, then put the overrides back.',
      );
    }

    return restoreOverrides(ctx, input.overrides);
  }

  if (!Array.isArray(input.commands) || input.commands.length === 0) {
    throw new OpError('run needs a non-empty "commands" array of {command, params, as?}.');
  }

  // A selector or name that cannot be resolved stops the call before FigCraft sees it.
  const { commands, matched } = await resolveWhere(ctx, input.commands).catch((error: unknown) => {
    throw error instanceof OpError ? new OpError(`nothing was changed. ${error.message}`) : error;
  });
  const write = input.write ?? (await changesDocument(ctx.config, commands));

  if (write) {
    assertWritable(ctx);
  }

  const merged = await mergeVariables(ctx, commands);
  const result = await ctx.engine.run(merged.commands, { write });

  if (!result.ok) {
    throw new OpError(`nothing was changed. ${result.error}`);
  }

  if (write) {
    if (commands.some((entry) => NAME_COMMANDS.test(entry.command))) {
      ctx.catalog.invalidate();
    } else {
      await ctx.catalog.carry();
    }
  }

  return foldSteps(merged.stepOf.map((index, original) => {
    const step = result.steps[index] ?? { command: '' };
    const pruned = prune(step.result);
    // A selector's result says how many layers it reached, so nothing has to be read back.
    const value =
      matched[original] === undefined
        ? pruned
        : { ...(pruned && typeof pruned === 'object' ? pruned : {}), matched: matched[original] };
    const bytes = byteLength(JSON.stringify(value ?? null));

    if (bytes <= MAX_STEP_BYTES) {
      return value ?? null;
    }

    return {
      truncated: true,
      bytes,
      hint: `${step.command} returned too much. Use find (kind: variable, style, component, page) or read with fields.`,
    };
  }));
}

/** The longest list of step results that is returned one result per step. */
const MAX_PLAIN_STEPS = 20;

/**
 * A long run answers the same thing hundreds of times over: 858 commands returned 858 times
 * `{"ok":true,"matched":1}`, 20 KB that say one thing. Past 20 steps, equal results that follow
 * each other become one, with `steps` saying how many steps it stands for.
 */
export function foldSteps(results: unknown[]): unknown[] {
  if (results.length <= MAX_PLAIN_STEPS) {
    return results;
  }

  const folded: unknown[] = [];
  let previous = '';
  let count = 0;
  const close = (): void => {
    if (count > 1) {
      const last = folded.pop();

      folded.push(last && typeof last === 'object' ? { ...last, steps: count } : { result: last, steps: count });
    }
  };

  for (const result of results) {
    const key = JSON.stringify(result ?? null);

    if (key === previous && count > 0) {
      count += 1;
      continue;
    }

    close();
    folded.push(result);
    previous = key;
    count = 1;
  }

  close();

  return folded;
}

/**
 * Puts instance overrides back in one all-or-nothing step. Each is matched to a layer by its
 * instance, name, type and place among the layers of that name, so it finds the layer again after
 * the main component's layer tree changed and FigCraft gave the layers inside new ids.
 */
async function restoreOverrides(ctx: Context, input: string | Override[]): Promise<unknown> {
  assertWritable(ctx);

  let entries: unknown;

  try {
    entries = typeof input === 'string' ? JSON.parse(await Bun.file(input).text()) : input;
  } catch (error) {
    throw new OpError(`nothing was changed. Could not read ${input}: ${(error as Error).message}`);
  }

  // A read that found nothing to save: putting it back changes nothing.
  if (typeof input === 'string' && Array.isArray(entries) && entries.length === 0) {
    return { set: 0, unchanged: 0 };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new OpError(
      'nothing was changed. "overrides" is a file from read with overrides, or a non-empty list ' +
        'of {instance, layer, type?, index?, characters?, fill?, width?, height?}.',
    );
  }

  // Each override is looked for inside the first of its instances that still exists.
  const around = (entries as Override[]).map((entry) =>
    entry && typeof entry.instance === 'number' ? anchors(entry).map(([id]) => id) : [],
  );
  const instances = [...new Set(around.flat())];
  const found = await must(
    ctx,
    instances.map((id) => ({ command: 'node.get', params: { id, fields: ['type'] } })),
  );
  const present = new Set(instances.filter((_, index) => found[index]?.result));
  const chosen = new Set(around.flatMap((ids) => ids.find((id) => present.has(id)) ?? []));
  const layers = (await withNames(ctx, await subtree(ctx, [...chosen], OVERRIDE_FIELDS))) as Layer[];
  let plan;

  try {
    plan = planRestore(entries as Override[], new Map(layers.map((layer) => [layer.id, layer])));
  } catch (error) {
    throw new OpError(`nothing was changed. ${(error as Error).message}`);
  }

  if (plan.commands.length > 0) {
    const result = await ctx.engine.run(plan.commands, { write: true });

    if (!result.ok) {
      throw new OpError(`nothing was changed. ${result.error}`);
    }

    await ctx.catalog.carry();
  }

  return plan.report;
}

/**
 * Replaces each selector's `inside` by the layers it names, which become the selector's roots:
 * under every root the one layer of the first name, under that one the next name, and so on.
 * So a layer in "Row 2" of a card is reached by names, with no id looked up first. The lookups
 * of all selectors are made together, two steps for each level of names.
 */
async function resolveInside(
  ctx: Context,
  commands: NonNullable<RunInput['commands']>,
  catalog: Catalog | null,
): Promise<NonNullable<RunInput['commands']>> {
  const pending: { command: number; roots: number[]; path: string[] }[] = [];

  for (const [index, entry] of commands.entries()) {
    const where = entry.where;

    // The checks of `where` itself come later, with their own messages.
    if (
      where?.inside === undefined ||
      (where.root === undefined && where.page === undefined) ||
      JSON.stringify(where).includes('"$ref"')
    ) {
      continue;
    }

    const path = Array.isArray(where.inside) ? where.inside : [where.inside];

    if (path.length === 0 || path.some((name) => typeof name !== 'string' || name === '')) {
      throw new OpError(`${label(index, entry)}: "inside" is a layer name or a list of names.`);
    }

    pending.push({
      command: index,
      roots:
        where.root === undefined
          ? [pageId(catalog as Catalog, where.page as string | number)]
          : (Array.isArray(where.root) ? where.root : [where.root]).map(asId),
      path,
    });
  }

  if (pending.length === 0) {
    return commands;
  }

  const depth = Math.max(...pending.map((each) => each.path.length));

  for (let level = 0; level < depth; level += 1) {
    const active = pending.filter((each) => each.path[level] !== undefined);
    const lookups = new Map<string, { root: number; name: string }>();

    for (const each of active) {
      for (const root of each.roots) {
        const name = each.path[level] as string;

        lookups.set(`${root}\n${name}`, { root, name });
      }
    }

    const list = [...lookups.values()];
    // FigCraft matches a name as a substring, so the names are read back and compared.
    const found = await must(
      ctx,
      list.map(({ root, name }) => ({ command: 'node.find', params: { root, name, limit: MAX_FOUND } })),
    );
    const candidates = found.map((step) => ((step.result ?? {}) as { ids?: number[] }).ids ?? []);
    const all = [...new Set(candidates.flat())];
    const read = await must(
      ctx,
      all.map((id) => ({ command: 'node.get', params: { id, fields: ['name'] } })),
    );
    const nameOf = new Map(
      all.map((id, index) => [id, ((read[index]?.result ?? {}) as { name?: string }).name]),
    );
    const exact = new Map(
      list.map(({ root, name }, index) => [
        `${root}\n${name}`,
        (candidates[index] ?? []).filter((id) => nameOf.get(id) === name),
      ]),
    );

    for (const each of active) {
      const name = each.path[level] as string;

      each.roots = each.roots.map((root) => {
        const ids = exact.get(`${root}\n${name}`) ?? [];

        if (ids.length !== 1) {
          const listed = ids.length > 0 ? ` (${ids.slice(0, 8).join(', ')})` : '';

          throw new OpError(
            `${label(each.command, commands[each.command] as Command)}: "inside" needs one layer ` +
              `named "${name}" in ${root}, and ${ids.length} are there${listed}.`,
          );
        }

        return ids[0] as number;
      });
    }
  }

  const roots = new Map(pending.map((each) => [each.command, each.roots]));

  return commands.map((entry, index) => {
    const narrowed = roots.get(index);

    if (!narrowed || !entry.where) {
      return entry;
    }

    const { inside: _inside, page: _page, ...rest } = entry.where;

    return { ...entry, where: { ...rest, root: narrowed } };
  });
}

/**
 * Turns each command's `where` into `ids`, so a change to every layer of a kind needs no script
 * that looks the ids up first. A selector that matches nothing fails before anything changes.
 */
async function resolveWhere(
  ctx: Context,
  given: NonNullable<RunInput['commands']>,
): Promise<{ commands: Command[]; matched: (number | undefined)[] }> {
  const needsCatalog = given.some(
    (entry) =>
      usesComponentName(entry) ||
      (entry.where && (entry.where.root === undefined || entry.where.component)),
  );
  const catalog = needsCatalog ? await ctx.catalog.get() : null;
  const commands = await resolveInside(ctx, given, catalog);

  // One search per root of each selector, all in one step.
  const searches: { command: number; params: Record<string, unknown> }[] = [];
  // The component whose instances a selector wants, when `component` names one exactly.
  const wanted = new Map<number, CatalogComponent>();

  for (const [index, entry] of commands.entries()) {
    if (!entry.where) {
      continue;
    }

    const { root, page, name, type, text, component } = entry.where;

    if (JSON.stringify(entry.where).includes('"$ref"')) {
      throw new OpError(
        `${label(index, entry)}: "where" is looked up before the commands run, so it cannot use ` +
          '"$ref". Create the layers in one call and select inside them in the next.',
      );
    }

    if (root === undefined && page === undefined) {
      throw new OpError(`${label(index, entry)}: "where" needs a "root" layer id or a "page".`);
    }

    const roots =
      root === undefined
        ? [pageId(catalog as Catalog, page as string | number)]
        : (Array.isArray(root) ? root : [root]).map(asId);
    const known = component ? findComponent(catalog as Catalog, component) : null;

    if (known) {
      wanted.set(index, known);
    }

    for (const each of roots) {
      const params: Record<string, unknown> = { root: each, limit: MAX_FOUND };

      if (name) params.name = name;
      if (text) params.text = text;

      if (known) {
        // FigCraft's own `component` filter matches the variant's name, never the set's, so the
        // instances are found here and kept by their main component below.
        params.type = type ?? 'INSTANCE';
      } else {
        if (type) params.type = type;
        if (component) params.component = component;
      }

      searches.push({ command: index, params });
    }
  }

  if (searches.length === 0 && !commands.some(usesComponentName)) {
    return { commands, matched: commands.map(() => undefined) };
  }

  const sets = [...new Set([...wanted.values()].filter((entry) => entry.set).map((entry) => entry.id))];
  const found = await must(ctx, [
    ...searches.map((search) => ({ command: 'node.find', params: search.params })),
    ...sets.map((id) => ({ command: 'node.get', params: { id, fields: ['children'] } })),
  ]);
  const matches = new Map<number, number[]>();
  const variants = new Map<number, number[]>();

  for (const [index, search] of searches.entries()) {
    const ids = ((found[index]?.result ?? {}) as { ids?: number[] }).ids ?? [];

    matches.set(search.command, [...(matches.get(search.command) ?? []), ...ids]);
  }

  for (const [index, id] of sets.entries()) {
    const result = (found[searches.length + index]?.result ?? {}) as { children?: { id: number }[] };

    variants.set(
      id,
      (result.children ?? []).map((child) => child.id),
    );
  }

  // FigCraft matches names as substrings, and a change to many layers should hit the exact name
  // only; and an instance is kept by which component it shows.
  const checked = [
    ...new Set(
      [...matches].flatMap(([command, ids]) =>
        commands[command]?.where?.name || wanted.has(command) ? ids : [],
      ),
    ),
  ];
  const details = new Map<number, { name?: string; mainComponent?: number }>();

  if (checked.length > 0) {
    const read = await must(
      ctx,
      checked.map((id) => ({ command: 'node.get', params: { id, fields: ['name', 'mainComponent'] } })),
    );

    for (const [index, step] of read.entries()) {
      details.set(checked[index] as number, (step.result ?? {}) as { name?: string });
    }
  }

  // Most commands take `ids`. A few take one layer (`component.bindProperty`), and given `ids`
  // they act on the first only while the result would still say how many layers were matched.
  const signatures = new Map((await loadCommands(ctx.config)).map((info) => [info.id, info.params]));
  const matched: (number | undefined)[] = [];
  const resolved = commands.map((entry, index) => {
    const { where, ...command } = entry;
    let params = command.params;

    if (usesComponentName(entry)) {
      const name = params?.component as string;
      const component = findComponent(catalog as Catalog, name);

      if (!component) {
        const close = namesFor(catalog as Catalog, { kind: 'component', name });

        throw new OpError(
          `${label(index, entry)}: no component named "${name}".${didYouMean(close)}`,
        );
      }

      params = { ...params, component: component.id };
    }

    if (!where) {
      matched.push(undefined);

      return { ...command, params };
    }

    const component = wanted.get(index);
    const mains = component
      ? component.set
        ? (variants.get(component.id) ?? [])
        : [component.id]
      : null;
    const ids = [...new Set(matches.get(index) ?? [])].filter((id) => {
      const layer = details.get(id);

      return (
        (!where.name || layer?.name === where.name) &&
        (!mains || mains.includes(layer?.mainComponent as number))
      );
    });

    if (ids.length === 0) {
      throw new OpError(`${label(index, entry)}: "where" matched no layers.`);
    }

    // A name can repeat inside a layer, hidden layers included, and a change must not reach the
    // others unnoticed: the caller says how many layers it means.
    if (where.expect !== undefined && ids.length !== where.expect) {
      const listed = `${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ', …' : ''}`;

      throw new OpError(
        `${label(index, entry)}: "where" matched ${ids.length} layers (${listed}), not the ` +
          `${where.expect} it expects.`,
      );
    }

    matched.push(ids.length);

    const single = singleTarget(signatures.get(command.command));

    if (single) {
      if (ids.length !== 1) {
        throw new OpError(
          `${label(index, entry)}: ${command.command} takes one layer ("${single}"), and "where" ` +
            `matched ${ids.length}. Give one command for each layer.`,
        );
      }

      return { ...command, params: { ...params, [single]: ids[0] } };
    }

    return { ...command, params: { ...params, ids } };
  });

  return { commands: resolved, matched };
}

/**
 * The parameter a command names its one layer with, when its parameters are a list of keys that
 * has `layer` or `id` and no `ids`. A command described in prose (`node.set`) keeps `ids`.
 */
export function singleTarget(signature: string | undefined): 'layer' | 'id' | null {
  if (!signature?.startsWith('{')) {
    return null;
  }

  const has = (key: string): boolean => new RegExp(`(^\\{|, )${key}\\??[,} (:]`).test(signature);

  if (has('ids')) {
    return null;
  }

  return has('layer') ? 'layer' : has('id') ? 'id' : null;
}

function usesComponentName(entry: Command): boolean {
  return entry.command.startsWith('instance.') && typeof entry.params?.component === 'string';
}

/** Names a command in an error: a call often holds several of the same kind. */
function label(index: number, entry: Command): string {
  return `step ${index} (${entry.command})`;
}

/** Folds plain variable creates and sets into imports; see `variables.ts` for why. */
async function mergeVariables(ctx: Context, commands: Command[]) {
  const asWritten = { commands, stepOf: commands.map((_, index) => index) };

  if (!worthMerging(commands)) {
    return asWritten;
  }

  const exported = await ctx.engine.run([{ command: 'variable.export', params: {} }], {
    write: false,
  });
  const text = exported.ok ? (exported.steps[0]?.result as { text?: string } | undefined)?.text : '';
  const snapshot = text ? parseSnapshot(text) : null;

  return snapshot ? mergeVariableCommands(commands, snapshot) : asWritten;
}

// ---------------------------------------------------------------------------------------------
// shot
// ---------------------------------------------------------------------------------------------

export type ShotInput = {
  ids?: number[];
  name?: string;
  page?: string | number;
  /** Export scale; chosen from the layer's size when absent. */
  scale?: number;
  /** Variable modes to show the layers in, for this export only: { collection: mode }. */
  mode?: Record<string, string>;
};

export async function shot(ctx: Context, input: ShotInput): Promise<string> {
  const ids = input.ids?.length ? input.ids : [await layerId(ctx, input)];
  // Not saved: the export runs in the same step as the mode change, and the step is dropped.
  const modes = Object.entries(input.mode ?? {}).map(([collection, mode]) => ({
    command: 'variable.setMode',
    params: { ids, collection, mode },
  }));
  const sizes = await must(
    ctx,
    ids.map((id) => ({ command: 'node.get', params: { id, fields: ['name', 'width', 'height'] } })),
  );
  const directory = join(ctx.config.tempDir, 'shots');

  await mkdir(directory, { recursive: true });

  const stamp = Date.now();
  const exports = sizes.map((step, index) => {
    const node = (step.result ?? {}) as { width?: number; height?: number };
    const longest = Math.max(node.width ?? 1, node.height ?? 1, 1);
    const limit = ctx.config.maxShotSize / longest;
    const scale = Math.min(input.scale ?? (longest < 400 ? 2 : 1), limit);

    return {
      command: 'file.export',
      params: {
        ids: [ids[index]],
        format: 'png',
        scale: Math.max(0.05, Math.round(scale * 100) / 100),
        path: join(directory, `${ids[index]}-${stamp}.png`),
      },
    };
  });
  // The sizes are read again after the mode change, which can resize the layers.
  const steps = await must(ctx, [
    ...modes,
    ...exports,
    ...ids.map((id) => ({ command: 'node.get', params: { id, fields: ['name', 'width', 'height'] } })),
  ]);

  return ids
    .map((_, index) => {
      const result = (steps[modes.length + index]?.result ?? {}) as { path?: string };
      const node = (steps[modes.length + ids.length + index]?.result ?? {}) as Record<string, unknown>;

      return `${result.path}\t${size(node)} @${exports[index]?.params.scale}x\t${node.name ?? ''}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------------------------

export type CommandInfo = { id: string; label: string; mutating: boolean; params: string };

const MAX_PARAM_BYTES = 1_500;

export async function help(ctx: Context, input: { query?: string }): Promise<string> {
  const query = (input.query ?? '').trim().toLowerCase();

  if (!query) {
    throw new OpError('help needs a "query": a command id such as "node.set", or a topic such as "align".');
  }

  const commands = await loadCommands(ctx.config);
  const exact = commands.filter((entry) => entry.id.toLowerCase() === query);
  const matches = exact.length
    ? exact
    : commands.filter(
        (entry) => entry.id.toLowerCase().includes(query) || entry.label.toLowerCase().includes(query),
      );

  if (matches.length === 0) {
    return `no command matches "${input.query}"`;
  }

  if (matches.length > 8) {
    const lines = matches.slice(0, 60).map((entry) => `${entry.id}\t${entry.label}`);

    if (matches.length > 60) {
      lines.push(`… ${matches.length - 60} more`);
    }

    lines.push('Ask again with one command id for its parameters.');

    return lines.join('\n');
  }

  return matches
    .map((entry) => {
      // One command asked for by id gets its parameters in full: the answer is often at the end.
      const params =
        exact.length !== 1 && byteLength(entry.params) > MAX_PARAM_BYTES
          ? `${entry.params.slice(0, MAX_PARAM_BYTES)}…`
          : entry.params;

      return `${entry.id}${entry.mutating ? ' (changes the document)' : ''}: ${entry.label}\n  ${params}`;
    })
    .join('\n');
}

let commandCache: CommandInfo[] | null = null;

export async function loadCommands(config: Config): Promise<CommandInfo[]> {
  if (commandCache) {
    return commandCache;
  }

  let key = 'unknown';

  try {
    const stat = statSync(config.figcraftBin);

    key = Bun.hash(`${config.figcraftBin}:${stat.mtimeMs}:${stat.size}`).toString(36);
  } catch {
    // An unresolved binary still gets a cache entry of its own.
  }

  const path = join(config.tempDir, `commands-${key}.txt`);
  let text: string;

  if (existsSync(path)) {
    text = await Bun.file(path).text();
  } else {
    const child = Bun.spawn([config.figcraftBin, 'commands'], { stdout: 'pipe', stderr: 'ignore' });

    text = await new Response(child.stdout).text();

    if ((await child.exited) !== 0 || !text.trim()) {
      throw new OpError('could not list FigCraft commands; is figcraft-cli on PATH?');
    }

    await mkdir(config.tempDir, { recursive: true });
    await Bun.write(path, text);
  }

  commandCache = parseCommands(text);

  return commandCache;
}

/** Parses `figcraft-cli commands`: an "id[*]  label" line, then indented parameter lines. */
export function parseCommands(text: string): CommandInfo[] {
  const commands: CommandInfo[] = [];

  for (const line of text.split('\n')) {
    const header = /^([A-Za-z][\w.]*)(\*)?\s{2,}(.*)$/.exec(line);

    if (header) {
      commands.push({
        id: header[1] as string,
        mutating: header[2] === '*',
        label: (header[3] as string).trim(),
        params: '',
      });
    } else if (/^\s+\S/.test(line) && commands.length > 0) {
      const last = commands[commands.length - 1] as CommandInfo;

      last.params = last.params ? `${last.params} ${line.trim()}` : line.trim();
    }
  }

  return commands;
}

async function changesDocument(config: Config, commands: Command[]): Promise<boolean> {
  const known = new Map((await loadCommands(config)).map((entry) => [entry.id, entry.mutating]));

  // An unknown command is treated as a change, so its result is never silently dropped.
  return commands.some((entry) => known.get(entry.command) ?? true);
}

// ---------------------------------------------------------------------------------------------
// use
// ---------------------------------------------------------------------------------------------

export type UseInput = { checkout?: string; prepare?: boolean };

export type UseResult = {
  checkout: string;
  file: string;
  branch: string | null;
  copy: 'main' | 'branch';
  client?: number | null;
  prepared?: boolean;
};

/**
 * Reports the checkout and its copy. The MCP server picks the checkout before this runs, and the
 * shell uses the working directory. `prepare` gives a branch copy its id range; nothing else writes.
 */
export async function use(ctx: Context, input: UseInput): Promise<UseResult> {
  const { project } = ctx;
  const result: UseResult = {
    checkout: project.root,
    file: project.file,
    branch: project.branch,
    copy: project.copy,
  };
  const target = branchTarget(project);

  if (!target) {
    return result;
  }

  if (!existsSync(project.file)) {
    throw new OpError(`design file not found: ${project.file}`);
  }

  let range = await copyRange(target, project.file);

  if (input.prepare && !range.prepared) {
    assertWritable(ctx);
    range = await prepareCopy(target, project.file);
  }

  return { ...result, client: range.client, prepared: range.prepared };
}

// ---------------------------------------------------------------------------------------------
// shared
// ---------------------------------------------------------------------------------------------

function assertWritable(ctx: Context): void {
  if (ctx.project.writeBlocked) {
    throw new OpError(`refusing to change ${ctx.project.file}: ${ctx.project.writeBlocked}.`);
  }
}

/** Runs read-only commands and throws on failure. */
async function must(ctx: Context, commands: Command[]) {
  // Nothing to look up, as for a component name on a command that gives its ids: a session
  // rejects an empty batch.
  if (commands.length === 0) {
    return [];
  }

  const result = await ctx.engine.run(commands, { write: false });

  if (!result.ok) {
    throw new OpError(result.error);
  }

  return result.steps;
}

function size(node: Record<string, unknown>): string {
  const round = (value: unknown): string =>
    typeof value === 'number' ? String(Math.round(value * 10) / 10) : '?';

  return `${round(node.width)}×${round(node.height)}`;
}

function didYouMean(names: string[]): string {
  return names.length ? ` Did you mean: ${names.join(', ')}?` : '';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
