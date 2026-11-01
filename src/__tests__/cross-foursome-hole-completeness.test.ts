import assert from "node:assert/strict";
import test from "node:test";
import { computeCrossFoursome66618GameSummaries } from "@/lib/cross-foursome-66618";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
const assignments = {
  foursomeA: { A1: "a", A2: "b", A3: "c", A4: "d" },
  foursomeB: { B1: "e", B2: "f", B3: "g", B4: "h" },
};
for (const scoreMode of ["best_ball", "best_net_ball"] as const) {
  for (const holeNumber of [1, 7, 13]) {
    test(`${scoreMode} hole ${holeNumber} waits for every partner, not just one cart`, () => {
      for (const scoredIds of [ids.slice(0, 4), ids.slice(4), ids.slice(0, 7)]) {
        const summaries = computeCrossFoursome66618GameSummaries({
          formatConfig: { crossFoursome66618: { ...assignments, scoreMode } },
          playerScores: scoredIds.map((playerId, i) => ({ playerId, holeNumber, grossScore: 4 + i })),
          playerHandicapIndexes: Object.fromEntries(ids.map(id => [id, 18])),
          courseHandicapRanks: { [holeNumber]: 1 },
        });
        for (const summary of summaries.filter(game => game.holeNumbers.includes(holeNumber))) {
          const hole = summary.holeOutcomes.find(hole => hole.holeNumber === holeNumber)!;
          assert.equal(hole.isComplete, false);
          assert.equal(hole.winningVirtualTeamId, null);
          assert.equal(hole.isTie, false);
          assert.equal(summary.completedHoles, 0);
          assert.ok(summary.pairs.every(pair => pair.holesWon === 0));
        }
      }
    });
  }
}

test("the last partner score can change the winner before the hole becomes complete", () => {
  const result = computeCrossFoursome66618GameSummaries({
    formatConfig: { crossFoursome66618: { ...assignments, scoreMode: "best_ball" } },
    playerScores: ids.map((playerId, i) => ({ playerId, holeNumber: 1, grossScore: [4, 5, 6, 7, 6, 3, 6, 6][i] })),
  })[0];
  assert.equal(result.holeOutcomes[0].isComplete, true);
  assert.equal(result.holeOutcomes[0].winningVirtualTeamId, "first6-B2-A4");
  assert.equal(result.completedHoles, 1);
});

test("net hole remains pending when one entered player lacks a valid handicap", () => {
  const result = computeCrossFoursome66618GameSummaries({
    formatConfig: { crossFoursome66618: { ...assignments, scoreMode: "best_net_ball" } },
    playerScores: ids.map(playerId => ({ playerId, holeNumber: 1, grossScore: 4 })),
    playerHandicapIndexes: Object.fromEntries(ids.slice(0, 7).map(id => [id, 18])),
    courseHandicapRanks: { 1: 1 },
  })[0];
  assert.equal(result.holeOutcomes[0].isComplete, false);
  assert.equal(result.holeOutcomes[0].winningVirtualTeamId, null);
});

test("no completed holes means no game winners or projected payouts", () => {
  for (const scoredIds of [[], ids.slice(0, 4)]) {
    const summaries = computeCrossFoursome66618GameSummaries({
      formatConfig: { crossFoursome66618: { ...assignments, scoreMode: "best_ball" } },
      playerScores: scoredIds.map(playerId => ({ playerId, holeNumber: 1, grossScore: 4 })),
      totalPot: 80,
    });
    for (const summary of summaries) {
      assert.deepEqual(summary.winningVirtualTeamIds, []);
      assert.equal(summary.payoutPerWinningPair, 0);
      assert.ok(summary.pairs.every(pair => pair.payout === 0));
    }
  }
});
