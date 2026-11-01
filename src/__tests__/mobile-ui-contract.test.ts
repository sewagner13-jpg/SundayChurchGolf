import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('round submission clearly announces creation and keeps the primary action reachable', () => {
  const source = readFileSync(new URL('../app/rounds/new/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Create round & choose players/);
  assert.match(source, /sticky bottom-0/);
  assert.doesNotMatch(source, /Continue to Player Selection/);
  assert.doesNotMatch(source, /flex-col-reverse/);
});

test('constrained dashboard stays single column with game-day actions first', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /md:grid-cols-2/);
  assert.ok(source.indexOf('<ActiveRoundCard') < source.indexOf('<MastersLeaderboard'));
});
