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
  variables: { name: string; type: string; collection: string }[];
  styles: { name: string; type: string }[];
  components: CatalogComponent[];
  pages: { id: number; name: string }[];
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

  return {
    invalidate() {
      memory = null;
    },
    async carry() {
      // The cache is keyed by the file's state, which the write just changed.
      const path = memory && engine.mode === 'headless' ? cacheFile(config, file) : null;

      if (path) {
        await Bun.write(path, JSON.stringify(memory));
      }
    },
    async get(refresh = false) {
      if (memory && !refresh) {
        return memory;
      }

      // The app's document can differ from the file on disk, so only headless reads are cached.
      const cachePath = engine.mode === 'headless' ? cacheFile(config, file) : null;

      if (cachePath && !refresh && existsSync(cachePath)) {
        try {
          memory = (await Bun.file(cachePath).json()) as Catalog;

          return memory;
        } catch {
          // Fall through and rebuild a damaged cache.
        }
      }

      const result = await engine.run(
        [
          { command: 'variable.list', params: {} },
          { command: 'style.list', params: {} },
          { command: 'component.list', params: {} },
          { command: 'page.list', params: {} },
        ],
        { write: false },
      );

      if (!result.ok) {
        throw new Error(`could not list the document's names: ${result.error}`);
      }

      memory = toCatalog(result.steps.map((step) => step.result));

      if (cachePath) {
        await mkdir(config.tempDir, { recursive: true });
        await Bun.write(cachePath, JSON.stringify(memory));
      }

      return memory;
    },
  };
}

function cacheFile(config: Config, file: string): string | null {
  try {
    const stat = statSync(file);
    const key = Bun.hash(`${file}:${stat.mtimeMs}:${stat.size}`).toString(36);

    return join(config.tempDir, `catalog-${key}.json`);
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
      name: String(entry.name),
      type: String(entry.resolvedType ?? ''),
      collection: collections.get(String(entry.collection)) ?? '',
    })),
    styles: asList(styleList).map((entry) => ({
      name: String(entry.name),
      type: String(entry.type ?? ''),
    })),
    components: asList(componentList).map((entry) => ({
      id: Number(entry.id),
      name: String(entry.name),
      set: entry.type === 'COMPONENT_SET',
    })),
    pages: asList(pageList)
      .filter((entry) => entry.divider !== true)
      .map((entry) => ({ id: Number(entry.id), name: String(entry.name).trim() })),
  };
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
