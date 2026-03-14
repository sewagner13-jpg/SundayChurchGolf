import test from "node:test";
import assert from "node:assert/strict";
import {
  compute1BestBall,
  compute2BestBalls,
  compute3BestBalls,
  computeFormatScore,
  computeLoneRanger,
  computeMoneyBall,
  computeTrainGame,
  computeChaChaCha,
  computeShamble,
  computeChicagoTeamPoints,
  computeChicagoPoints,
  computeWolfTeam,
  computeVegasTeamNumber,
  computeVegasMatchRound,
  computeVegas,
  computeMoneyBallRoundTotals,
  getMinimumScoresRequired,
  getIrishGolfSegmentFormatId,
  type PlayerInput,
} from "@/lib/format-scoring";

const samplePlayers: PlayerInput[] = [
  { playerId: "p1", playerName: "One", grossScore: 4 },
  { playerId: "p2", playerName: "Two", grossScore: 5 },
  { playerId: "p3", playerName: "Three", grossScore: 6 },
  { playerId: "p4", playerName: "Four", grossScore: 7 },
];

test("compute2BestBalls counts the two lowest gross scores", () => {
  const result = compute2BestBalls(samplePlayers);
  assert.equal(result.teamGrossScore, 9);
  assert.deepEqual(result.countedPlayerIds, ["p1", "p2"]);
});

test("compute2BestBalls credits ties at the cutoff to both players", () => {
  const result = compute2BestBalls([
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: 5 },
    { playerId: "p4", playerName: "Four", grossScore: null },
  ]);
  assert.equal(result.teamGrossScore, 9);
  assert.deepEqual(result.countedPlayerIds, ["p1", "p2", "p3"]);
});

test("compute1BestBall counts only the lowest gross score", () => {
  const result = compute1BestBall(samplePlayers);
  assert.equal(result.teamGrossScore, 4);
  assert.deepEqual(result.countedPlayerIds, ["p1"]);
});

test("best ball formats only require the counted number of scores", () => {
  const result = compute2BestBalls([
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: null },
    { playerId: "p4", playerName: "Four", grossScore: null },
  ]);
  assert.equal(result.teamGrossScore, 9);
  assert.equal(getMinimumScoresRequired("two_best_balls_of_four"), 2);
});

test("computeMoneyBall applies penalty only to the money ball total", () => {
  const result = computeMoneyBall(samplePlayers, "p1", true, 4);
  assert.equal(result.teamGrossScore, 9);
  assert.equal(result.moneyBallAdjustedScore, 8);
  assert.equal(result.moneyBallPenalty, 4);
});

test("computeTrainGame builds a three-digit train number", () => {
  const result = computeTrainGame(samplePlayers);
  assert.equal(result.teamGrossScore, 456);
  assert.equal(result.teamDisplayScore, "456");
});

test("computeFormatScore supports Vegas team numbers", () => {
  const result = computeFormatScore("vegas", samplePlayers.slice(0, 2), 1, 4);
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 45);
  assert.equal(result?.teamDisplayScore, "45");
});

test("computeFormatScore supports 1 Best Ball of 4", () => {
  const result = computeFormatScore(
    "one_best_ball_of_four",
    samplePlayers,
    1,
    4
  );
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 4);
});

test("computeVegasMatchRound carries points on ties when enabled", () => {
  const result = computeVegasMatchRound(
    [
      {
        holeNumber: 1,
        team1Scores: [4, 5],
        team2Scores: [4, 5],
        par: 4,
      },
      {
        holeNumber: 2,
        team1Scores: [3, 4],
        team2Scores: [4, 5],
        par: 4,
      },
    ],
    { pointsCarryOver: true }
  );

  assert.equal(result.team1Total, 22);
  assert.equal(result.team2Total, -22);
});

test("computeFormatScore supports wolf partner selection", () => {
  const result = computeFormatScore("wolf_team", samplePlayers, 1, 4, {
    designatedPlayerId: "p1",
    partnerPlayerId: "p2",
  });

  assert.ok(result);
  assert.equal(result?.teamGrossScore, 1);
});

