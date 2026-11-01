import assert from "node:assert/strict";
import test from "node:test";
import { computeCrossFoursome66618GameSummaries, calculateCrossFoursome66618PlayerPayouts } from "@/lib/cross-foursome-66618";

for (const buyIn of [25, 30, 30.01]) {
  test(`eight-player $${buyIn} payouts conserve the pot through a three-way game tie`, () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const summaries = computeCrossFoursome66618GameSummaries({
      formatConfig: {crossFoursome66618: {
        scoreMode: "best_ball",
        foursomeA: {A1: "a", A2: "b", A3: "c", A4: "d"},
        foursomeB: {B1: "e", B2: "f", B3: "g", B4: "h"},
      }},
      totalPot: buyIn * 8,
      playerScores: Array.from({length: 18}, (_, hole) => ids.map(playerId => ({
        playerId, holeNumber: hole + 1, grossScore: hole < 6 ? ([["e", "a"], ["f", "d"], ["g", "c"]][Math.floor(hole / 2)].includes(playerId) ? 4 : 6) : 5,
      }))).flat(),
    });
    assert.equal(summaries[0].winningVirtualTeamIds.length, 3);
    const payouts = calculateCrossFoursome66618PlayerPayouts(summaries);
    assert.equal([...payouts.values()].reduce((sum, amount) => sum + Math.round(amount * 100), 0), Math.round(buyIn * 8 * 100));
    assert.ok([...payouts.values()].every(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8));
    assert.deepEqual([...calculateCrossFoursome66618PlayerPayouts(summaries)], [...payouts]);
  });
}
