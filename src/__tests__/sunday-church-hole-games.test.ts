import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "@prisma/client/runtime/library";
import {
  calculateSundayChurchHoleGameResults,
  createDefaultSundayChurchHoleGamesConfig,
  determineSundayChurchHoleGameWinner,
  getSundayChurchHoleGameAssignment,
  validateSundayChurchHoleGamesConfig,
  type SundayChurchHoleGameScore,
} from "@/lib/sunday-church-hole-games";

const teams = [
  { id: "team-a", teamNumber: 1 },
  { id: "team-b", teamNumber: 2 },
];

const courseHoles = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
  par: index === 3 ? 3 : 4,
  handicapRank: index + 1,
}));

function valueScore(
  teamId: string,
  holeNumber: number,
  value: number,
  grossScore: number | null = value
): SundayChurchHoleGameScore {
  return {
    teamId,
    holeNumber,
    entryType: "VALUE",
    value,
    grossScore,
  };
}

test("hole game resolver defaults every hole to Sunday Church skins", () => {
  const config = createDefaultSundayChurchHoleGamesConfig();

  assert.equal(
    getSundayChurchHoleGameAssignment(config, 1).formatId,
    "default-sunday-church"
  );
  assert.equal(
    getSundayChurchHoleGameAssignment(config, 18).formatId,
    "default-sunday-church"
  );
});

test("hole game validation rejects missing and invalid assignments", () => {
  assert.deepEqual(validateSundayChurchHoleGamesConfig(null), [
    "Assign a gameplay format to every hole.",
  ]);

  const config = createDefaultSundayChurchHoleGamesConfig();
  config.holeGames = {
    ...config.holeGames,
    "7": { formatId: "nassau" as never },
  };

  assert.deepEqual(validateSundayChurchHoleGamesConfig(config), [
    "Hole 7 has an invalid gameplay format.",
  ]);
});

test("mixed skins supports higher-wins, lower-wins, points, and carryovers", () => {
  const config = createDefaultSundayChurchHoleGamesConfig();
  config.holeGames = {
    ...config.holeGames,
    "1": { formatId: "default-sunday-church" },
    "2": { formatId: "two_best_balls_of_four" },
    "3": { formatId: "chicago_points_team" },
  };

  const result = calculateSundayChurchHoleGameResults(
    [
      valueScore("team-a", 1, 1, null),
      valueScore("team-b", 1, 1, null),
      valueScore("team-a", 2, 9),
      valueScore("team-b", 2, 10),
      valueScore("team-a", 3, 2),
      valueScore("team-b", 3, 5),
    ],
    teams,
    1,
    new Decimal(180),
    courseHoles,
    config
  );

  assert.equal(result.holeResults[0].winnerTeamId, null);
  assert.equal(result.holeResults[0].isTie, true);
  assert.equal(result.holeResults[1].winnerTeamId, "team-a");
  assert.equal(result.holeResults[1].carrySkinsUsed, 2);
  assert.equal(result.holeResults[2].winnerTeamId, "team-b");
  assert.equal(result.teamPayouts.get("team-a")?.toNumber(), 20);
  assert.equal(result.teamPayouts.get("team-b")?.toNumber(), 10);
});

test("all birdies count uses lower stored scores and X cannot win", () => {
  const result = determineSundayChurchHoleGameWinner(
    [
      valueScore("team-a", 8, -3),
      {
        teamId: "team-b",
        holeNumber: 8,
        entryType: "X",
        value: null,
        grossScore: null,
      },
    ],
    "lower"
  );

  assert.equal(result.winnerTeamId, "team-a");
  assert.equal(result.isTie, false);
});
