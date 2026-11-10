import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expandTree, UnknownName, type NameUse, type TreeNode } from './build';
import { byteLength } from './bytes';
import { findComponent, findPage, suggest, type Catalog, type CatalogStore } from './catalog';
import type { Command, Engine } from './engine';
import { fit, prune } from './prune';
import type { Project } from './project';
import type { Config } from './settings';

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
  kind?: 'layer' | 'variable' | 'style' | 'component' | 'page';
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
    rows = catalog.pages
      .filter((entry) => matches(entry.name))
      .map((entry) => `${entry.id}\t${entry.name}`);
  } else {
    throw new OpError(`unknown kind "${kind}". Use layer, variable, style, component or page.`);
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

function pageId(catalog: Catalog, page: string | number): number {
  if (typeof page === 'number') {
    return page;
  }

  const found = findPage(catalog, page);

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
};

export async function read(ctx: Context, input: ReadInput): Promise<unknown> {
  const ids = input.ids?.length ? input.ids : [await layerId(ctx, input)];
  const shape = input.fields?.length ? { fields: input.fields } : { outline: true };
  const steps = await must(
    ctx,
    ids.map((id) => ({ command: 'node.get', params: { id, ...shape } })),
  );
  // The byte budget is shared, so asking for many layers cannot return more than one would.
  const budget = Math.floor(ctx.config.maxBytes / ids.length);
  const nodes = steps.map((step, index) => {
    if (!step.result) {
      throw new OpError(`no layer with id ${ids[index]}.`);
    }

    return fit('get_node', prune(step.result, true), budget).value;
  });

  return input.ids?.length ? nodes : nodes[0];
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
  const parent =
    typeof input.parent === 'string'
      ? await layerId(ctx, { name: input.parent, page: input.page })
      : input.parent;
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

  // A build creates layers only, so the known names are still right.
  await ctx.catalog.carry();

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
  commands: Command[];
  /** Save afterwards. Defaults to true when a command changes the document. */
  write?: boolean;
};

const MAX_STEP_BYTES = 4_096;

/** Commands that can add, rename or remove a variable, style, component or page. */
const NAME_COMMANDS = /^(variable|style|component|page|library)\./;

export async function run(ctx: Context, input: RunInput): Promise<unknown> {
  if (!Array.isArray(input.commands) || input.commands.length === 0) {
    throw new OpError('run needs a non-empty "commands" array of {command, params, as?}.');
  }

  const write = input.write ?? (await changesDocument(ctx.config, input.commands));

  if (write) {
    assertWritable(ctx);
  }

  const result = await ctx.engine.run(input.commands, { write });

  if (!result.ok) {
    throw new OpError(`nothing was changed. ${result.error}`);
  }

  if (write) {
    if (input.commands.some((entry) => NAME_COMMANDS.test(entry.command))) {
      ctx.catalog.invalidate();
    } else {
      await ctx.catalog.carry();
    }
  }

  return result.steps.map((step) => {
    const value = prune(step.result);
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

// ---------------------------------------------------------------------------------------------
// shot
// ---------------------------------------------------------------------------------------------

export type ShotInput = {
  ids?: number[];
  name?: string;
  page?: string | number;
  /** Export scale; chosen from the layer's size when absent. */
  scale?: number;
};

export async function shot(ctx: Context, input: ShotInput): Promise<string> {
  const ids = input.ids?.length ? input.ids : [await layerId(ctx, input)];
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
  const written = await must(ctx, exports);

  return written
    .map((step, index) => {
      const result = (step.result ?? {}) as { path?: string; bytes?: number };
      const node = (sizes[index]?.result ?? {}) as Record<string, unknown>;

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
      const params =
        byteLength(entry.params) > MAX_PARAM_BYTES
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
