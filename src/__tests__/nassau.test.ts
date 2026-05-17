import test from "node:test";
import assert from "node:assert/strict";

import {
  computeNassauOverallSummary,
  computeNassauSegmentSummaries,
  getNassauSegmentFormatId,
} from "@/lib/nassau";

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

test("nassau uses configured front and back nine formats", () => {
  const formatConfig = {
    frontNineFormatId: "lone_ranger",
    backNineFormatId: "step_aside_scramble",
  };

  assert.equal(getNassauSegmentFormatId(1, formatConfig), "lone_ranger");
  assert.equal(getNassauSegmentFormatId(9, formatConfig), "lone_ranger");
  assert.equal(getNassauSegmentFormatId(10, formatConfig), "step_aside_scramble");
  assert.equal(getNassauSegmentFormatId(18, formatConfig), "step_aside_scramble");
});

test("nassau splits the pot across front, back, and overall games", () => {
  const holeScores = Array.from({ length: 18 }, (_, index) => {
    const holeNumber = index + 1;
    if (holeNumber <= 9) {
      return [
        makeHoleScore("team-a", holeNumber, 4),
        makeHoleScore("team-b", holeNumber, 5),
      ];
    }
    return [
      makeHoleScore("team-a", holeNumber, 6),
      makeHoleScore("team-b", holeNumber, 4),
    ];
  }).flat();

  const formatConfig = {
    frontNineFormatId: "lone_ranger",
    backNineFormatId: "step_aside_scramble",
  };
  const segments = computeNassauSegmentSummaries(
    teams,
    holeScores,
    formatConfig,
    90
  );
  const overall = computeNassauOverallSummary(
    teams,
    holeScores,
    formatConfig,
    90
  );

  assert.equal(segments.length, 2);
  assert.equal(segments[0].segmentPot, 30);
  assert.equal(segments[1].segmentPot, 30);
  assert.deepEqual(segments[0].winningTeamIds, ["team-a"]);
  assert.deepEqual(segments[1].winningTeamIds, ["team-b"]);
  assert.equal(overall.overallPot, 30);
  assert.equal(overall.teamTotals.get("team-a"), 90);
  assert.equal(overall.teamTotals.get("team-b"), 81);
  assert.deepEqual(overall.winningTeamIds, ["team-b"]);
});
