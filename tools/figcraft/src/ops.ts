import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expandTree, UnknownName, type NameUse, type TreeNode } from './build';
import { byteLength } from './bytes';
import {
  findComponent,
  findPage,
  suggest,
  type Catalog,
  type CatalogComponent,
  type CatalogStore,
} from './catalog';
import type { Command, Engine } from './engine';
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
      .map((entry) => `${entry.name}\t${entry.type}\t${entry.collection}`);
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
};

/** The most layers one `node.find` returns. */
const MAX_DEEP_LAYERS = 10_000;

const DEEP_FIELDS = ['name', 'type', 'absoluteBounds'];

export async function read(ctx: Context, input: ReadInput): Promise<unknown> {
  const ids = input.ids?.length ? input.ids : [await layerId(ctx, input)];

  if (input.deep) {
    return readDeep(ctx, ids, [...DEEP_FIELDS, ...(input.fields ?? [])]);
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
  const found = await must(
    ctx,
    roots.map((root) => ({ command: 'node.find', params: { root, limit: MAX_DEEP_LAYERS } })),
  );
  const ids = [...roots];

  for (const [index, step] of found.entries()) {
    const result = (step.result ?? {}) as { ids?: number[]; total?: number };

    if ((result.total ?? 0) > MAX_DEEP_LAYERS) {
      throw new OpError(
        `layer ${roots[index]} has ${result.total} layers inside it, and a deep read stops at ` +
          `${MAX_DEEP_LAYERS}. Read its children instead.`,
      );
    }

    ids.push(...(result.ids ?? []));
  }

  const unique = [...new Set(ids)];
  const steps = await must(
    ctx,
    unique.map((id) => ({
      command: 'node.get',
      params: { id, fields: [...new Set([...fields, 'children'])] },
    })),
  );
  const parents = new Map<number, number>();
  const layers = steps.map((step, index) => {
    const node = (step.result ?? {}) as Record<string, unknown> & { children?: { id: number }[] };
    const id = unique[index] as number;
    const children = (node.children ?? []).map((child) => child.id);

    for (const child of children) {
      parents.set(child, id);
    }

    return { ...node, id, children };
  });
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
  commands: (Command & { where?: Where })[];
  /** Save afterwards. Defaults to true when a command changes the document. */
  write?: boolean;
};

/** Picks a command's layers by what they are instead of by id; fills its `ids`. */
export type Where = {
  /** Search inside this layer or these layers, or on this page. One of the two is required. */
  root?: number | number[];
  page?: string | number;
  /** The exact layer name. */
  name?: string;
  type?: string;
  /** Text content, as a substring. */
  text?: string;
  /** Instances of the main component with this name (substring). */
  component?: string;
};

const MAX_STEP_BYTES = 4_096;

/** Commands that can add, rename or remove a variable, style, component or page. */
const NAME_COMMANDS = /^(variable|style|component|page|library)\./;

export async function run(ctx: Context, input: RunInput): Promise<unknown> {
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

  return merged.stepOf.map((index, original) => {
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
  });
}

/**
 * Turns each command's `where` into `ids`, so a change to every layer of a kind needs no script
 * that looks the ids up first. A selector that matches nothing fails before anything changes.
 */
async function resolveWhere(
  ctx: Context,
  commands: RunInput['commands'],
): Promise<{ commands: Command[]; matched: (number | undefined)[] }> {
  const needsCatalog = commands.some(
    (entry) =>
      usesComponentName(entry) ||
      (entry.where && (entry.where.root === undefined || entry.where.component)),
  );
  const catalog = needsCatalog ? await ctx.catalog.get() : null;

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
      const params: Record<string, unknown> = { root: each, limit: MAX_DEEP_LAYERS };

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

    matched.push(ids.length);

    return { ...command, params: { ...params, ids } };
  });

  return { commands: resolved, matched };
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
// shared
// ---------------------------------------------------------------------------------------------

function assertWritable(ctx: Context): void {
  if (ctx.project.writeBlocked) {
    throw new OpError(`refusing to change ${ctx.project.file}: ${ctx.project.writeBlocked}.`);
  }
}

/** Runs read-only commands and throws on failure. */
async function must(ctx: Context, commands: Command[]) {
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
