import assert from 'node:assert/strict';
import test from 'node:test';
import { createBurgerRefresh } from '../lib/burger-refresh';

test('other viewers receive a freshly saved shared list on refresh', async () => {
  let shared = ['a']; const seen: string[][] = [];
  const reader = createBurgerRefresh(async () => [...shared], value => seen.push(value), () => {});
  await reader.refresh(); shared = ['a', 'b']; await reader.refresh();
  assert.deepEqual(seen, [['a'], ['a', 'b']]); reader.stop();
});
test('a pre-save read cannot overwrite a new mark; polling resumes after save', async () => {
  let resolve!: (value: string[]) => void; const seen: string[][] = [];
  let first = true;
  const reader = createBurgerRefresh(() => first ? (first = false, new Promise<string[]>(r => resolve = r)) : Promise.resolve(['a','b']), value => seen.push(value), () => {});
  const old = reader.refresh(); reader.pause(); resolve(['a']); await old;
  assert.equal(seen.length, 0); await reader.refresh(); assert.equal(seen.length, 0);
  reader.resume(); await reader.refresh(); assert.deepEqual(seen, [['a','b']]); reader.stop();
});
test('errors report stale data and unmounted views ignore late responses', async () => {
  const errors: unknown[] = []; const seen: string[][] = [];
  const reader = createBurgerRefresh(async () => { throw Error('offline'); }, value => seen.push(value), error => errors.push(error));
  await reader.refresh(); assert.equal(errors.length, 1); assert.equal(seen.length, 0);
  reader.stop(); await reader.refresh(); assert.equal(errors.length, 1);
  let resolve!: (value: string[]) => void;
  const late = createBurgerRefresh(() => new Promise<string[]>(r => resolve=r), value => seen.push(value), () => {});
  const pending=late.refresh(); late.stop(); resolve(['a']); await pending; assert.equal(seen.length, 0);
});
