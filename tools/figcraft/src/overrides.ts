import type { Command } from './engine';

/**
 * What an instance changes inside itself: typed-over text, a fill variable, a size. FigCraft keeps
 * these by the id of the layer inside the instance, and gives that layer a new id when the main
 * component's layer is rebuilt, so a change to a variant's layer tree resets them. Here a layer is
 * named by what survives such a change: an instance it is in, its name, type and parent's name,
 * and its place among the layers like it inside that instance.
 */
export type Override = {
  /** The innermost instance the layer is in. */
  instance: number;
  /** The layer's name. */
  layer: string;
  type?: string;
  /** The name of the layer's parent. Layers with another parent are then not counted. */
  parent?: string;
  /** Which of the layers with that name, type and parent inside the instance, from 0. */
  index?: number;
  /**
   * The instances around `instance`, innermost first, each with the layer's index inside it. An
   * instance that comes from its main component is rebuilt with it and gets a new id; the layer
   * is then found from the first of these that still exists.
   */
  outer?: [instance: number, index: number][];
  characters?: string;
  /** The variable bound to the fill, by name. */
  fill?: string;
  width?: number;
  height?: number;
};

export type Layer = {
  id: number;
  name?: string;
  type?: string;
  children: number[];
  /** The kinds of override FigCraft reports on the layer. */
  overrides?: string[];
  characters?: string;
  boundVariables?: Record<string, unknown>;
  width?: number;
  height?: number;
};

/** The properties `collectOverrides` and `planRestore` read from each layer. */
export const OVERRIDE_FIELDS = [
  'name',
  'type',
  'overrides',
  'characters',
  'boundVariables',
  'width',
  'height',
];

const VALUES = ['characters', 'fill', 'width', 'height'] as const;

/**
 * The overrides of every instance under the roots, and how many overrides of each other kind
 * were left out.
 */
export function collectOverrides(
  layers: Map<number, Layer>,
  roots: number[],
): { entries: Override[]; skipped: Record<string, number> } {
  const entries: Override[] = [];
  const skipped: Record<string, number> = {};

  type Around = { id: number; seen: Map<string, number> };

  // `around` holds the instances the layer is in, outermost first.
  const visit = (id: number, parent: Layer | null, around: Around[]): void => {
    const layer = layers.get(id);

    if (!layer) {
      return;
    }

    if (around.length > 0) {
      const key = `${layer.type}\n${layer.name}\n${parent?.name}`;
      // The layer's place inside each instance around it, counted whether or not it is saved.
      const places = around.map((instance): [number, number] => {
        const index = instance.seen.get(key) ?? 0;

        instance.seen.set(key, index + 1);

        return [instance.id, index];
      });
      const values: Partial<Override> = {};

      for (const kind of layer.overrides ?? []) {
        if (kind === 'characters' && typeof layer.characters === 'string') {
          values.characters = layer.characters;
        } else if (kind === 'fills' && typeof layer.boundVariables?.fill === 'string') {
          values.fill = layer.boundVariables.fill;
        } else if (kind === 'size' && layer.width !== undefined && layer.height !== undefined) {
          values.width = layer.width;
          values.height = layer.height;
        } else {
          skipped[kind] = (skipped[kind] ?? 0) + 1;
        }
      }

      if (Object.keys(values).length > 0) {
        const [inner, ...outer] = places.reverse() as [[number, number], ...[number, number][]];

        entries.push({
          instance: inner[0],
          layer: layer.name ?? '',
          type: layer.type,
          parent: parent?.name,
          index: inner[1],
          ...(outer.length > 0 ? { outer } : {}),
          ...values,
        });
      }
    }

    const inside =
      layer.type === 'INSTANCE' ? [...around, { id, seen: new Map<string, number>() }] : around;

    for (const child of layer.children) {
      visit(child, layer, inside);
    }
  };

  for (const root of roots) {
    visit(root, null, []);
  }

  return { entries, skipped };
}

/** The instances an override can be found from, innermost first. */
export function anchors(entry: Override): [instance: number, index: number | undefined][] {
  return [[entry.instance, entry.index], ...(entry.outer ?? [])];
}

