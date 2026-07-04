import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCrossFoursome66618PlayerPayouts,
  computeCrossFoursome66618GameSummaries,
  getCrossFoursome66618Pairings,
  validateCrossFoursome66618Config,
} from "@/lib/cross-foursome-66618";

const formatConfig = {
  crossFoursome66618: {
    scoreMode: "best_ball",
    foursomeA: {
      A1: "albert",
      A2: "eddie",
      A3: "griff",
      A4: "mike",
    },
    foursomeB: {
      B1: "jim",
      B2: "david",
      B3: "tony",
      B4: "sean",
    },
  },
};

const selectedPlayerIds = [
  "albert",
  "eddie",
  "griff",
  "mike",
  "jim",
  "david",
  "tony",
  "sean",
];

function scoresFromPlayerValues(
  holeValues: Array<Record<string, number>>
) {
  return holeValues.flatMap((holeValue, index) =>
    Object.entries(holeValue).map(([playerId, grossScore]) => ({
      playerId,
      holeNumber: index + 1,
      grossScore,
    }))
  );
}

function repeatedScores(valuesByPlayerId: Record<string, number>) {
  return scoresFromPlayerValues(
    Array.from({ length: 18 }, () => valuesByPlayerId)
  );
}

test("cross-foursome validation accepts exactly 8 unique assigned round players", () => {
  assert.deepEqual(
    validateCrossFoursome66618Config(formatConfig, selectedPlayerIds),
    []
  );
});

test("cross-foursome validation rejects missing, duplicate, non-round, and wrong-count assignments", () => {
  const missing = {
    crossFoursome66618: {
      scoreMode: "best_ball",
      foursomeA: { A1: "albert", A2: "eddie", A3: "griff" },
      foursomeB: { B1: "jim", B2: "david", B3: "tony", B4: "sean" },
    },
  };
  assert.match(
    validateCrossFoursome66618Config(missing, selectedPlayerIds)[0],
    /A4/
  );

  const duplicate = {
    crossFoursome66618: {
      scoreMode: "best_ball",
      foursomeA: { A1: "albert", A2: "albert", A3: "griff", A4: "mike" },
      foursomeB: { B1: "jim", B2: "david", B3: "tony", B4: "sean" },
    },
  };
  assert.match(
    validateCrossFoursome66618Config(duplicate, selectedPlayerIds)[0],
    /assigned once/
  );

  const nonRoundPlayer = {
    crossFoursome66618: {
      scoreMode: "best_ball",
      foursomeA: { A1: "albert", A2: "eddie", A3: "griff", A4: "mike" },
      foursomeB: { B1: "jim", B2: "david", B3: "tony", B4: "outsider" },
    },
  };
  assert.match(
    validateCrossFoursome66618Config(nonRoundPlayer, selectedPlayerIds)[0],
    /selected round player/
  );

  assert.match(
    validateCrossFoursome66618Config(formatConfig, selectedPlayerIds.slice(0, 7))[0],
    /exactly 8/
  );
});

test("cross-foursome pairings match the requested rotation", () => {
  const pairings = getCrossFoursome66618Pairings(formatConfig);

  assert.deepEqual(
    pairings.map((game) => ({
      id: game.id,
      pairs: game.pairs.map((pair) => pair.playerIds),
    })),
    [
      {
        id: "first6",
        pairs: [
          ["jim", "albert"],
          ["david", "mike"],
          ["tony", "griff"],
          ["sean", "eddie"],
        ],
      },
      {
        id: "second6",
        pairs: [
          ["jim", "mike"],
          ["david", "griff"],
          ["tony", "eddie"],
          ["sean", "albert"],
        ],
      },
      {
        id: "third6",
        pairs: [
          ["jim", "griff"],
          ["david", "eddie"],
          ["tony", "albert"],
          ["sean", "mike"],
        ],
      },
      {
        id: "overall18",
        pairs: [
          ["jim", "eddie"],
          ["david", "albert"],
          ["tony", "mike"],
          ["sean", "griff"],
        ],
      },
    ]
  );
});