test("irish golf segment selection uses the configured six-hole blocks", () => {
  const formatConfig = {
    segment1FormatId: "two_best_balls_of_four",
    segment2FormatId: "money_ball",
    segment3FormatId: "train_game",
  };

  assert.equal(getIrishGolfSegmentFormatId(3, formatConfig), "two_best_balls_of_four");
  assert.equal(getIrishGolfSegmentFormatId(9, formatConfig), "money_ball");
  assert.equal(getIrishGolfSegmentFormatId(16, formatConfig), "train_game");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 Best Balls of 4
// ─────────────────────────────────────────────────────────────────────────────

test("compute3BestBalls counts the three lowest gross scores", () => {
  const result = compute3BestBalls(samplePlayers);
  assert.equal(result.teamGrossScore, 15); // 4 + 5 + 6
  assert.deepEqual(result.countedPlayerIds, ["p1", "p2", "p3"]);
});

test("compute3BestBalls returns null when fewer than three scores available", () => {
  const result = compute3BestBalls([
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: null },
    { playerId: "p4", playerName: "Four", grossScore: null },
  ]);
  assert.equal(result.teamGrossScore, null);
});

test("computeFormatScore supports 3 Best Balls of 4", () => {
  const result = computeFormatScore("three_best_balls_of_four", samplePlayers, 1, 4);
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 15);
});

test("getMinimumScoresRequired returns correct values for best ball formats", () => {
  assert.equal(getMinimumScoresRequired("one_best_ball_of_four"), 1);
  assert.equal(getMinimumScoresRequired("two_best_balls_of_four"), 2);
  assert.equal(getMinimumScoresRequired("three_best_balls_of_four"), 3);
  assert.equal(getMinimumScoresRequired("unknown_format"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Lone Ranger / Yellow Ball
// ─────────────────────────────────────────────────────────────────────────────

test("computeLoneRanger uses designated player score plus best of rest", () => {
  const result = computeLoneRanger(samplePlayers, "p3");
  // Lone Ranger (p3) scores 6, best of rest is p1 with 4
  assert.equal(result.teamGrossScore, 10);
  assert.ok(result.countedPlayerIds.includes("p3"));
  assert.ok(result.countedPlayerIds.includes("p1"));
});

test("computeLoneRanger returns null when designated player has no score", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: null },
  ];
  const result = computeLoneRanger(players, "p2");
  assert.equal(result.teamGrossScore, null);
});

test("computeFormatScore supports lone_ranger via rotating designation", () => {
  const result = computeFormatScore("lone_ranger", samplePlayers, 1, 4, {
    designatedPlayerId: "p2",
  });
  assert.ok(result);
  // p2 scores 5, best of rest is p1 with 4
  assert.equal(result?.teamGrossScore, 9);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cha Cha Cha
// ─────────────────────────────────────────────────────────────────────────────

test("computeChaChaCha counts 1 best on hole 1, 2 on hole 2, 3 on hole 3", () => {
  // Hole 1: count 1 best => 4
  const r1 = computeChaChaCha(samplePlayers, 1);
  assert.equal(r1.teamGrossScore, 4);
  assert.equal(r1.countedPlayerIds.length, 1);

  // Hole 2: count 2 best => 4 + 5 = 9
  const r2 = computeChaChaCha(samplePlayers, 2);
  assert.equal(r2.teamGrossScore, 9);
  assert.equal(r2.countedPlayerIds.length, 2);

  // Hole 3: count 3 best => 4 + 5 + 6 = 15
  const r3 = computeChaChaCha(samplePlayers, 3);
  assert.equal(r3.teamGrossScore, 15);
  assert.equal(r3.countedPlayerIds.length, 3);
});

test("computeChaChaCha repeats the pattern on holes 4-6", () => {
  // Hole 4 = same as hole 1 (count 1)
  const r4 = computeChaChaCha(samplePlayers, 4);
  assert.equal(r4.teamGrossScore, 4);

  // Hole 5 = same as hole 2 (count 2)
  const r5 = computeChaChaCha(samplePlayers, 5);
  assert.equal(r5.teamGrossScore, 9);

  // Hole 6 = same as hole 3 (count 3)
  const r6 = computeChaChaCha(samplePlayers, 6);
  assert.equal(r6.teamGrossScore, 15);
});

test("computeFormatScore supports cha_cha_cha", () => {
  const result = computeFormatScore("cha_cha_cha", samplePlayers, 2, 4);
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 9); // hole 2 counts best 2
});

// ─────────────────────────────────────────────────────────────────────────────
// Shamble Team
// ─────────────────────────────────────────────────────────────────────────────

test("computeShamble counts best 2 scores by default", () => {
  const result = computeShamble(samplePlayers, "count_best_2");
  assert.equal(result.teamGrossScore, 9); // 4 + 5
  assert.equal(result.countedPlayerIds.length, 2);
});

test("computeShamble counts best 1 score", () => {
  const result = computeShamble(samplePlayers, "count_best_1");
  assert.equal(result.teamGrossScore, 4);
});

test("computeShamble counts all scores", () => {
  const result = computeShamble(samplePlayers, "count_all");
  assert.equal(result.teamGrossScore, 22); // 4 + 5 + 6 + 7
});

test("computeShamble tracks selected drive player", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 4, driveSelected: true },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: 6 },
    { playerId: "p4", playerName: "Four", grossScore: 7 },
  ];
  const result = computeShamble(players, "count_best_2");
  assert.equal(result.extraData.selectedDrivePlayerId, "p1");
});