export type RestoreReport = {
  /** Overrides that changed a layer. */
  set: number;
  /** Overrides whose layer already had the value. */
  unchanged: number;
  /** Overrides whose instance or layer is gone, counted by what is missing. */
  missing?: Record<string, number>;
};

/**
 * The commands that put the overrides back, given the layers as they are now: those of the first
 * instance of each override that still exists. A layer that already has the value is left alone.
 * A layer that is gone is reported and not guessed at: after a variant changed, some layers are
 * meant to be gone, and a value on the wrong layer is worse than a missing one.
 */
export function planRestore(
  entries: Override[],
  layers: Map<number, Layer>,
): { commands: Command[]; report: RestoreReport } {
  const commands: Command[] = [];
  const report: RestoreReport = { set: 0, unchanged: 0 };
  const missing: Record<string, number> = {};
  const inside = new Map<number, { layer: Layer; parent: Layer }[]>();

  const count = (label: string): void => {
    missing[label] = (missing[label] ?? 0) + 1;
  };

  const layersOf = (instance: number): { layer: Layer; parent: Layer }[] => {
    let list = inside.get(instance);

    if (!list) {
      const found: { layer: Layer; parent: Layer }[] = [];

      const collect = (parent: Layer): void => {
        for (const child of parent.children) {
          const layer = layers.get(child);

          if (layer) {
            found.push({ layer, parent });
            collect(layer);
          }
        }
      };

      collect(layers.get(instance) as Layer);
      inside.set(instance, found);
      list = found;
    }

    return list;
  };

  for (const [position, entry] of entries.entries()) {
    if (!entry || typeof entry.instance !== 'number' || typeof entry.layer !== 'string') {
      throw new Error(`override ${position} needs an "instance" id and a "layer" name.`);
    }

    if (!VALUES.some((key) => entry[key] !== undefined)) {
      throw new Error(`override ${position} sets nothing. Give ${VALUES.join(', ')}.`);
    }

    const anchor = anchors(entry).find(([id]) => layers.has(id));

    if (!anchor) {
      count(`instance ${entry.instance}`);
      continue;
    }

    const [instance, index] = anchor;
    const named = layersOf(instance).filter(
      ({ layer }) => layer.name === entry.layer && (!entry.type || layer.type === entry.type),
    );
    const label =
      `${entry.type ?? 'layer'} "${entry.layer}"` + (entry.parent ? ` in "${entry.parent}"` : '');
    let layer: Layer | undefined;

    if (entry.parent === undefined) {
      if (index === undefined && named.length > 1) {
        throw new Error(
          `override ${position}: instance ${instance} has ${named.length} layers named ` +
            `"${entry.layer}". Give "index", from 0 to ${named.length - 1} in document order, ` +
            'or "parent".',
        );
      }

      layer = named[index ?? 0]?.layer;
    } else {
      const under = named.filter(({ parent }) => parent.name === entry.parent);

      // With no layer under that parent, the one layer of that name is the same layer under a
      // new parent. With several, any of them could be.
      layer = under.length > 0 ? under[index ?? 0]?.layer : named.length === 1 ? named[0]?.layer : undefined;
    }

    if (!layer) {
      count(label);
      continue;
    }

    const params: Record<string, unknown> = {};

    if (entry.characters !== undefined && entry.characters !== layer.characters) {
      params.characters = entry.characters;
    }

    for (const side of ['width', 'height'] as const) {
      const wanted = entry[side];

      if (wanted !== undefined && !(Math.abs(wanted - (layer[side] ?? Number.NaN)) < 0.01)) {
        params[side] = wanted;
      }
    }

    const rebind = entry.fill !== undefined && entry.fill !== layer.boundVariables?.fill;

    if (Object.keys(params).length > 0) {
      commands.push({ command: 'node.set', params: { ids: [layer.id], ...params } });
    }

    if (rebind) {
      commands.push({
        command: 'variable.bind',
        params: { ids: [layer.id], field: 'fill', variable: entry.fill },
      });
    }

    if (rebind || Object.keys(params).length > 0) {
      report.set += 1;
    } else {
      report.unchanged += 1;
    }
  }

  if (Object.keys(missing).length > 0) {
    report.missing = missing;
  }

  return { commands, report };
}
