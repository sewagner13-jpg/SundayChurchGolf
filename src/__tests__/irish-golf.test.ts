import test from "node:test";
import assert from "node:assert/strict";

import {
  computeIrishGolfOverallSummary,
  computeIrishGolfSegmentSummaries,
} from "@/lib/irish-golf";

const teams = [
  { id: "team-a", teamNumber: 1 },
  { id: "team-b", teamNumber: 2 },
];

function makeHoleScore(
  teamId: string,
  holeNumber: number,
  grossScore: number
) {
  return {
    teamId,
    holeNumber,
    entryType: "VALUE",
    value: grossScore,
    grossScore,
  };
}

test("irish golf segment match play uses hole wins instead of aggregate totals", () => {
  const holeScores = [
    makeHoleScore("team-a", 1, 4),
    makeHoleScore("team-b", 1, 5),
    makeHoleScore("team-a", 2, 4),
    makeHoleScore("team-b", 2, 5),
    makeHoleScore("team-a", 3, 4),
    makeHoleScore("team-b", 3, 5),
    makeHoleScore("team-a", 4, 4),
    makeHoleScore("team-b", 4, 5),
    makeHoleScore("team-a", 5, 10),
    makeHoleScore("team-b", 5, 5),
    makeHoleScore("team-a", 6, 10),
    makeHoleScore("team-b", 6, 5),
  ];

  const [segment] = computeIrishGolfSegmentSummaries(
    teams,
    holeScores,
    {
      segment1FormatId: "two_best_balls_of_four",
      segment1MatchPlay: true,
      segment2FormatId: "two_best_balls_of_four",
      segment3FormatId: "two_best_balls_of_four",
    },
    120
  );

  assert.equal(segment.scoringMode, "match_play");
  assert.equal(segment.teamTotals.get("team-a"), 4);
  assert.equal(segment.teamTotals.get("team-b"), 2);
  assert.deepEqual(segment.winningTeamIds, ["team-a"]);
});

test("irish golf segment aggregate scoring still uses total strokes", () => {
  const holeScores = [
    makeHoleScore("team-a", 1, 4),
    makeHoleScore("team-b", 1, 5),
    makeHoleScore("team-a", 2, 4),
    makeHoleScore("team-b", 2, 5),
    makeHoleScore("team-a", 3, 4),
    makeHoleScore("team-b", 3, 5),
    makeHoleScore("team-a", 4, 4),
    makeHoleScore("team-b", 4, 5),
    makeHoleScore("team-a", 5, 10),
    makeHoleScore("team-b", 5, 5),
    makeHoleScore("team-a", 6, 10),
    makeHoleScore("team-b", 6, 5),
  ];

  const [segment] = computeIrishGolfSegmentSummaries(
    teams,
    holeScores,
    {
      segment1FormatId: "two_best_balls_of_four",
      segment2FormatId: "two_best_balls_of_four",
      segment3FormatId: "two_best_balls_of_four",
    },
    120
  );

  assert.equal(segment.scoringMode, "aggregate");
  assert.equal(segment.teamTotals.get("team-a"), 36);
  assert.equal(segment.teamTotals.get("team-b"), 30);
  assert.deepEqual(segment.winningTeamIds, ["team-b"]);
});

test("irish golf overall match play uses hole wins across all 18 holes", () => {
  const holeScores = Array.from({ length: 18 }, (_, index) => {
    const holeNumber = index + 1;
    if (holeNumber <= 10) {
      return [
        makeHoleScore("team-a", holeNumber, 4),
        makeHoleScore("team-b", holeNumber, 5),
      ];
    }
    return [
      makeHoleScore("team-a", holeNumber, 10),
      makeHoleScore("team-b", holeNumber, 5),
    ];
  }).flat();

  const overall = computeIrishGolfOverallSummary(
    teams,
    holeScores,
    {
      segment1FormatId: "two_best_balls_of_four",
      segment2FormatId: "two_best_balls_of_four",
      segment3FormatId: "two_best_balls_of_four",
      enableOverallGame: true,
      overallGameMatchPlay: true,
    },
    120
  );

  assert.ok(overall);
  assert.equal(overall?.scoringMode, "match_play");
  assert.equal(overall?.teamTotals.get("team-a"), 10);
  assert.equal(overall?.teamTotals.get("team-b"), 8);
  assert.deepEqual(overall?.winningTeamIds, ["team-a"]);
});
