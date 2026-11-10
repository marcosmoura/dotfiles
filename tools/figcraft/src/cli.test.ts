import { describe, expect, test } from 'bun:test';

import { readInput } from './cli';

describe('readInput', () => {
  test('reads a JSON object and lets flags override it', async () => {
    expect(await readInput(['{"name":"Card","limit":5}', '--limit', '9', '--shot'])).toEqual({
      name: 'Card',
      limit: 9,
      shot: true,
    });
  });

  test('wraps a bare tree or command list', async () => {
    expect(await readInput(['[{"frame":"A"}]'])).toEqual({ tree: [{ frame: 'A' }] });
    expect(await readInput(['[{"command":"page.list"}]'])).toEqual({
      commands: [{ command: 'page.list' }],
    });
  });

  test('treats a bare word as the main key and a number as an id', async () => {
    expect(await readInput(['node.set'], 'query')).toEqual({ query: 'node.set' });
    expect(await readInput(['Card', '--page', 'Docs'], 'name')).toEqual({ name: 'Card', page: 'Docs' });
    expect(await readInput(['42'], 'name')).toEqual({ id: 42 });
  });

  test('parses flag values as JSON when they are', async () => {
    expect(await readInput(['--ids', '[1,2]', '--name', 'A B'])).toEqual({ ids: [1, 2], name: 'A B' });
  });

  test('rejects malformed input', async () => {
    await expect(readInput(['{nope'])).rejects.toThrow(/not valid JSON/);
    await expect(readInput(['{}', 'stray'])).rejects.toThrow(/unexpected argument/);
  });
});
