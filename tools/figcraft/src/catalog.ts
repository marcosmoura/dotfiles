import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Engine } from './engine';
import type { Config } from './settings';

export type CatalogComponent = { id: number; name: string; set: boolean };

/**
 * The names an agent may refer to. FigCraft's own listings are far too large to hand to a model
 * (hundreds of kilobytes on a real design system), so only names and ids are kept.
 */
export type Catalog = {
  variables: { id: string; name: string; type: string; collection: string }[];
  styles: { id: string; name: string; type: string }[];
  components: CatalogComponent[];
  /** `index` is the page's place among all pages, dividers included. */
  pages: { id: number; name: string; index: number }[];
  /** Variable collections with their mode names, in order; the first is the default. */
  collections: { name: string; modes: string[] }[];
};

export type CatalogStore = {
  get(refresh?: boolean): Promise<Catalog>;
  /** Forget the names: a write may have added or renamed some. */
  invalidate(): void;
  /** Keep the names across a write that cannot have changed them. */
  carry(): Promise<void>;
};

type Listing = Record<string, unknown>;

export function createCatalogStore(engine: Engine, config: Config, file: string): CatalogStore {
  let memory: Catalog | null = null;
  // The state of the file `memory` was read from: a server outlives many changes to the file,
  // including ones made by the app or another tool.
  let memoryAt: string | null = null;
  // The app's document can differ from the file on disk, so only headless reads are cached.
  const cachePath = (): string | null =>
    engine.mode === 'headless' ? cacheFile(config, file) : null;

  return {
    invalidate() {
      memory = null;
    },
    async carry() {
      // The cache is keyed by the file's state, which the write just changed.
      const path = memory ? cachePath() : null;

      if (path) {
        memoryAt = path;
        await Bun.write(path, JSON.stringify(memory));
      }
    },
    async get(refresh = false) {
      const path = cachePath();

      if (memory && !refresh && (path === null || path === memoryAt)) {
        return memory;
      }

      if (path && !refresh && existsSync(path)) {
        try {
          memory = (await Bun.file(path).json()) as Catalog;
          memoryAt = path;

          return memory;
        } catch {
          // Fall through and rebuild a damaged cache.
        }
      }

      memory = await readNames(engine);
      memoryAt = path;

      if (path) {
        await mkdir(config.tempDir, { recursive: true });
        await Bun.write(path, JSON.stringify(memory));
      }

      return memory;
    },
  };
}

async function readNames(engine: Engine): Promise<Catalog> {
  const result = await engine.run(
    [
      { command: 'variable.list', params: {} },
      { command: 'style.list', params: {} },
      { command: 'page.list', params: {} },
    ],
    { write: false },
  );

  if (!result.ok) {
    throw new Error(`could not list the document's names: ${result.error}`);
  }

  const [variables, styles, pages] = result.steps.map((step) => step.result);

  return toCatalog([variables, styles, await listComponents(engine, pages), pages]);
}

const FIND_LIMIT = 10_000;

/**
 * The components, by searching each page. FigCraft's `component.list` also counts every
 * component's instances, which takes 10 to 15 seconds on a 200,000-layer file; it is only the
 * fallback for a page with more components than one search returns.
 */
async function listComponents(engine: Engine, pages: unknown): Promise<unknown> {
  const roots = asList(pages).map((page) => Number(page.id));
  const found = await engine.run(
    roots.flatMap((root) =>
      ['COMPONENT_SET', 'COMPONENT'].map((type) => ({
        command: 'node.find',
        params: { root, type, limit: FIND_LIMIT },
      })),
    ),
    { write: false },
  );
  const results = found.ok
    ? found.steps.map((step) => (step.result ?? {}) as { ids?: number[]; total?: number })
    : [];
  const ids = results.flatMap((entry) => entry.ids ?? []);

  if (found.ok && ids.length === 0) {
    return [];
  }

  if (found.ok && results.every((entry) => (entry.total ?? 0) <= FIND_LIMIT)) {
    const named = await engine.run(
      ids.map((id) => ({ command: 'node.get', params: { id, fields: ['name', 'type'] } })),
      { write: false },
    );

    if (named.ok) {
      return named.steps.map((step) => step.result);
    }
  }

  const listed = await engine.run([{ command: 'component.list', params: {} }], { write: false });

  if (!listed.ok) {
    throw new Error(`could not list the document's components: ${listed.error}`);
  }

  return listed.steps[0]?.result;
}

