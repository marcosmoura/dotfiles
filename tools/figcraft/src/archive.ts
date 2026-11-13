import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** Zip methods FigCraft writes: `document.json` and the other JSON entries deflated, the rest stored. */
export type Method = 'stored' | 'deflate';

/** One entry of an archive that was read. `raw` holds the bytes as stored in the zip. */
export type ArchiveEntry = {
  name: string;
  method: Method;
  crc32: number;
  size: number;
  compressedSize: number;
  raw: Uint8Array;
};

export type Archive = {
  path: string;
  entries: ArchiveEntry[];
};

/**
 * What `writeArchive` writes: new bytes with a method, or an entry of a read archive copied as it
 * is (optionally under another name), so a 64 MB document is not inflated and deflated again.
 */
export type NewEntry =
  { name: string; data: Uint8Array; method: Method } | { name?: string; entry: ArchiveEntry };

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const END_SIZE = 22;
const LOCAL_SIZE = 30;
const CENTRAL_SIZE = 46;
const LIMIT = 0xffffffff;
const MAX_ENTRIES = 0xffff;
// FigCraft dates every entry 1980-01-01 00:00:00, the first DOS date.
const DOS_DATE = 0x0021;
const DOS_TIME = 0;
// Host system 3 (Unix) in the high byte of "version made by", and mode 0644 of a regular file.
const UNIX_HOST = 3 << 8;
const EXTERNAL_ATTRIBUTES = 0x81a40000;

export class ArchiveError extends Error {
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = 'ArchiveError';
  }
}

export async function readArchive(path: string): Promise<Archive> {
  return parseArchive(path, new Uint8Array(await readFile(path)));
}

/** Reads the zip from its central directory, which is what FigCraft and other readers trust. */
export function parseArchive(path: string, bytes: Uint8Array): Archive {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = (reason: string): never => {
    throw new ArchiveError(path, reason);
  };
  const end = findEnd(view);

  if (end < 0) {
    fail('not a zip archive, or truncated (no end of central directory)');
  }

  if (end >= 20 && view.getUint32(end - 20, true) === ZIP64_LOCATOR_SIGNATURE) {
    fail('ZIP64 archives are not supported');
  }

  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);

  if (centralSize === LIMIT || centralOffset === LIMIT) {
    fail('ZIP64 archives are not supported');
  }

  if (disk !== 0 || centralDisk !== 0 || count !== view.getUint16(end + 8, true)) {
    fail('multi-disk archives are not supported');
  }

  if (centralOffset + centralSize > end) {
    fail('broken central directory (it runs past its end record)');
  }

  const entries: ArchiveEntry[] = [];
  let at = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (at + CENTRAL_SIZE > end || view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      fail(`broken central directory at entry ${index + 1}`);
    }

    const flags = view.getUint16(at + 8, true);
    const methodCode = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + CENTRAL_SIZE, at + CENTRAL_SIZE + nameLength),
    );

    if (compressedSize === LIMIT || size === LIMIT || localOffset === LIMIT) {
      fail(`ZIP64 entry "${name}" is not supported`);
    }

    if (flags & 0x41) {
      fail(`entry "${name}" is encrypted`);
    }

    if (methodCode !== 0 && methodCode !== 8) {
      fail(`entry "${name}" uses compression method ${methodCode}`);
    }

    if (
      localOffset + LOCAL_SIZE > centralOffset ||
      view.getUint32(localOffset, true) !== LOCAL_SIGNATURE
    ) {
      fail(`broken local header of entry "${name}"`);
    }

    const dataStart =
      localOffset +
      LOCAL_SIZE +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);

    if (dataStart + compressedSize > centralOffset) {
      fail(`entry "${name}" runs past the central directory`);
    }

    entries.push({
      name,
      method: methodCode === 0 ? 'stored' : 'deflate',
      crc32: crc,
      size,
      compressedSize,
      raw: bytes.subarray(dataStart, dataStart + compressedSize),
    });
    at += CENTRAL_SIZE + nameLength + extraLength + commentLength;
  }

  return { path, entries };
}

export function findEntry(archive: Archive, name: string): ArchiveEntry | null {
  return archive.entries.find((entry) => entry.name === name) ?? null;
}

/** The bytes of one entry, inflated when needed and checked against the CRC. */
export function entryBytes(archive: Archive, name: string): Uint8Array {
  const entry = findEntry(archive, name);

  if (!entry) {
    throw new ArchiveError(archive.path, `no entry "${name}"`);
  }

  let data: Uint8Array;

  try {
    data = entry.method === 'stored' ? entry.raw : new Uint8Array(inflateRawSync(entry.raw));
  } catch (error) {
    throw new ArchiveError(archive.path, `entry "${name}" does not inflate (${String(error)})`);
  }

  if (data.byteLength !== entry.size || crc32(data) !== entry.crc32) {
    throw new ArchiveError(archive.path, `entry "${name}" fails its size or CRC check`);
  }

  return data;
}

