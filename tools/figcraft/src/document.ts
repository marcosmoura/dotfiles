/** Ids made on a branch are `client × 2^32 + n`; the main copy uses client 0. */
export const CLIENT_SPAN = 2 ** 32;

/** The highest client keeps every id below `2^53`, so ids stay exact in JavaScript. */
export const MAX_CLIENT = 2 ** 21 - 1;

/** The parts of `document.json` figkit reads. Everything else is kept but not typed. */
export type FigDocument = {
  next_id: number;
  nodes: Record<
    string,
    { type?: string; name?: string; parent?: number | null; children?: number[] }
  >;
  imageIndex?: { hash: string }[];
  styles?: { id: string; type?: string; name?: string }[];
  variables?: {
    collections?: { id: string; name?: string; modes?: { id: string; name?: string }[] }[];
    variables?: { id: string; name?: string }[];
  };
  [key: string]: unknown;
};

const KEY = new TextEncoder().encode('"next_id":');

/**
 * Parses the document for reading only. It is never serialised back into an archive: JavaScript
 * prints `1.0` as `1`, so a round trip would change bytes FigCraft wrote.
 */
export function parseDocument(bytes: Uint8Array): FigDocument {
  return JSON.parse(new TextDecoder().decode(bytes)) as FigDocument;
}

export function readNextId(bytes: Uint8Array): number {
  const { start, end } = findCounter(bytes);

  return Number(new TextDecoder().decode(bytes.subarray(start, end)));
}

/** Returns the document with another counter. Only the digits change, never the other bytes. */
export function setNextId(bytes: Uint8Array, value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`next_id must be a whole number from 0, not ${value}`);
  }

  const { start, end } = findCounter(bytes);
  const digits = new TextEncoder().encode(String(value));
  const result = new Uint8Array(bytes.byteLength - (end - start) + digits.byteLength);

  result.set(bytes.subarray(0, start), 0);
  result.set(digits, start);
  result.set(bytes.subarray(end), start + digits.byteLength);

  return result;
}

export function imageHashes(document: FigDocument): string[] {
  return (document.imageIndex ?? []).map((image) => image.hash);
}

export function clientOf(id: number): number {
  return Math.floor(id / CLIENT_SPAN);
}

export function firstIdOf(client: number): number {
  return client * CLIENT_SPAN + 1;
}

/**
 * The numbers in a string id: `VariableID:<n>`, `VariableCollectionId:<n>`, `S:<n>`, and both
 * numbers of a mode id `VariableCollectionId:<n>/mode<m>`, since a mode added on a branch keeps
 * its collection's plain number.
 */
export function idNumbers(id: string): number[] {
  const match = /^(?:VariableID|VariableCollectionId|S):(\d+)(?:\/mode(\d+))?$/.exec(id);

  if (!match) {
    return [];
  }

  return match
    .slice(1)
    .filter((part) => part !== undefined)
    .map(Number);
}

/** The highest client over layers, variables, collections, modes and styles. */
export function highestClient(document: FigDocument): number {
  let highest = 0;
  const count = (id: number): void => {
    highest = Math.max(highest, clientOf(id));
  };

  for (const key of Object.keys(document.nodes ?? {})) {
    count(Number(key));
  }

  for (const style of document.styles ?? []) {
    idNumbers(style.id).forEach(count);
  }

  for (const collection of document.variables?.collections ?? []) {
    idNumbers(collection.id).forEach(count);

    for (const mode of collection.modes ?? []) {
      idNumbers(mode.id).forEach(count);
    }
  }

  for (const variable of document.variables?.variables ?? []) {
    idNumbers(variable.id).forEach(count);
  }

  return highest;
}

function findCounter(bytes: Uint8Array): { start: number; end: number } {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = buffer.indexOf(KEY);

  if (at < 0) {
    throw new Error('document.json has no "next_id" key');
  }

  if (buffer.indexOf(KEY, at + 1) >= 0) {
    throw new Error('document.json has the "next_id" key more than once');
  }

  const start = at + KEY.byteLength;
  let end = start;

  while (end < bytes.byteLength && bytes[end]! >= 0x30 && bytes[end]! <= 0x39) {
    end += 1;
  }

  if (end === start) {
    throw new Error('document.json has a "next_id" that is not a plain number');
  }

  return { start, end };
}
