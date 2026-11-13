import { describe, expect, test } from 'bun:test';

import type { FigDocument } from './document';
import {
  classify,
  fingerprint,
  groupSideEffects,
  insideInstance,
  layersToRepair,
  lostLayers,
  lostMessage,
  reportLines,
  stillUnlinked,
  type LayerPrint,
  type Prints,
} from './merge-report';

type Spec = [hash: number, type: string, parent: number | null, textStyle?: string];

/** Prints written by hand: id → [hash, type, parent, text style]; the name is `L<id>`. */
function prints(layers: Record<number, Spec>, styles: Record<string, number> = {}): Prints {
  return {
    layers: new Map(
      Object.entries(layers).map(([id, [hash, type, parent, textStyle]]): [number, LayerPrint] => [
        Number(id),
        { hash: BigInt(hash), type, parent, name: `L${id}`, textStyle: textStyle ?? null },
      ]),
    ),
    textStyles: new Map(
      Object.entries(styles).map(([id, hash]) => [id, { hash: BigInt(hash), name: `Name ${id}` }]),
    ),
  };
}

// A page, a frame, a text and an instance with a sublayer.
const BASE: Record<number, Spec> = {
  1: [1, 'page', null],
  2: [2, 'frame', 1],
  3: [3, 'text', 2],
  4: [4, 'instance', 2],
  5: [5, 'text', 4],
};

describe('fingerprints', () => {
  test('hash, type, parent, name and the text style of a text; text styles by id', () => {
    const document = {
      next_id: 4,
      nodes: {
        '1': { type: 'page', name: 'Page 1', parent: null, styles: null },
        '2': { type: 'text', name: 'T', parent: 1, styles: { text: 'S:1', fill: null } },
        '3': { type: 'rectangle', name: 'R', parent: 1, styles: { text: 'S:1' } },
      },
      styles: [
        { id: 'S:1', type: 'text', name: 'Body', style: { font_size: 12 } },
        { id: 'S:2', type: 'paint', name: 'Fill' },
      ],
    } as unknown as FigDocument;
    const result = fingerprint(document);

    expect(result.layers.get(1)).toMatchObject({ type: 'page', parent: null, textStyle: null });
    expect(result.layers.get(2)).toMatchObject({ name: 'T', parent: 1, textStyle: 'S:1' });
    expect(result.layers.get(3)?.textStyle).toBeNull();
    expect(result.layers.get(2)?.hash).toBe(
      Bun.hash.wyhash(JSON.stringify(document.nodes['2'])) as bigint,
    );
    expect([...result.textStyles.keys()]).toEqual(['S:1']);

    const changed = structuredClone(document);

    (changed.styles?.[0] as unknown as { style: { font_size: number } }).style.font_size = 20;
    expect(fingerprint(changed).textStyles.get('S:1')?.hash).not.toBe(
      result.textStyles.get('S:1')?.hash,
    );
  });

  test('inside an instance: an ancestor is one', () => {
    const base = prints(BASE);

    expect(insideInstance(base, 5)).toBe(true);
    expect(insideInstance(base, 4)).toBe(false);
    expect(insideInstance(base, 3)).toBe(false);
  });
});