test("computeFormatScore supports shamble_team with config", () => {
  const result = computeFormatScore(
    "shamble_team",
    samplePlayers,
    1,
    4,
    {},
    { shambleCountMode: "count_best_1" }
  );
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// Chicago Points Team
// ─────────────────────────────────────────────────────────────────────────────

test("computeChicagoPoints awards correct points relative to par", () => {
  assert.equal(computeChicagoPoints(1, 4), 8);  // double eagle (-3)
  assert.equal(computeChicagoPoints(2, 4), 4);  // eagle (-2)
  assert.equal(computeChicagoPoints(3, 4), 2);  // birdie (-1)
  assert.equal(computeChicagoPoints(4, 4), 1);  // par (0)
  assert.equal(computeChicagoPoints(5, 4), 0);  // bogey (+1)
  assert.equal(computeChicagoPoints(6, 4), 0);  // double bogey (+2)
});

test("computeChicagoTeamPoints sums all player points", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 3 },   // birdie = 2
    { playerId: "p2", playerName: "Two", grossScore: 4 },   // par = 1
    { playerId: "p3", playerName: "Three", grossScore: 5 }, // bogey = 0
    { playerId: "p4", playerName: "Four", grossScore: 2 },  // eagle = 4
  ];
  const result = computeChicagoTeamPoints(players, 4);
  assert.equal(result.totalPoints, 7); // 2 + 1 + 0 + 4
  assert.equal(result.playerPoints["p1"], 2);
  assert.equal(result.playerPoints["p4"], 4);
  assert.equal(result.playerPoints["p3"], 0);
});

test("computeChicagoTeamPoints handles null scores as zero points", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 3 },
    { playerId: "p2", playerName: "Two", grossScore: null },
  ];
  const result = computeChicagoTeamPoints(players, 4);
  assert.equal(result.totalPoints, 2);
  assert.equal(result.playerPoints["p2"], 0);
});

test("computeFormatScore supports chicago_points_team", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 3 },   // birdie = 2
    { playerId: "p2", playerName: "Two", grossScore: 4 },   // par = 1
  ];
  const result = computeFormatScore("chicago_points_team", players, 1, 4);
  assert.ok(result);
  assert.equal(result?.teamGrossScore, 3); // 2 + 1
  assert.equal(result?.teamDisplayScore, "3");
});

