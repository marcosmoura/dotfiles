import { byteLength, truncateToBytes } from './bytes';

const TRUNCATION_MARKER = '…';

/**
 * Drop nulls and empty containers; drop explicit visual defaults unless `keepDefaults` is set
 * (the caller asked for specific fields, so an explicit default is an answer, not noise).
 */
export function prune(value: unknown, keepDefaults = false): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => prune(item, keepDefaults))
      .filter((item) => item !== undefined);

    return items.length ? items : undefined;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (item === null) {
        continue;
      }

      if (!keepDefaults && isVisualDefault(key, item)) {
        continue;
      }

      const pruned = prune(item, keepDefaults);

      if (pruned === undefined) {
        continue;
      }

      result[key] = pruned;
    }

    return Object.keys(result).length ? result : undefined;
  }

  return value;
}

function isVisualDefault(key: string, item: unknown): boolean {
  return (
    (key === 'visible' && item === true) ||
    (key === 'clip' && item === false) ||
    (key === 'opacity' && item === 1) ||
    (key === 'rotation' && item === 0) ||
    (key === 'cornerRadius' && item === 0)
  );
}

/** The `truncated` object FigCraft adds when it paged or shortened a tree itself. */
export function upstreamTruncated(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const truncated = (value as Record<string, unknown>).truncated;

    if (truncated !== undefined) {
      return { truncated };
    }
  }

  return {};
}

export function fit(
  tool: string,
  value: unknown,
  maxBytes: number,
): { value: unknown; truncated: boolean } {
  if (value === undefined) {
    return { value, truncated: false };
  }

  if (fits(value, maxBytes)) {
    return { value, truncated: false };
  }

  const outlined = outline(tool, value);

  if (fits(outlined, maxBytes)) {
    return { value: outlined, truncated: true };
  }

  const root = rootOnly(tool, value);

  if (fits(root, maxBytes)) {
    return { value: root, truncated: true };
  }

  const shrunk = shrinkStrings(root, maxBytes);

  if (fits(shrunk, maxBytes)) {
    return { value: shrunk, truncated: true };
  }

  return {
    value: { ...upstreamTruncated(value), _figcraftCompact: { truncated: true } },
    truncated: true,
  };
}

function fits(value: unknown, maxBytes: number): boolean {
  return byteLength(JSON.stringify(value)) <= maxBytes;
}

/** Truncates long scalar strings so a root-only payload can still fit the budget. */
function shrinkStrings(value: unknown, maxBytes: number): unknown {
  return truncateStrings(value, Math.max(16, Math.floor(maxBytes / 4)));
}

function truncateStrings(value: unknown, maxBytes: number): unknown {
  if (typeof value === 'string') {
    if (byteLength(value) <= maxBytes) {
      return value;
    }

    return `${truncateToBytes(value, maxBytes - byteLength(TRUNCATION_MARKER))}${TRUNCATION_MARKER}`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncateStrings(item, maxBytes));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = truncateStrings(item, maxBytes);
    }

    return result;
  }

  return value;
}

function summary(node: Record<string, unknown>): Record<string, unknown> {
  const { children, ...rest } = node;

  if (Array.isArray(children)) {
    rest.childrenOmitted = children.length;
  }

  return rest;
}

function outline(tool: string, value: unknown): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;

  if (tool === 'inspect_document') {
    for (const page of (copy.pages as Record<string, unknown>[]) ?? []) {
      if (Array.isArray(page.children)) {
        page.children = page.children.map((child: Record<string, unknown>) => summary(child));
      }
    }

    return copy;
  }

  if (Array.isArray(copy.children)) {
    copy.children = copy.children.map((child: Record<string, unknown>) => summary(child));
  }

  return copy;
}

function rootOnly(tool: string, value: unknown): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;

  if (tool === 'inspect_document') {
    const pages = (copy.pages as Record<string, unknown>[]) ?? [];

    for (const page of pages) {
      const count = Array.isArray(page.children) ? page.children.length : undefined;

      delete page.children;

      if (count !== undefined) {
        page.childCount = count;
      }
    }

    delete copy.styles;
    delete copy.history;
    delete copy.textEdit;

    return copy;
  }

  const count = Array.isArray(copy.children) ? copy.children.length : undefined;

  delete copy.children;

  if (count !== undefined) {
    copy.childrenOmitted = count;
  }

  return copy;
}
