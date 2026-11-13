import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildArchive,
  entryBytes,
  parseArchive,
  readArchive,
  writeArchive,
  type ArchiveEntry,
} from './archive';
import { parseDocument, readNextId, setNextId } from './document';
import { loadConfig, resolveBin } from './settings';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const document = encode(`{"name":"Doc","next_id":12,"nodes":{"1":{"type":"frame"}},"x":1.0}`);
const image = new Uint8Array(Array.from({ length: 256 }, (_, index) => index));

let directory = '';

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'figkit-archive-'));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('archive', () => {
  test('round trips stored and deflated entries in the given order', async () => {
    const file = join(directory, 'round.figcraft');

    await writeArchive(file, [
      { name: 'document.json', data: document, method: 'deflate' },
      { name: 'thumbnail.png', data: image, method: 'stored' },
      { name: 'images/abc', data: image, method: 'stored' },
    ]);

    const archive = await readArchive(file);

    expect(archive.entries.map((entry) => [entry.name, entry.method])).toEqual([
      ['document.json', 'deflate'],
      ['thumbnail.png', 'stored'],
      ['images/abc', 'stored'],
    ]);
    expect(entryBytes(archive, 'document.json')).toEqual(document);
    expect(entryBytes(archive, 'images/abc')).toEqual(image);
    expect(() => entryBytes(archive, 'missing')).toThrow('no entry "missing"');
  });

  test('writes the headers FigCraft writes', () => {
    const bytes = buildArchive('x', [
      { name: 'document.json', data: document, method: 'deflate' },
      { name: 'thumbnail.png', data: image, method: 'stored' },
    ]);
    const view = new DataView(bytes.buffer);

    // Local header of document.json: version 20, flags 0, method 8, time 0, date 1980-01-01.
    expect([1, 2, 3, 4, 5].map((index) => view.getUint16(2 + index * 2, true))).toEqual([
      20, 0, 8, 0, 0x21,
    ]);

    const central = bytes.byteLength - 22 - (46 + 13) * 2;

    expect(view.getUint16(central + 4, true)).toBe(0x0314);
    expect(view.getUint32(central + 38, true)).toBe(0x81a40000);
    expect(view.getUint16(central + 46 + 13 + 4, true)).toBe(0x030a);
    expect(view.getUint16(central + 46 + 13 + 6, true)).toBe(10);
  });

  test('copies entries without inflating them, also under another name', async () => {
    const source = await readArchive(join(directory, 'round.figcraft'));
    const file = join(directory, 'copy.figcraft');
    // A deflated entry whose raw bytes do not inflate shows that the copy does not inflate.
    const opaque: ArchiveEntry = { ...source.entries[0]!, raw: encode('not deflate') };
    const fields = ({ name, method, crc32, size, compressedSize }: ArchiveEntry) => ({
      name,
      method,
      crc32,
      size,
      compressedSize,
    });

    await writeArchive(file, [
      ...source.entries.map((entry) => ({ entry })),
      { name: 'branches/1/head.json', entry: source.entries[0]! },
    ]);

    const copy = await readArchive(file);

    expect(copy.entries.slice(0, 3).map(fields)).toEqual(source.entries.map(fields));
    expect(copy.entries[0]!.raw).toEqual(source.entries[0]!.raw);
    expect(entryBytes(copy, 'branches/1/head.json')).toEqual(document);

    const raw = parseArchive('opaque', buildArchive('opaque', [{ entry: opaque }]));

    expect(raw.entries[0]!.raw).toEqual(encode('not deflate'));
  });

  test('leaves the target as it was when the rename fails', async () => {
    // A non-empty directory as the target: the temporary file is written, the rename fails.
    const target = join(directory, 'blocked.figcraft');

    await mkdir(target);
    await writeFile(join(target, 'keep'), 'kept');
    await expect(
      writeArchive(target, [{ name: 'document.json', data: document, method: 'deflate' }]),
    ).rejects.toThrow();
    expect(await readFile(join(target, 'keep'), 'utf8')).toBe('kept');
    expect((await readdir(directory)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  test('refuses more than 65,535 entries', () => {
    const entries = Array.from({ length: 65_536 }, (_, index) => ({
      name: String(index),
      data: new Uint8Array(),
      method: 'stored' as const,
    }));

    expect(() => buildArchive('many.figcraft', entries)).toThrow('many.figcraft');
  });

  describe('errors name the file', () => {
    const good = buildArchive('x', [{ name: 'document.json', data: document, method: 'deflate' }]);

    test('a truncated archive', () => {
      expect(() => parseArchive('cut.figcraft', good.subarray(0, good.byteLength - 30))).toThrow(
        /^cut\.figcraft: /,
      );
      expect(() => parseArchive('cut.figcraft', good.subarray(0, 40))).toThrow(/^cut\.figcraft: /);
    });

    test('a ZIP64 archive', () => {
      const end = good.byteLength - 22;
      const locator = new Uint8Array(20);

      new DataView(locator.buffer).setUint32(0, 0x07064b50, true);

      const bytes = new Uint8Array(good.byteLength + 20);

      bytes.set(good.subarray(0, end));
      bytes.set(locator, end);
      bytes.set(good.subarray(end), end + 20);
      expect(() => parseArchive('big.figcraft', bytes)).toThrow('big.figcraft: ZIP64');
    });

    test('an unknown method', () => {
      const bytes = good.slice();
      const view = new DataView(bytes.buffer);
      const central = bytes.byteLength - 22 - 46 - 13;

      view.setUint16(central + 10, 12, true);
      expect(() => parseArchive('bz.figcraft', bytes)).toThrow(
        'bz.figcraft: entry "document.json" uses compression method 12',
      );
    });

    test('an encrypted entry', () => {
      const bytes = good.slice();
      const view = new DataView(bytes.buffer);

      view.setUint16(bytes.byteLength - 22 - 46 - 13 + 8, 1, true);
      expect(() => parseArchive('lock.figcraft', bytes)).toThrow(
        'lock.figcraft: entry "document.json" is encrypted',
      );
    });
  });
});

// The rest runs the real figcraft-cli against a scratch document.
const config = loadConfig();
let bin = '';

try {
  bin = resolveBin(config);
} catch {
  // No usable figcraft-cli on this machine: the end-to-end tests are skipped.
}

describe.skipIf(!bin || !existsSync(bin))('archive against figcraft-cli', () => {
  const cli = (...args: string[]) => {
    const result = Bun.spawnSync([bin, ...args], { stdout: 'pipe', stderr: 'pipe' });

    return { ok: result.exitCode === 0, output: `${result.stdout}${result.stderr}` };
  };
  let scratch = '';

  beforeAll(async () => {
    const script = join(directory, 'script.json');

    scratch = join(directory, 'scratch.figcraft');
    await writeFile(
      script,
      JSON.stringify([
        {
          command: 'node.create',
          params: { type: 'frame', name: 'Card', x: 0, y: 0, width: 300, height: 200 },
        },
      ]),
    );
    expect(cli('run', '--out', scratch, script).ok).toBe(true);
  });

  test('reads an archive figcraft-cli wrote', async () => {
    const archive = await readArchive(scratch);
    const names = archive.entries.map((entry) => entry.name);

    expect(names).toContain('document.json');
    expect(names).toContain('thumbnail.png');
    expect(archive.entries.find((entry) => entry.name === 'document.json')!.method).toBe('deflate');
    expect(Object.values(parseDocument(entryBytes(archive, 'document.json')).nodes)).toContainEqual(
      expect.objectContaining({ name: 'Card' }),
    );
  });

  for (const method of ['deflate', 'stored'] as const) {
    test(`writes an archive figcraft-cli opens, with a ${method} document`, async () => {
      const archive = await readArchive(scratch);
      const file = join(directory, `written-${method}.figcraft`);

      await writeArchive(file, [
        { name: 'document.json', data: entryBytes(archive, 'document.json'), method },
        ...archive.entries
          .filter((entry) => entry.name !== 'document.json')
          .map((entry) => ({ entry })),
      ]);

      const info = cli('info', file);

      expect(info.ok).toBe(true);
      expect(info.output).toMatch(/\(2 nodes,[^]*FRAME "Card"/);
    });
  }

  test('a moved counter changes only its digits and the archive still opens', async () => {
    const archive = await readArchive(scratch);
    const before = entryBytes(archive, 'document.json');
    const after = setNextId(before, 4398046511105);
    const text = new TextDecoder();

    expect(readNextId(after)).toBe(4398046511105);
    expect(text.decode(after).replace('"next_id":4398046511105', '')).toBe(
      text.decode(before).replace(`"next_id":${readNextId(before)}`, ''),
    );

    const file = join(directory, 'counter.figcraft');

    await writeArchive(file, [
      { name: 'document.json', data: after, method: 'deflate' },
      ...archive.entries
        .filter((entry) => entry.name !== 'document.json')
        .map((entry) => ({ entry })),
    ]);
    expect(cli('info', file).ok).toBe(true);
  });
});