test("cross-foursome best-ball hole scoring uses the lower partner gross score and applies two tie all tie", () => {
  const playerScores = scoresFromPlayerValues([
    {
      jim: 4,
      albert: 5,
      david: 5,
      mike: 6,
      tony: 5,
      griff: 6,
      sean: 6,
      eddie: 6,
    },
    {
      jim: 4,
      albert: 6,
      david: 4,
      mike: 6,
      tony: 5,
      griff: 6,
      sean: 6,
      eddie: 6,
    },
  ]);

  const [first6] = computeCrossFoursome66618GameSummaries({
    formatConfig,
    playerScores,
    totalPot: 80,
  });

  assert.equal(first6.holeOutcomes[0].winningVirtualTeamId, "first6-B1-A1");
  assert.equal(first6.holeOutcomes[0].isTie, false);
  assert.deepEqual(
    first6.holeOutcomes[0].pairScores.map((score) => score.bestBallScore),
    [4, 5, 5, 6]
  );

  assert.equal(first6.holeOutcomes[1].winningVirtualTeamId, null);
  assert.equal(first6.holeOutcomes[1].isTie, true);
});

test("cross-foursome summaries score each six-hole game and the overall game independently", () => {
  const summaries = computeCrossFoursome66618GameSummaries({
    formatConfig,
    playerScores: repeatedScores({
      jim: 4,
      albert: 5,
      eddie: 5,
      griff: 5,
      mike: 5,
      david: 6,
      tony: 6,
      sean: 6,
    }),
    totalPot: 80,
  });

  assert.deepEqual(
    summaries.map((summary) => ({
      id: summary.id,
      winnerIds: summary.winningVirtualTeamIds,
      wins: summary.pairs.map((pair) => pair.holesWon),
    })),
    [
      { id: "first6", winnerIds: ["first6-B1-A1"], wins: [6, 0, 0, 0] },
      { id: "second6", winnerIds: ["second6-B1-A4"], wins: [6, 0, 0, 0] },
      { id: "third6", winnerIds: ["third6-B1-A3"], wins: [6, 0, 0, 0] },
      { id: "overall18", winnerIds: ["overall18-B1-A2"], wins: [18, 0, 0, 0] },
    ]
  );
});

test("cross-foursome game-level ties produce co-winners", () => {
  const summaries = computeCrossFoursome66618GameSummaries({
    formatConfig,
    playerScores: repeatedScores({
      jim: 4,
      albert: 4,
      eddie: 4,
      griff: 4,
      mike: 4,
      david: 4,
      tony: 4,
      sean: 4,
    }),
    totalPot: 80,
  });

  assert.deepEqual(
    summaries[0].winningVirtualTeamIds,
    [
      "first6-B1-A1",
      "first6-B2-A4",
      "first6-B3-A3",
      "first6-B4-A2",
    ]
  );
  assert.equal(summaries[0].pairs.every((pair) => pair.holesWon === 0), true);
});

test("cross-foursome payout splitting pays winning virtual pairs and splits each pair share between partners", () => {
  const summaries = computeCrossFoursome66618GameSummaries({
    formatConfig,
    playerScores: repeatedScores({
      jim: 4,
      albert: 5,
      eddie: 5,
      griff: 5,
      mike: 5,
      david: 6,
      tony: 6,
      sean: 6,
    }),
    totalPot: 80,
  });

  const payouts = calculateCrossFoursome66618PlayerPayouts(summaries);

  assert.equal(payouts.get("jim"), 40);
  assert.equal(payouts.get("albert"), 10);
  assert.equal(payouts.get("mike"), 10);
  assert.equal(payouts.get("griff"), 10);
  assert.equal(payouts.get("eddie"), 10);
  assert.equal(payouts.get("david") ?? 0, 0);
  assert.equal(payouts.get("tony") ?? 0, 0);
  assert.equal(payouts.get("sean") ?? 0, 0);
});
