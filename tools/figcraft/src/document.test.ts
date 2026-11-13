import { describe, expect, test } from 'bun:test';

import {
  clientOf,
  firstIdOf,
  highestClient,
  idNumbers,
  imageHashes,
  MAX_CLIENT,
  parseDocument,
  readNextId,
  setNextId,
  type FigDocument,
} from './document';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('counter', () => {
  test('reads and changes only the digits', () => {
    const before = encode('{"format":1,"next_id":42,"nodes":{},"x":1.0}');
    const after = setNextId(before, 4398046511105);

    expect(readNextId(before)).toBe(42);
    expect(decode(after)).toBe('{"format":1,"next_id":4398046511105,"nodes":{},"x":1.0}');
    expect(decode(setNextId(after, 7))).toBe('{"format":1,"next_id":7,"nodes":{},"x":1.0}');
  });

  test('ignores the key inside a text layer, where its quotes are escaped', () => {
    const bytes = encode('{"next_id":5,"nodes":{"1":{"characters":"say \\"next_id\\":9"}}}');

    expect(readNextId(bytes)).toBe(5);
    expect(decode(setNextId(bytes, 6))).toBe(
      '{"next_id":6,"nodes":{"1":{"characters":"say \\"next_id\\":9"}}}',
    );
  });

  test('refuses a document with the key twice, without it, or with a bad value', () => {
    expect(() => readNextId(encode('{"next_id":1,"a":{"next_id":2}}'))).toThrow('more than once');
    expect(() => setNextId(encode('{"nodes":{}}'), 1)).toThrow('no "next_id"');
    expect(() => readNextId(encode('{"next_id":null}'))).toThrow('not a plain number');
    expect(() => setNextId(encode('{"next_id":1}'), -1)).toThrow();
  });
});

describe('ids', () => {
  test('client and first id at the edges', () => {
    expect(clientOf(2 ** 32 - 1)).toBe(0);
    expect(clientOf(2 ** 32)).toBe(1);
    expect(clientOf(2 ** 32 + 1)).toBe(1);
    expect(clientOf(4398046511105)).toBe(1024);
    expect(firstIdOf(1024)).toBe(4398046511105);
    expect(firstIdOf(0)).toBe(1);
    expect(clientOf(firstIdOf(MAX_CLIENT) + 2 ** 32 - 2)).toBe(MAX_CLIENT);
    expect(Number.isSafeInteger(firstIdOf(MAX_CLIENT) + 2 ** 32 - 2)).toBe(true);
    expect(MAX_CLIENT).toBe(2 ** 21 - 1);
  });

  test('numbers in string ids', () => {
    expect(idNumbers('VariableID:4398046511106')).toEqual([4398046511106]);
    expect(idNumbers('S:4398046511109')).toEqual([4398046511109]);
    expect(idNumbers('VariableCollectionId:1/mode4398046511108')).toEqual([1, 4398046511108]);
    expect(idNumbers('Other:1')).toEqual([]);
  });

  const base = (): FigDocument => ({
    next_id: 10,
    nodes: { '1': {}, '9': {} },
    styles: [{ id: 'S:1' }],
    variables: {
      collections: [
        { id: 'VariableCollectionId:1', modes: [{ id: 'VariableCollectionId:1/mode1' }] },
      ],
      variables: [{ id: 'VariableID:2' }],
    },
  });

  test('the highest client covers every kind of id', () => {
    const range = (client: number) => String(firstIdOf(client));

    expect(highestClient(base())).toBe(0);

    const layer = base();

    layer.nodes[range(3)] = {};
    expect(highestClient(layer)).toBe(3);

    const style = base();

    style.styles!.push({ id: `S:${range(4)}` });
    expect(highestClient(style)).toBe(4);

    const variable = base();

    variable.variables!.variables!.push({ id: `VariableID:${range(5)}` });
    expect(highestClient(variable)).toBe(5);

    const collection = base();

    collection.variables!.collections!.push({ id: `VariableCollectionId:${range(6)}` });
    expect(highestClient(collection)).toBe(6);

    const mode = base();

    mode.variables!.collections![0]!.modes!.push({ id: `VariableCollectionId:1/mode${range(7)}` });
    expect(highestClient(mode)).toBe(7);
  });
});

test('image hashes and parsing', () => {
  const document = parseDocument(
    encode('{"next_id":1,"nodes":{},"imageIndex":[{"hash":"aa"},{"hash":"bb"}]}'),
  );

  expect(imageHashes(document)).toEqual(['aa', 'bb']);
  expect(imageHashes(parseDocument(encode('{"next_id":1,"nodes":{}}')))).toEqual([]);
});
