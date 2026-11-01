import assert from "node:assert/strict";
import test from "node:test";
import { computeCrossThreesome666GameSummaries } from "@/lib/cross-threesome-666";

const ids = ["a", "b", "c", "d", "e", "f"];
const formatConfig = {crossThreesome666: {
  scoreMode: "best_net_ball",
  threesomeA: {A1: "a", A2: "b", A3: "c"},
  threesomeB: {B1: "d", B2: "e", B3: "f"},
}};
for (const holeNumber of [1, 7, 13]) {
  test(`cross-threesome hole ${holeNumber} waits for every partner`, () => {
    for (const scoredIds of [[], ids.slice(0, 3), ids.slice(3), ids.slice(0, 5)]) {
      const games = computeCrossThreesome666GameSummaries({
        formatConfig,
        playerScores: scoredIds.map((playerId, index) => ({playerId, holeNumber, grossScore: 4 + index})),
        playerHandicapIndexes: Object.fromEntries(ids.map(id => [id, 18])),
        courseHandicapRanks: {[holeNumber]: 1}, totalPot: 180,
      });
      for (const game of games) {
        assert.equal(game.completedHoles, 0);
        assert.deepEqual(game.winningVirtualTeamIds, []);
        assert.equal(game.payoutPerWinningPair, 0);
        assert.ok(game.pairs.every(pair => pair.payout === 0));
        assert.ok(game.holeOutcomes.every(hole => !hole.isComplete && !hole.isTie && hole.winningVirtualTeamId === null));
      }
    }
  });
}

test("cross-threesome resolves only when the last partner's score arrives", () => {
  const game = computeCrossThreesome666GameSummaries({
    formatConfig,
    playerScores: ids.map((playerId, index) => ({playerId, holeNumber: 1, grossScore: index === 5 ? 3 : 5})),
    playerHandicapIndexes: Object.fromEntries(ids.map(id => [id, 18])),
    courseHandicapRanks: {1: 1},
  })[0];
  assert.equal(game.holeOutcomes[0].isComplete, true);
  assert.equal(game.holeOutcomes[0].winningVirtualTeamId, "first6-B3-A2");
});
