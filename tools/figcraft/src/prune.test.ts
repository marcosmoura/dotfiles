import { describe, expect, test } from 'bun:test';

import { fit, prune } from './prune';

describe('prune', () => {
  test('drops nulls, empty containers, and visual defaults', () => {
    expect(
      prune({
        visible: true,
        clip: false,
        opacity: 1,
        rotation: 0,
        cornerRadius: 0,
        name: 'Frame',
        width: 0,
        height: 10,
        fills: null,
        children: [],
        nested: { empty: [], gone: null },
      }),
    ).toEqual({ name: 'Frame', width: 0, height: 10 });
  });

  test('returns undefined when every field is dropped', () => {
    expect(prune({ a: null, b: [], c: {} })).toBeUndefined();
  });
});

describe('fit', () => {
  test('returns values under budget unchanged', () => {
    const value = { id: 1, children: [{ id: 2 }] };
    const result = fit('get_node', value, 1000);

    expect(result.value).toEqual(value);
    expect(result.truncated).toBe(false);
  });

  test('outlines an oversized inspect_document tree', () => {
    const value = {
      pages: [
        {
          id: 1,
          name: 'Page',
          children: [{ id: 2, name: 'Big', children: [{ id: 3, blob: 'x'.repeat(200) }] }],
        },
      ],
    };

    const summary = { id: 2, name: 'Big', childrenOmitted: 1 };
    const outlined = { pages: [{ id: 1, name: 'Page', children: [summary] }] };
    const maxBytes = Buffer.byteLength(JSON.stringify(outlined)) + 1;

    const result = fit('inspect_document', value, maxBytes);
    const pages = (result.value as { pages: Array<{ children: unknown[] }> }).pages;

    expect(result.truncated).toBe(true);
    expect(pages[0]?.children).toEqual([summary]);
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
  });

  test('falls back to root-only when even the outline is too large', () => {
    const value = {
      pages: [{ id: 1, name: 'Page', children: [{ id: 2 }, { id: 3 }] }],
      styles: { fill: 'red' },
      history: [{ op: 'add' }],
      textEdit: { layer: 2 },
      huge: 'x'.repeat(500),
    };

    const maxBytes = 100;
    const result = fit('inspect_document', value, maxBytes);
    const copy = result.value as Record<string, unknown>;
    const pages = copy.pages as Array<Record<string, unknown>>;

    expect(result.truncated).toBe(true);
    expect(pages[0]?.children).toBeUndefined();
    expect(pages[0]?.childCount).toBe(2);
    expect(copy.styles).toBeUndefined();
    expect(copy.history).toBeUndefined();
    expect(copy.textEdit).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
  });

  test('falls back to root-only for get_node', () => {
    const value = {
      id: 1,
      children: [{ id: 2 }, { id: 3 }],
      huge: 'x'.repeat(500),
    };

    const maxBytes = 100;
    const result = fit('get_node', value, maxBytes);
    const copy = result.value as Record<string, unknown>;

    expect(result.truncated).toBe(true);
    expect(copy.children).toBeUndefined();
    expect(copy.childrenOmitted).toBe(2);
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
  });

  test('measures CJK text in UTF-8 bytes', () => {
    const value = { id: 1, name: '漢'.repeat(100) };
    const maxBytes = 200;

    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(maxBytes);

    const result = fit('get_node', value, maxBytes);
    const copy = result.value as Record<string, unknown>;

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
    expect(copy.name).toEndWith('…');
  });

  test('measures emoji in UTF-8 bytes', () => {
    const value = { id: 1, name: '😀'.repeat(100) };
    const maxBytes = 300;

    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(maxBytes);

    const result = fit('get_node', value, maxBytes);
    const copy = result.value as Record<string, unknown>;

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
    expect(copy.name).toEndWith('…');
  });

  test('truncates a single huge scalar string', () => {
    const value = { id: 1, name: 'x'.repeat(500_000) };
    const maxBytes = 1024;

    const result = fit('get_node', value, maxBytes);
    const copy = result.value as Record<string, unknown>;

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
    expect(copy.name).toEndWith('…');
  });

  test('returns a minimal marked result when root-only is still over budget', () => {
    const value = { id: 1, data: Array.from({ length: 2000 }, (_, index) => index) };
    const maxBytes = 256;

    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(maxBytes);

    const result = fit('get_node', value, maxBytes);

    expect(result.truncated).toBe(true);
    expect(result.value).toEqual({ _figcraftCompact: { truncated: true } });
    expect(Buffer.byteLength(JSON.stringify(result.value))).toBeLessThanOrEqual(maxBytes);
  });

  test('returns undefined for undefined values', () => {
    expect(fit('get_node', undefined, 100)).toEqual({ value: undefined, truncated: false });
  });
});

describe('prune with keepDefaults', () => {
  test('keeps explicit visual defaults but drops nulls and empty containers', () => {
    expect(
      prune(
        { visible: true, opacity: 1, rotation: 0, cornerRadius: 0, clip: false, a: null, b: [] },
        true,
      ),
    ).toEqual({ visible: true, opacity: 1, rotation: 0, cornerRadius: 0, clip: false });
  });
});

describe('fit', () => {
  test('keeps the upstream truncated object in the last-resort result', () => {
    const value = { truncated: { offset: 7 }, blob: 'x'.repeat(2000) };
    const result = fit('get_node', { ...value, children: [{ id: 1 }] }, 60);

    expect(result.truncated).toBe(true);
    expect((result.value as Record<string, unknown>).truncated).toEqual({ offset: 7 });
  });
});
