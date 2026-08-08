import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCrossThreesome666PlayerPayouts,
  computeCrossThreesome666GameSummaries,
  getCrossThreesome666Pairings,
  validateCrossThreesome666Config,
} from "@/lib/cross-threesome-666";

const formatConfig = {
  crossThreesome666: {
    scoreMode: "best_net_ball",
    threesomeA: { A1: "albert", A2: "eddie", A3: "griff" },
    threesomeB: { B1: "jim", B2: "david", B3: "tony" },
  },
};

const selectedPlayerIds = ["albert", "eddie", "griff", "jim", "david", "tony"];

function scoresForHole(values: Record<string, number>, holeNumber = 1) {
  return Object.entries(values).map(([playerId, grossScore]) => ({
    playerId,
    holeNumber,
    grossScore,
  }));
}

test("cross-threesome validates exactly six uniquely assigned players", () => {
  assert.deepEqual(validateCrossThreesome666Config(formatConfig, selectedPlayerIds), []);
  assert.match(
    validateCrossThreesome666Config(formatConfig, selectedPlayerIds.slice(0, 5))[0],
    /exactly 6/
  );
  assert.match(
    validateCrossThreesome666Config(
      {
        crossThreesome666: {
          ...formatConfig.crossThreesome666,
          threesomeB: { B1: "jim", B2: "jim", B3: "tony" },
        },
      },
      selectedPlayerIds
    )[0],
    /assigned once/
  );
});

test("cross-threesome rotates every cross-group pairing over the three six-hole games", () => {
  assert.deepEqual(
    getCrossThreesome666Pairings(formatConfig).map((game) => ({
      id: game.id,
      pairs: game.pairs.map((pair) => pair.playerIds),
    })),
    [
      {
        id: "first6",
        pairs: [["jim", "albert"], ["david", "griff"], ["tony", "eddie"]],
      },
      {
        id: "second6",
        pairs: [["jim", "griff"], ["david", "eddie"], ["tony", "albert"]],
      },
      {
        id: "third6",
        pairs: [["jim", "eddie"], ["david", "albert"], ["tony", "griff"]],
      },
    ]
  );
});

test("cross-threesome uses best net ball and applies two tie all tie", () => {
  const [first6] = computeCrossThreesome666GameSummaries({
    formatConfig,
    playerScores: scoresForHole({
      jim: 6,
      albert: 7,
      david: 5,
      griff: 7,
      tony: 7,
      eddie: 7,
    }),
    playerHandicapIndexes: { jim: 18, albert: 0, david: 0, griff: 0, tony: 0, eddie: 0 },
    courseHandicapRanks: { 1: 1 },
    totalPot: 60,
  });

  assert.equal(first6.holeOutcomes[0].isTie, true);
  assert.equal(first6.holeOutcomes[0].winningVirtualTeamId, null);
  assert.deepEqual(
    first6.holeOutcomes[0].pairScores.map((pair) => pair.bestBallScore),
    [5, 5, 7]
  );
});

test("cross-threesome splits the three game pots across the winning pairs", () => {
  const summaries = computeCrossThreesome666GameSummaries({
    formatConfig,
    playerScores: Array.from({ length: 18 }, (_, index) =>
      scoresForHole(
        { jim: 4, albert: 5, eddie: 5, griff: 5, david: 6, tony: 6 },
        index + 1
      )
    ).flat(),
    playerHandicapIndexes: { jim: 0, albert: 0, eddie: 0, griff: 0, david: 0, tony: 0 },
    courseHandicapRanks: Object.fromEntries(
      Array.from({ length: 18 }, (_, index) => [index + 1, index + 1])
    ),
    totalPot: 60,
  });

  const payouts = calculateCrossThreesome666PlayerPayouts(summaries);
  assert.equal(payouts.get("jim"), 30);
  assert.equal(payouts.get("albert"), 10);
  assert.equal(payouts.get("griff"), 10);
  assert.equal(payouts.get("eddie"), 10);
});
