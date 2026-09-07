import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../services/pagination';
test('A class with more than 1000 attempts retains all history rows', async () => {
  const source = Array.from({ length: 1260 }, (_, id) => ({ id }));
  const rows = await readAll(async (from, to) => ({
    data: source.slice(from, to + 1),
    error: null,
  }));
  assert.equal(rows.length, 1260);
  assert.equal(rows.at(-1)?.id, 1259);
});