// ─────────────────────────────────────────────────────────────────────────────
// Wolf Team (direct function)
// ─────────────────────────────────────────────────────────────────────────────

test("computeWolfTeam wolf wins when wolf side has lower best ball", () => {
  const result = computeWolfTeam(samplePlayers, "p1", "p2");
  // Wolf side: p1(4), p2(5) => best = 4
  // Field side: p3(6), p4(7) => best = 6
  // Wolf wins => +1
  assert.equal(result.result, "wolf");
  assert.equal(result.holePoints, 1);
  assert.equal(result.teamGrossScore, 1);
});

test("computeWolfTeam field wins when field has lower best ball", () => {
  const result = computeWolfTeam(samplePlayers, "p4", "p3");
  // Wolf side: p4(7), p3(6) => best = 6
  // Field side: p1(4), p2(5) => best = 4
  // Field wins => -1
  assert.equal(result.result, "field");
  assert.equal(result.holePoints, -1);
  assert.equal(result.teamGrossScore, -1);
});

test("computeWolfTeam lone wolf doubles the stakes", () => {
  const result = computeWolfTeam(samplePlayers, "p1", null);
  // Wolf side: p1(4) => best = 4
  // Field side: p2(5), p3(6), p4(7) => best = 5
  // Lone wolf wins => +2
  assert.equal(result.result, "wolf");
  assert.equal(result.holePoints, 2);
});

test("computeWolfTeam lone wolf loses at double stakes", () => {
  const result = computeWolfTeam(samplePlayers, "p4", null);
  // Wolf side: p4(7) => best = 7
  // Field side: p1(4), p2(5), p3(6) => best = 4
  // Lone wolf loses => -2
  assert.equal(result.result, "field");
  assert.equal(result.holePoints, -2);
});

test("computeWolfTeam tie when best balls match", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: 4 },
    { playerId: "p4", playerName: "Four", grossScore: 6 },
  ];
  const result = computeWolfTeam(players, "p1", "p2");
  // Wolf side: p1(4), p2(5) => best = 4
  // Field side: p3(4), p4(6) => best = 4
  assert.equal(result.result, "tie");
  assert.equal(result.holePoints, 0);
});