describe('classes', () => {
  test('every class, and the counts add up to the result', () => {
    const base = prints(BASE);
    const mine = prints({ ...BASE, 3: [30, 'text', 2], 6: [6, 'rectangle', 2] });
    const other = prints({ ...BASE, 2: [20, 'frame', 1], 3: [31, 'text', 2] });
    const result = prints({
      ...BASE,
      2: [20, 'frame', 1],
      3: [32, 'text', 2],
      6: [6, 'rectangle', 2],
    });
    const { classes, sideEffects } = classify(base, mine, other, result);

    expect(classes).toEqual({ untouched: 3, fromOther: 1, fromThis: 1, merged: 1, sideEffect: 0 });
    expect(sideEffects).toEqual([]);
    expect(Object.values(classes).reduce((a, b) => a + b, 0)).toBe(result.layers.size);
  });

  test('the three kinds of side effect and their reasons', () => {
    const base = prints(BASE);
    const mine = prints({ ...BASE, 6: [6, 'text', 2] });
    const other = prints({ ...BASE, 2: [20, 'frame', 1] });
    const result = prints({
      ...BASE,
      // Neither side changed them, the result differs: one inside an instance, one plain.
      5: [50, 'text', 4],
      3: [33, 'text', 2],
      // Other changed it, the result is not other's version.
      2: [21, 'frame', 1],
      // Mine added it, the result differs: the repair applied its style.
      6: [60, 'text', 2],
      // Only the result has it.
      7: [7, 'rectangle', 2],
      // Only the result has it, inside an instance: it came with a change to the component.
      8: [8, 'text', 4],
      // An instance itself that followed its component.
      4: [40, 'instance', 2],
    });
    const { classes, sideEffects } = classify(base, mine, other, result, new Set([6]));
    const reasons = Object.fromEntries(sideEffects.map((effect) => [effect.id, effect.reason]));

    expect(classes.sideEffect).toBe(7);
    expect(classes.untouched).toBe(1);
    expect(reasons).toEqual({
      2: 'changed',
      3: 'changed',
      4: 'instance',
      5: 'instance',
      6: 'style restored',
      7: 'created',
      8: 'instance',
    });
  });
});

describe('the check', () => {
  test('a lost layer fails; deleted, under a deleted ancestor and derived layers do not', () => {
    const base = prints({ ...BASE, 8: [8, 'frame', 1] });
    // Mine deleted 3 and frame 8; other added 9 inside frame 8 and 10 inside the instance; mine
    // added 11.
    const mine = prints({
      1: BASE[1]!,
      2: BASE[2]!,
      4: BASE[4]!,
      5: BASE[5]!,
      11: [11, 'text', 2],
    });
    const other = prints({
      ...BASE,
      8: [8, 'frame', 1],
      9: [9, 'text', 8],
      10: [10, 'text', 4],
      12: [12, 'rectangle', 2],
    });
    const result = prints({ 1: BASE[1]!, 2: BASE[2]!, 4: BASE[4]!, 11: [11, 'text', 2] });

    // 5 is inside an instance; 3 and 8 were deleted; 9 went with frame 8; 10 is derived.
    expect(lostLayers(base, mine, other, result)).toEqual([{ id: 12, name: 'L12', side: 'other' }]);
    expect(
      lostLayers(base, mine, other, prints({ 1: BASE[1]!, 2: BASE[2]!, 4: BASE[4]! })),
    ).toEqual([
      { id: 11, name: 'L11', side: 'mine' },
      { id: 12, name: 'L12', side: 'other' },
    ]);
  });

  test('the message names up to 20 layers with their side', () => {
    const lost = Array.from({ length: 23 }, (_, index) => ({
      id: index + 100,
      name: `N${index}`,
      side: index === 0 ? ('mine' as const) : ('other' as const),
    }));
    const message = lostMessage(lost);

    expect(message).toContain('lost 23 layer(s)');
    expect(message).toContain('100 "N0" (HEAD)');
    expect(message).toContain('119 "N19" (the other side)');
    expect(message).not.toContain('120 "N20"');
    expect(message).toContain('and 3 more');
  });
});

