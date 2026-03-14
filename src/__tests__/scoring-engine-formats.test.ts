import test from "node:test";
import assert from "node:assert/strict";
import {
  compute1BestBall,
  compute2BestBalls,
  computeFormatScore,
  computeMoneyBall,
  computeTrainGame,
  computeVegasMatchRound,
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

test("compute1BestBall counts only the lowest gross score", () => {
  const result = compute1BestBall(samplePlayers);
  assert.equal(result.teamGrossScore, 4);
  assert.deepEqual(result.countedPlayerIds, ["p1"]);
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
