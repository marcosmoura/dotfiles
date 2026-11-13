import type { FigDocument } from './document';

/** What the check and the report need of one layer. */
export type LayerPrint = {
  hash: bigint;
  type: string;
  parent: number | null;
  name: string;
  /** The id of the linked text style of a text layer. */
  textStyle: string | null;
};

/** One document reduced to fingerprints: the parsed document can be dropped afterwards. */
export type Prints = {
  layers: Map<number, LayerPrint>;
  /** A hash of each text style's definition, by style id. */
  textStyles: Map<string, { hash: bigint; name: string }>;
};

export type ClassName = 'untouched' | 'fromOther' | 'fromThis' | 'merged' | 'sideEffect';

export type Reason = 'instance' | 'style restored' | 'created' | 'changed';

export type SideEffect = { id: number; name: string; type: string; reason: Reason };

export type Group = {
  page: string;
  frame: { id: number; name: string };
  layers: { id: number; name: string; type: string; reason: Reason }[];
};

export type Lost = { id: number; name: string; side: 'mine' | 'other' };

export type Restored = { style: string; layers: number[] };

export type Report = {
  classes: Record<ClassName, number>;
  groups: Group[];
  restored: Restored[];
};

export const LOST_LIMIT = 20;
export const GROUP_LIMIT = 20;
export const GROUP_LAYERS = 5;

type RawLayer = {
  type?: string;
  name?: string;
  parent?: number | null;
  styles?: { text?: string | null } | null;
};

type RawStyle = { id: string; type?: string; name?: string };

export function fingerprint(document: FigDocument): Prints {
  const layers = new Map<number, LayerPrint>();

  for (const [key, value] of Object.entries(document.nodes ?? {})) {
    const layer = value as RawLayer;
    const type = layer.type ?? '';

    layers.set(Number(key), {
      hash: Bun.hash.wyhash(JSON.stringify(layer)) as bigint,
      type,
      parent: layer.parent ?? null,
      name: layer.name ?? '',
      textStyle: type === 'text' ? (layer.styles?.text ?? null) : null,
    });
  }

  const textStyles = new Map<string, { hash: bigint; name: string }>();

  for (const style of (document.styles ?? []) as RawStyle[]) {
    if (style.type === 'text') {
      textStyles.set(style.id, {
        hash: Bun.hash.wyhash(JSON.stringify(style)) as bigint,
        name: style.name ?? '',
      });
    }
  }

  return { layers, textStyles };
}

/** The layer and its ancestors in one document, nearest first. */
export function lineage(prints: Prints, id: number): number[] {
  const chain: number[] = [];
  const seen = new Set<number>();
  let current: number | null = id;

  while (current !== null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = prints.layers.get(current)?.parent ?? null;
  }

  return chain;
}

/** One of the layer's ancestors (not the layer itself) is an instance. */
export function insideInstance(prints: Prints, id: number): boolean {
  return lineage(prints, id)
    .slice(1)
    .some((ancestor) => prints.layers.get(ancestor)?.type === 'instance');
}

/**
 * The layers of mine or other that the result lost, except those that one side deleted (the
 * layer or an ancestor of it in the document that has it) and those inside an instance.
 */
export function lostLayers(base: Prints, mine: Prints, other: Prints, result: Prints): Lost[] {
  const lost: Lost[] = [];
  const listed = new Set<number>();
  const deleted = (id: number): boolean =>
    base.layers.has(id) && (!mine.layers.has(id) || !other.layers.has(id));

  for (const [side, prints] of [
    ['mine', mine],
    ['other', other],
  ] as const) {
    for (const [id, layer] of prints.layers) {
      if (result.layers.has(id) || listed.has(id)) {
        continue;
      }

      if (lineage(prints, id).some(deleted) || insideInstance(prints, id)) {
        continue;
      }

      listed.add(id);
      lost.push({ id, name: layer.name, side });
    }
  }

  return lost;
}

export function lostMessage(lost: Lost[]): string {
  const listed = lost
    .slice(0, LOST_LIMIT)
    .map(
      (item) => `${item.id} "${item.name}" (${item.side === 'mine' ? 'HEAD' : 'the other side'})`,
    )
    .join(', ');
  const more = lost.length > LOST_LIMIT ? ` and ${lost.length - LOST_LIMIT} more` : '';

  return (
    `the merged file lost ${lost.length} layer(s) that one side has and no side deleted: ` +
    `${listed}${more}. Nothing was written.`
  );
}