describe('the repair', () => {
  test('only main text linked to a style the branch redefined, unchanged by the branch, unlinked', () => {
    const base = prints({ 1: [1, 'page', null], 3: [3, 'text', 1, 'S:1'] }, { 'S:1': 1, 'S:2': 2 });
    const figBranch = prints(
      { 1: [1, 'page', null], 3: [3, 'text', 1, 'S:1'], 20: [20, 'text', 1, 'S:1'] },
      { 'S:1': 10, 'S:2': 2, 'S:3': 3 },
    );
    const figMain = prints(
      {
        1: [1, 'page', null],
        3: [3, 'text', 1, 'S:1'],
        // Added on main: 6 and 7 link to the redefined style, 8 to an unchanged one.
        6: [6, 'text', 1, 'S:1'],
        7: [7, 'text', 1, 'S:1'],
        8: [8, 'text', 1, 'S:2'],
        // Not a text.
        9: [9, 'rectangle', 1],
      },
      { 'S:1': 1, 'S:2': 2 },
    );
    const result = prints({
      1: [1, 'page', null],
      3: [30, 'text', 1, 'S:1'],
      6: [6, 'text', 1],
      7: [7, 'text', 1, 'S:1'],
      8: [8, 'text', 1],
      9: [9, 'rectangle', 1],
    });

    expect([...layersToRepair(base, figMain, figBranch, result)]).toEqual([['S:1', [6]]]);

    // Text the branch changed is the branch's to decide.
    const changedOnBranch = prints(
      { 1: [1, 'page', null], 3: [31, 'text', 1, 'S:1'] },
      { 'S:1': 10 },
    );
    const unlinked3 = prints({ 1: [1, 'page', null], 3: [3, 'text', 1] });

    expect(layersToRepair(base, figMain, changedOnBranch, unlinked3).size).toBe(0);
    expect([...layersToRepair(base, figMain, figBranch, unlinked3)]).toEqual([['S:1', [3]]]);
    // Redefined on main only: nothing.
    expect(layersToRepair(base, figBranch, figMain, result).size).toBe(0);

    const repairs = new Map([['S:1', [6, 7]]]);

    expect(stillUnlinked(repairs, result)).toEqual([6]);
  });
});

describe('the report', () => {
  const result = prints({
    1: [1, 'page', null],
    2: [2, 'frame', 1],
    3: [3, 'frame', 1],
    ...Object.fromEntries(
      Array.from({ length: 8 }, (_, index): [number, Spec] => [100 + index, [0, 'text', 2]]),
    ),
    200: [0, 'text', 3],
  });

  test('groups by page and top-level frame, largest first', () => {
    const effects = [200, ...Array.from({ length: 8 }, (_, index) => 100 + index)].map((id) => ({
      id,
      name: `L${id}`,
      type: 'text',
      reason: 'changed' as const,
    }));
    const groups = groupSideEffects(result, effects);

    expect(groups.map((group) => [group.page, group.frame, group.layers.length])).toEqual([
      ['L1', { id: 2, name: 'L2' }, 8],
      ['L1', { id: 3, name: 'L3' }, 1],
    ]);

    const lines = reportLines(
      {
        classes: { untouched: 2, fromOther: 0, fromThis: 0, merged: 0, sideEffect: 9 },
        groups,
        restored: [{ style: 'Body', layers: [100] }],
      },
      12,
      '/tmp/r.json',
    );

    expect(lines).toEqual([
      'layers in the result: 12; untouched 2, from the other side 0, from this side 0, merged 0, side effects 9',
      'side effects: 9 in 2 group(s)',
      '  page "L1", frame 2 "L2": 8',
      '    100 "L100" changed',
      '    101 "L101" changed',
      '    102 "L102" changed',
      '    103 "L103" changed',
      '    104 "L104" changed',
      '    and 3 more',
      '  page "L1", frame 3 "L3": 1',
      '    200 "L200" changed',
      'text style restored: "Body", 1 layer(s)',
      'report: /tmp/r.json',
    ]);
  });

  test('at most 20 groups printed; none says so', () => {
    const many = prints({
      1: [1, 'page', null],
      ...Object.fromEntries(
        Array.from({ length: 25 }, (_, index): [number, Spec] => [10 + index, [0, 'frame', 1]]),
      ),
    });
    const groups = groupSideEffects(
      many,
      Array.from({ length: 25 }, (_, index) => ({
        id: 10 + index,
        name: '',
        type: 'frame',
        reason: 'changed' as const,
      })),
    );
    const classes = { untouched: 0, fromOther: 0, fromThis: 0, merged: 0, sideEffect: 25 };
    const lines = reportLines({ classes, groups, restored: [] }, 26, 'r.json');

    expect(groups).toHaveLength(25);
    expect(lines.filter((line) => line.startsWith('  page'))).toHaveLength(20);
    expect(lines).toContain('  and 5 more group(s)');
    expect(
      reportLines({ classes: { ...classes, sideEffect: 0 }, groups: [], restored: [] }, 1, 'r'),
    ).toContain('side effects: none');
  });
});
