import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BurgerListView } from '../components/burger-list-view';

test('every marked player is visible without selecting a team or opening the editor', () => {
  const html = renderToStaticMarkup(createElement(BurgerListView, {players:[{playerId:'a',playerName:'Alice'},{playerId:'b',playerName:'Bob'},{playerId:'c',playerName:'Carol'}], selectedPlayerIds:['a','c'], expanded:false, saving:false, onExpand:() => {}, onChange:() => {} }));
  assert.match(html, /Alice/); assert.match(html, /Carol/); assert.doesNotMatch(html, /Bob/);
});
test('the editor reflects shared marks and disables changes during persistence', () => {
  const html = renderToStaticMarkup(createElement(BurgerListView, {players:[{playerId:'a',playerName:'Alice'},{playerId:'b',playerName:'Bob'}], selectedPlayerIds:['b'], expanded:true, saving:true, onExpand:() => {}, onChange:() => {} }));
  assert.match(html, /Bob/); assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
});
test('burger controls name each player without duplicating parent save status', () => {
  const html = renderToStaticMarkup(createElement(BurgerListView, {players:[{playerId:'a',playerName:'Alice'}], selectedPlayerIds:['a'], expanded:true, saving:true, onExpand:() => {}, onChange:() => {} }));
  assert.match(html, /aria-label="Burger for Alice"/);
  assert.doesNotMatch(html, /role="status"/);
  assert.match(html, /min-h-12/);
});
