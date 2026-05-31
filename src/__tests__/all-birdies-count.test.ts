import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAllBirdiesCountScore,
  isAllBirdiesCountEnabledForHole,
} from "@/lib/all-birdies-count";
import { computeIrishGolfSegmentSummaries } from "@/lib/irish-golf";

const teams = [
  { id: "team-a", teamNumber: 1 },
  { id: "team-b", teamNumber: 2 },
];

function score(teamId: string, holeNumber: number, grossScore: number) {
  return {
    teamId,
    holeNumber,
    entryType: "VALUE",
    value: grossScore,
    grossScore,
  };
}

test("all birdies count resolves standalone scramble config", () => {
  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "captains_choice",
      "captains_choice",
      1,
      { allBirdiesCount: true }
    ),
    true
  );
});

test("all birdies count resolves 6-6-6 segment config by hole", () => {
  const formatConfig = {
    segment1AllBirdiesCount: false,
    segment2AllBirdiesCount: true,
    segment3AllBirdiesCount: false,
  };

  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "irish_golf_6_6_6",
      "step_aside_scramble",
      8,
      formatConfig
    ),
    true
  );
  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "irish_golf_6_6_6",
      "step_aside_scramble",
      3,
      formatConfig
    ),
    false
  );
});

test("all birdies count resolves Nassau front and back config", () => {
  const formatConfig = {
    frontNineAllBirdiesCount: true,
    backNineAllBirdiesCount: false,
  };

  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "nassau",
      "scramble_rotating_drives",
      4,
      formatConfig
    ),
    true
  );
  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "nassau",
      "scramble_rotating_drives",
      14,
      formatConfig
    ),
    false
  );
});

test("all birdies count ignores non-eligible formats", () => {
  assert.equal(
    isAllBirdiesCountEnabledForHole(
      "lone_ranger",
      "lone_ranger",
      1,
      { allBirdiesCount: true }
    ),
    false
  );
});

test("all birdies count stores birdies as negative scores", () => {
  assert.deepEqual(getAllBirdiesCountScore(4), {
    storedScore: -4,
    displayScore: "-4",
  });
  assert.deepEqual(getAllBirdiesCountScore(0), {
    storedScore: 0,
    displayScore: "0",
  });
});

test("6-6-6 match play treats lower all-birdies scores as hole winners", () => {
  const [segment] = computeIrishGolfSegmentSummaries(
    teams,
    [
      score("team-a", 1, -2),
      score("team-b", 1, -2),
      score("team-a", 2, -4),
      score("team-b", 2, -3),
    ],
    {
      segment1FormatId: "step_aside_scramble",
      segment1MatchPlay: true,
      segment1CarryOver: true,
    },
    90
  );

  assert.equal(segment.teamTotals.get("team-a"), 2);
  assert.equal(segment.teamTotals.get("team-b"), 0);
  assert.deepEqual(segment.winningTeamIds, ["team-a"]);
});

test("6-6-6 aggregate totals add all-birdies negative scores", () => {
  const [segment] = computeIrishGolfSegmentSummaries(
    teams,
    [
      score("team-a", 1, -4),
      score("team-b", 1, -3),
      score("team-a", 2, -1),
      score("team-b", 2, -2),
    ],
    {
      segment1FormatId: "captains_choice",
      segment1MatchPlay: false,
    },
    90
  );

  assert.equal(segment.teamTotals.get("team-a"), -5);
  assert.equal(segment.teamTotals.get("team-b"), -5);
  assert.deepEqual(segment.winningTeamIds.sort(), ["team-a", "team-b"]);
});
