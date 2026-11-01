import assert from "node:assert/strict";
import test from "node:test";
import { getStrokesReceivedForHole } from "@/lib/handicap-scoring";
import { createDefaultCrossFoursome66618Config, getCrossFoursome66618Config, computeCrossFoursome66618GameSummaries } from "@/lib/cross-foursome-66618";

test("legacy net games retain lowest-player-zero and full mode preserves all strokes", () => {
  const formatConfig = createDefaultCrossFoursome66618Config();
  const config = formatConfig.crossFoursome66618;
  config.scoreMode = "best_net_ball";
  Object.assign(config.foursomeA, {A1:"a", A2:"b", A3:"c", A4:"d"});
  Object.assign(config.foursomeB, {B1:"e", B2:"f", B3:"g", B4:"h"});
  const indexes = {a:6,b:8,c:10,d:12,e:14,f:16,g:20,h:24};
  const input = {formatConfig, playerScores:Object.keys(indexes).map(playerId=>({playerId,holeNumber:1,grossScore:5})), playerHandicapIndexes:indexes, courseHandicapRanks:{1:1}};
  assert.equal(computeCrossFoursome66618GameSummaries(input)[0].holeOutcomes[0].pairScores[0].strokesReceived[1], 0);
  Object.assign(config, {handicapMode:"full"});
  assert.equal(computeCrossFoursome66618GameSummaries(input)[0].holeOutcomes[0].pairScores[0].strokesReceived[1], 1);
  assert.equal((getCrossFoursome66618Config(formatConfig) as unknown as {handicapMode:string}).handicapMode, "full");
});

test("full plus handicaps give shots back on easiest holes and >18 distributes extra shots", () => {
  assert.equal(getStrokesReceivedForHole(-2, 1), 0);
  assert.equal(getStrokesReceivedForHole(-2, 17), -1);
  assert.equal(getStrokesReceivedForHole(-2, 18), -1);
  assert.equal(getStrokesReceivedForHole(20, 1), 2);
  assert.equal(getStrokesReceivedForHole(20, 3), 1);
  assert.equal(getStrokesReceivedForHole(-20, 18), -2);
  assert.equal(getStrokesReceivedForHole(-20, 1), -1);
});