/** The class of every layer of the result, and the side effects with their reasons. */
export function classify(
  base: Prints,
  mine: Prints,
  other: Prints,
  result: Prints,
  restored: Set<number> = new Set(),
): { classes: Record<ClassName, number>; sideEffects: SideEffect[] } {
  const classes: Record<ClassName, number> = {
    untouched: 0,
    fromOther: 0,
    fromThis: 0,
    merged: 0,
    sideEffect: 0,
  };
  const sideEffects: SideEffect[] = [];

  for (const [id, layer] of result.layers) {
    const b = base.layers.get(id)?.hash;
    const m = mine.layers.get(id)?.hash;
    const o = other.layers.get(id)?.hash;
    const r = layer.hash;
    const mineChanged = m !== b;
    const otherChanged = o !== b;
    let name: ClassName;

    if (!mineChanged && !otherChanged) {
      name = r === b ? 'untouched' : 'sideEffect';
    } else if (mineChanged && otherChanged) {
      name = 'merged';
    } else if (otherChanged) {
      name = r === o ? 'fromOther' : 'sideEffect';
    } else {
      name = r === m ? 'fromThis' : 'sideEffect';
    }

    classes[name] += 1;

    if (name === 'sideEffect') {
      let reason: Reason;

      // The most specific cause first. A layer inside an instance followed its component,
      // whether the merge changed it or made it.
      if (restored.has(id)) {
        reason = 'style restored';
      } else if (layer.type === 'instance' || insideInstance(result, id)) {
        reason = 'instance';
      } else if (b === undefined && m === undefined && o === undefined) {
        reason = 'created';
      } else {
        reason = 'changed';
      }

      sideEffects.push({ id, name: layer.name, type: layer.type, reason });
    }
  }

  return { classes, sideEffects };
}

/** Side effects by page and top-level frame of the result, largest group first. */
export function groupSideEffects(result: Prints, sideEffects: SideEffect[]): Group[] {
  const groups = new Map<number, Group>();

  for (const effect of sideEffects) {
    const chain = lineage(result, effect.id);
    const page = chain.at(-1) as number;
    const frame = chain.length > 1 ? (chain.at(-2) as number) : page;
    let group = groups.get(frame);

    if (!group) {
      group = {
        page: result.layers.get(page)?.name ?? '',
        frame: { id: frame, name: result.layers.get(frame)?.name ?? '' },
        layers: [],
      };
      groups.set(frame, group);
    }

    group.layers.push({ ...effect });
  }

  return [...groups.values()].sort((a, b) => b.layers.length - a.layers.length);
}

/**
 * The text layers to link again, by style id: in `main`'s document they link to a text style the
 * branch redefined, the branch does not have them or has them as in the base, and the result has
 * them without the link.
 */
export function layersToRepair(
  base: Prints,
  figMain: Prints,
  figBranch: Prints,
  result: Prints,
): Map<string, number[]> {
  const redefined = new Set<string>();

  for (const [id, style] of figBranch.textStyles) {
    const before = base.textStyles.get(id);

    if (before && before.hash !== style.hash) {
      redefined.add(id);
    }
  }

  const repairs = new Map<string, number[]>();

  for (const [id, layer] of figMain.layers) {
    const style = layer.textStyle;

    if (layer.type !== 'text' || style === null || !redefined.has(style)) {
      continue;
    }

    const branch = figBranch.layers.get(id);

    if (branch && branch.hash !== base.layers.get(id)?.hash) {
      continue;
    }

    const merged = result.layers.get(id);

    if (!merged || merged.textStyle === style) {
      continue;
    }

    repairs.set(style, [...(repairs.get(style) ?? []), id]);
  }

  return repairs;
}

/** The repaired layers that still lack their style's link. */
export function stillUnlinked(repairs: Map<string, number[]>, result: Prints): number[] {
  return [...repairs].flatMap(([style, ids]) =>
    ids.filter((id) => result.layers.get(id)?.textStyle !== style),
  );
}

export function reportLines(report: Report, total: number, jsonPath: string): string[] {
  const { classes } = report;
  const lines = [
    `layers in the result: ${total}; untouched ${classes.untouched}, from the other side ` +
      `${classes.fromOther}, from this side ${classes.fromThis}, merged ${classes.merged}, ` +
      `side effects ${classes.sideEffect}`,
  ];

  if (report.groups.length === 0) {
    lines.push('side effects: none');
  } else {
    lines.push(`side effects: ${classes.sideEffect} in ${report.groups.length} group(s)`);

    for (const group of report.groups.slice(0, GROUP_LIMIT)) {
      lines.push(
        `  page "${group.page}", frame ${group.frame.id} "${group.frame.name}": ${group.layers.length}`,
      );

      for (const layer of group.layers.slice(0, GROUP_LAYERS)) {
        lines.push(`    ${layer.id} "${layer.name}" ${layer.reason}`);
      }

      if (group.layers.length > GROUP_LAYERS) {
        lines.push(`    and ${group.layers.length - GROUP_LAYERS} more`);
      }
    }

    if (report.groups.length > GROUP_LIMIT) {
      lines.push(`  and ${report.groups.length - GROUP_LIMIT} more group(s)`);
    }
  }

  for (const item of report.restored) {
    lines.push(`text style restored: "${item.style}", ${item.layers.length} layer(s)`);
  }

  lines.push(`report: ${jsonPath}`);

  return lines;
}
