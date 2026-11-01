import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerWinningsList } from "@/components/player-winnings-list";

test("receipt renders each bet beside its dollars and labels a player with no wins", () => {
  const html = renderToStaticMarkup(<PlayerWinningsList rows={[
    {roundPlayerId:"a",playerId:"a",playerName:"Albert",totalCents:2750,items:[{id:"first6",label:"First 6",amountCents:1250,kind:"bet"},{id:"pin3",label:"Closest to the hole · Hole 3",amountCents:1500,kind:"bet"}]},
    {roundPlayerId:"b",playerId:"b",playerName:"Eddie",totalCents:0,items:[]},
  ]} />);
  assert.match(html, /aria-label="Albert winnings"/);
  assert.match(html, /First 6/);
  assert.match(html, /\$12\.50/);
  assert.match(html, /Closest to the hole · Hole 3/);
  assert.match(html, /\$15\.00/);
  assert.match(html, /\$27\.50/);
  assert.match(html, /No bets won/);
  assert.doesNotMatch(html, /Main game/);
});

test("negative adjustment remains visible with signed dollars", () => {
  const html = renderToStaticMarkup(<PlayerWinningsList rows={[{roundPlayerId:"a",playerId:"a",playerName:"Albert",totalCents:500,items:[{id:"first6",label:"First 6",amountCents:1000,kind:"bet"},{id:"recorded-adjustment",label:"Recorded payout adjustment",amountCents:-500,kind:"adjustment"}]}]} />);
  assert.match(html, /Recorded payout adjustment/);
  assert.match(html, /−\$5\.00/);
});