function cacheFile(config: Config, file: string): string | null {
  try {
    const stat = statSync(file);
    const key = Bun.hash(`${file}:${stat.mtimeMs}:${stat.size}`).toString(36);

    // The number is the shape of the cached catalog; raise it when the shape changes.
    return join(config.tempDir, `catalog5-${key}.json`);
  } catch {
    return null;
  }
}

export function toCatalog(listings: unknown[]): Catalog {
  const [variableList, styleList, componentList, pageList] = listings;
  const variables = (variableList ?? {}) as { collections?: Listing[]; variables?: Listing[] };
  const collections = new Map(
    (variables.collections ?? []).map((entry) => [String(entry.id), String(entry.name)]),
  );

  return {
    variables: (variables.variables ?? []).map((entry) => ({
      id: String(entry.id),
      name: String(entry.name),
      type: String(entry.resolvedType ?? ''),
      collection: collections.get(String(entry.collection)) ?? '',
    })),
    styles: asList(styleList).map((entry) => ({
      id: String(entry.id),
      name: String(entry.name),
      type: String(entry.type ?? ''),
    })),
    components: asList(componentList).map((entry) => ({
      id: Number(entry.id),
      name: String(entry.name),
      set: entry.type === 'COMPONENT_SET',
    })),
    pages: pagesOf(pageList),
    collections: (variables.collections ?? []).map((entry) => ({
      name: String(entry.name),
      modes: asList(entry.modes).map((mode) => String(mode.name)),
    })),
  };
}

function pagesOf(pageList: unknown): Catalog['pages'] {
  return asList(pageList)
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.divider !== true)
    .map(({ entry, index }) => ({ id: Number(entry.id), name: String(entry.name).trim(), index }));
}

function asList(value: unknown): Listing[] {
  return Array.isArray(value) ? (value as Listing[]) : [];
}

/** A component or component set by exact name; a set wins over a variant of the same name. */
export function findComponent(catalog: Catalog, name: string): CatalogComponent | null {
  const exact = catalog.components.filter((entry) => entry.name === name);
  const pool = exact.length
    ? exact
    : catalog.components.filter((entry) => entry.name.toLowerCase() === name.toLowerCase());

  return pool.find((entry) => entry.set) ?? pool[0] ?? null;
}

export function findPage(catalog: Catalog, name: string): { id: number; name: string } | null {
  const wanted = name.trim().toLowerCase();

  return (
    catalog.pages.find((page) => page.name.toLowerCase() === wanted) ??
    catalog.pages.find((page) => page.name.toLowerCase().includes(wanted)) ??
    null
  );
}

/** The closest names to a misspelt one, best first. */
export function suggest(names: string[], query: string, limit = 5): string[] {
  const wanted = query.toLowerCase();
  const scored: { name: string; score: number }[] = [];

  for (const name of new Set(names)) {
    const score = similarity(name.toLowerCase(), wanted);

    if (score > 0.45) {
      scored.push({ name, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);
}

function similarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }

  const contains = a.includes(b) || b.includes(a) ? 0.25 : 0;
  const edits = 1 - distance(a, b) / Math.max(a.length, b.length);

  return Math.min(1, Math.max(dice(a, b), edits) + contains);
}

/** Levenshtein distance, which catches the swapped letters that bigrams miss. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];

    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;

      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }

    previous = current;
  }

  return previous[b.length] ?? 0;
}

/** Dice coefficient over character bigrams. */
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) {
    return 0;
  }

  const counts = new Map<string, number>();

  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2);

    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  let shared = 0;

  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2);
    const left = counts.get(gram) ?? 0;

    if (left > 0) {
      counts.set(gram, left - 1);
      shared += 1;
    }
  }

  return (2 * shared) / (a.length - 1 + (b.length - 1));
}