test("computeWolfTeam returns incomplete when wolf has no score", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: null },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: 6 },
    { playerId: "p4", playerName: "Four", grossScore: 7 },
  ];
  const result = computeWolfTeam(players, "p1", "p2");
  assert.equal(result.result, "incomplete");
  assert.equal(result.teamGrossScore, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Vegas (direct function)
// ─────────────────────────────────────────────────────────────────────────────

test("computeVegas calculates correct team numbers and point differential", () => {
  const result = computeVegas([3, 5], [4, 6], 4);
  // Team 1: 35, Team 2: 46 => diff = 11
  assert.equal(result.team1Number, 35);
  assert.equal(result.team2Number, 46);
  assert.equal(result.holePoints, 11);
  assert.equal(result.winner, "team1");
});

test("computeVegas birdie flip reverses opponent digits", () => {
  const result = computeVegas([3, 5], [4, 6], 4, { enableBirdieFlip: true });
  // Team 1 has a 3 (under par 4) => flip team 2's digits: 64 instead of 46
  assert.equal(result.team1Number, 35);
  assert.equal(result.team2Number, 64);
  assert.equal(result.holePoints, 29);
});

test("computeVegasTeamNumber forms two-digit number from best two scores", () => {
  const result = computeVegasTeamNumber(samplePlayers.slice(0, 2));
  assert.equal(result.teamGrossScore, 45);
  assert.equal(result.teamDisplayScore, "45");
});

// ─────────────────────────────────────────────────────────────────────────────
// Money Ball (additional edge cases)
// ─────────────────────────────────────────────────────────────────────────────

test("computeMoneyBall with no penalty when ball is not lost", () => {
  const result = computeMoneyBall(samplePlayers, "p1", false, 4);
  assert.equal(result.teamGrossScore, 9); // p1(4) + best of rest p2(5)
  assert.equal(result.moneyBallPenalty, 0);
  assert.equal(result.moneyBallAdjustedScore, 4);
});

test("computeMoneyBall returns null when money ball player has no score", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: null },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
  ];
  const result = computeMoneyBall(players, "p1", false, 4);
  assert.equal(result.teamGrossScore, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Money Ball Round Totals
// ─────────────────────────────────────────────────────────────────────────────

test("computeMoneyBallRoundTotals accumulates scores and penalties", () => {
  const result = computeMoneyBallRoundTotals([
    { teamGrossScore: 9, moneyBallAdjustedScore: 4, moneyBallPenalty: 0, moneyBallLost: false },
    { teamGrossScore: 10, moneyBallAdjustedScore: 9, moneyBallPenalty: 4, moneyBallLost: true },
    { teamGrossScore: 8, moneyBallAdjustedScore: 3, moneyBallPenalty: 0, moneyBallLost: false },
  ]);
  assert.equal(result.teamCompetitionTotal, 27);
  assert.equal(result.moneyBallTotalScore, 16);
  assert.equal(result.moneyBallLossCount, 1);
  assert.equal(result.moneyBallPenaltyTotal, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// Irish Golf / 6-6-6 (full integration via computeFormatScore)
// ─────────────────────────────────────────────────────────────────────────────

test("computeFormatScore irish_golf_6_6_6 delegates to segment format", () => {
  const formatConfig = {
    segment1FormatId: "one_best_ball_of_four",
    segment2FormatId: "cha_cha_cha",
    segment3FormatId: "train_game",
  };

  // Hole 3 (segment 1): 1 best ball => 4
  const r1 = computeFormatScore("irish_golf_6_6_6", samplePlayers, 3, 4, {}, formatConfig);
  assert.ok(r1);
  assert.equal(r1?.teamGrossScore, 4);

  // Hole 8 (segment 2): cha cha cha, hole 8 => (8-1)%3+1 = 2 => count 2 best => 9
  const r2 = computeFormatScore("irish_golf_6_6_6", samplePlayers, 8, 4, {}, formatConfig);
  assert.ok(r2);
  assert.equal(r2?.teamGrossScore, 9);

  // Hole 15 (segment 3): train game => 456
  const r3 = computeFormatScore("irish_golf_6_6_6", samplePlayers, 15, 4, {}, formatConfig);
  assert.ok(r3);
  assert.equal(r3?.teamGrossScore, 456);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases: scramble formats return null (team-level scoring)
// ─────────────────────────────────────────────────────────────────────────────

test("computeFormatScore returns null for team-level scramble formats", () => {
  assert.equal(computeFormatScore("scramble_rotating_drives", samplePlayers, 1, 4), null);
  assert.equal(computeFormatScore("step_aside_scramble", samplePlayers, 1, 4), null);
  assert.equal(computeFormatScore("default-sunday-church", samplePlayers, 1, 4), null);
});

test("computeFormatScore returns null for unknown format IDs", () => {
  assert.equal(computeFormatScore("nonexistent_format", samplePlayers, 1, 4), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases: null / empty players
// ─────────────────────────────────────────────────────────────────────────────

test("compute1BestBall returns null when all scores are null", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: null },
    { playerId: "p2", playerName: "Two", grossScore: null },
  ];
  const result = compute1BestBall(players);
  assert.equal(result.teamGrossScore, null);
});

test("computeTrainGame returns null when fewer than three valid scores", () => {
  const players: PlayerInput[] = [
    { playerId: "p1", playerName: "One", grossScore: 4 },
    { playerId: "p2", playerName: "Two", grossScore: 5 },
    { playerId: "p3", playerName: "Three", grossScore: null },
    { playerId: "p4", playerName: "Four", grossScore: null },
  ];
  const result = computeTrainGame(players);
  assert.equal(result.teamGrossScore, null);
  assert.equal(result.trainNumber, null);
});
