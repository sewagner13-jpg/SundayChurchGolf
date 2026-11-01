import assert from "node:assert/strict";
import test from "node:test";
import { buildPlayerWinnings, type WinningsRound } from "@/lib/player-winnings";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
function fixture(pot = 240): WinningsRound {
  return {
    format: { name: "Cross-Foursome 6-6-6-18" }, pot,
    formatConfig: { crossFoursome66618: { scoreMode: "best_ball", foursomeA: { A1: "a", A2: "b", A3: "c", A4: "d" }, foursomeB: { B1: "e", B2: "f", B3: "g", B4: "h" } } },
    course: { holes: [] },
    teams: [],
    roundPlayers: ids.map(playerId => ({ id: `rp-${playerId}`, playerId, payoutAmount: 30, eventHandicapIndex: null, player: { fullName: playerId, nickname: null } })),
  };
}
const tiedScores = ids.flatMap(playerId => Array.from({length: 18}, (_, i) => ({ playerId, holeNumber: i + 1, grossScore: 5 })));

test("each cross game is attributed separately and sums to recorded cents", () => {
  const row = buildPlayerWinnings(fixture(), tiedScores)[0];
  assert.deepEqual(row.items.map(item => [item.label, item.amountCents]), [["First 6", 750], ["Second 6", 750], ["Third 6", 750], ["Overall 18", 750]]);
  assert.equal(row.totalCents, 3000);
});

test("fractional tied shares reconcile to engine rounding without fake adjustment", () => {
  const round = fixture(240.08);
  round.roundPlayers.forEach(player => { player.payoutAmount = 30.01; });
  const rows = buildPlayerWinnings(round, tiedScores);
  for (const row of rows) {
    assert.equal(row.items.reduce((sum, item) => sum + item.amountCents, 0), 3001);
    assert.ok(row.items.every(item => item.kind === "bet" && Number.isInteger(item.amountCents)));
  }
});

test("uses configured contest labels and shares team prizes without duplicating them", () => {
  const round = fixture();
  round.formatConfig!.par3Contest = { enabled: true, holes: [{ holeNumber: 3, contestType: "CLOSEST_TO_PIN", payoutTarget: "PLAYER" }, { holeNumber: 8, contestType: "LONGEST_PUTT", payoutTarget: "TEAM" }], results: [{ holeNumber: 3, winnerPlayerId: "a", payoutAmount: 12 }, { holeNumber: 8, winnerPlayerId: "b", payoutAmount: 10 }] };
  round.teams = [{ id: "t", roundPlayers: [{ playerId: "a" }, { playerId: "b" }] }];
  round.roundPlayers[0].payoutAmount = 47;
  round.roundPlayers[1].payoutAmount = 35;
  const rows = buildPlayerWinnings(round, tiedScores);
  assert.deepEqual(rows.find(row => row.playerId === "a")!.items.slice(4).map(item => [item.label, item.amountCents]), [["Closest to the hole · Hole 3", 1200], ["Longest putt · Hole 8 (team share)", 500]]);
  assert.equal(rows.find(row => row.playerId === "b")!.items.at(-1)!.amountCents, 500);
});

test("stored payout stays authoritative when reconstructed bets differ", () => {
  const round = fixture();
  round.roundPlayers[0].payoutAmount = 25;
  const row = buildPlayerWinnings(round, tiedScores).find(row => row.playerId === "a")!;
  assert.equal(row.totalCents, 2500);
  assert.deepEqual(row.items.at(-1), { id: "recorded-adjustment", label: "Recorded payout adjustment", amountCents: -500, kind: "adjustment" });
  assert.equal(row.items.reduce((sum, item) => sum + item.amountCents, 0), row.totalCents);
});

test("missing score details never invent winning bets", () => {
  const round = fixture();
  round.roundPlayers[0].payoutAmount = 0;
  const rows = buildPlayerWinnings(round, []);
  assert.deepEqual(rows.find(row => row.playerId === "a")!.items, []);
  assert.equal(rows.find(row => row.playerId === "b")!.items[0].kind, "adjustment");
});

test("partial game scores do not masquerade as confirmed winning bets", () => {
  const row = buildPlayerWinnings(fixture(), tiedScores.filter(score => score.holeNumber === 1))[0];
  assert.deepEqual(row.items.map(item => item.kind), ["adjustment"]);
});

test("odd team contest cents go to stable round-player IDs exactly once", () => {
  const round = fixture();
  round.format.name = "Other format";
  round.roundPlayers = round.roundPlayers.slice(0, 3);
  round.roundPlayers.forEach((player, index) => { player.payoutAmount = index === 0 ? 3.34 : 3.33; });
  round.teams = [{id:"team", roundPlayers: [{playerId:"c"}, {playerId:"b"}, {playerId:"a"}]}];
  round.formatConfig = {par3Contest:{enabled:true,holes:[{holeNumber:3,contestType:"LONGEST_PUTT",payoutTarget:"TEAM"}],results:[{holeNumber:3,winnerPlayerId:"a",payoutAmount:10}]}};
  const rows = buildPlayerWinnings(round, []);
  assert.deepEqual(rows.map(row => row.items[0].amountCents), [334,333,333]);
  assert.ok(rows.every(row => row.items.length === 1));
});

test("inactive and duplicate stored contest results cannot invent extra prize money", () => {
  const round = fixture();
  round.roundPlayers[0].payoutAmount = 42;
  round.formatConfig!.par3Contest = {enabled:true,holes:[{holeNumber:3,contestType:"CLOSEST_TO_PIN",payoutTarget:"PLAYER"}],results:[{holeNumber:3,winnerPlayerId:"a",payoutAmount:12},{holeNumber:3,winnerPlayerId:"a",payoutAmount:12},{holeNumber:8,winnerPlayerId:"a",payoutAmount:20}]};
  const row = buildPlayerWinnings(round, tiedScores)[0];
  assert.equal(row.items.length, 5);
  assert.equal(row.items.reduce((sum, item) => sum + item.amountCents, 0), 4200);
});