/**
 * Writes the entries in the given order the way FigCraft writes them. The archive goes to a
 * temporary file next to the target and is renamed over it, so a reader never sees half a file.
 */
export async function writeArchive(path: string, entries: NewEntry[]): Promise<void> {
  const bytes = buildArchive(path, entries);
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export function buildArchive(path: string, entries: NewEntry[]): Uint8Array {
  if (entries.length > MAX_ENTRIES) {
    throw new ArchiveError(path, `${entries.length} entries is more than ${MAX_ENTRIES}`);
  }

  const encoder = new TextEncoder();
  const prepared = entries.map((item) => {
    if ('entry' in item) {
      return {
        ...item.entry,
        name: encoder.encode(item.name ?? item.entry.name),
        compressedSize: item.entry.raw.byteLength,
      };
    }

    const raw = item.method === 'stored' ? item.data : deflateRawSync(item.data, { level: 6 });

    return {
      name: encoder.encode(item.name),
      method: item.method,
      crc32: crc32(item.data),
      size: item.data.byteLength,
      compressedSize: raw.byteLength,
      raw: new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength),
    };
  });
  let localTotal = 0;
  let centralTotal = 0;

  for (const entry of prepared) {
    if (entry.size >= LIMIT || entry.compressedSize >= LIMIT) {
      throw new ArchiveError(
        path,
        `entry "${new TextDecoder().decode(entry.name)}" is 4 GiB or more`,
      );
    }

    localTotal += LOCAL_SIZE + entry.name.byteLength + entry.compressedSize;
    centralTotal += CENTRAL_SIZE + entry.name.byteLength;
  }

  if (localTotal + centralTotal + END_SIZE >= LIMIT) {
    throw new ArchiveError(path, 'the archive would be 4 GiB or more');
  }

  const bytes = new Uint8Array(localTotal + centralTotal + END_SIZE);
  const view = new DataView(bytes.buffer);
  const offsets: number[] = [];
  let at = 0;

  for (const entry of prepared) {
    const version = entry.method === 'deflate' ? 20 : 10;

    offsets.push(at);
    view.setUint32(at, LOCAL_SIGNATURE, true);
    view.setUint16(at + 4, version, true);
    view.setUint16(at + 6, 0, true);
    view.setUint16(at + 8, entry.method === 'deflate' ? 8 : 0, true);
    view.setUint16(at + 10, DOS_TIME, true);
    view.setUint16(at + 12, DOS_DATE, true);
    view.setUint32(at + 14, entry.crc32, true);
    view.setUint32(at + 18, entry.compressedSize, true);
    view.setUint32(at + 22, entry.size, true);
    view.setUint16(at + 26, entry.name.byteLength, true);
    view.setUint16(at + 28, 0, true);
    bytes.set(entry.name, at + LOCAL_SIZE);
    bytes.set(entry.raw, at + LOCAL_SIZE + entry.name.byteLength);
    at += LOCAL_SIZE + entry.name.byteLength + entry.compressedSize;
  }

  const centralOffset = at;

  prepared.forEach((entry, index) => {
    const version = entry.method === 'deflate' ? 20 : 10;

    view.setUint32(at, CENTRAL_SIGNATURE, true);
    view.setUint16(at + 4, UNIX_HOST | version, true);
    view.setUint16(at + 6, version, true);
    view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, entry.method === 'deflate' ? 8 : 0, true);
    view.setUint16(at + 12, DOS_TIME, true);
    view.setUint16(at + 14, DOS_DATE, true);
    view.setUint32(at + 16, entry.crc32, true);
    view.setUint32(at + 20, entry.compressedSize, true);
    view.setUint32(at + 24, entry.size, true);
    view.setUint16(at + 28, entry.name.byteLength, true);
    view.setUint32(at + 38, EXTERNAL_ATTRIBUTES, true);
    view.setUint32(at + 42, offsets[index]!, true);
    bytes.set(entry.name, at + CENTRAL_SIZE);
    at += CENTRAL_SIZE + entry.name.byteLength;
  });

  view.setUint32(at, END_SIGNATURE, true);
  view.setUint16(at + 8, prepared.length, true);
  view.setUint16(at + 10, prepared.length, true);
  view.setUint32(at + 12, at - centralOffset, true);
  view.setUint32(at + 16, centralOffset, true);

  return bytes;
}

function findEnd(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_SIZE - 0xffff);

  for (let at = view.byteLength - END_SIZE; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === END_SIGNATURE) {
      return at;
    }
  }

  return -1;
}
