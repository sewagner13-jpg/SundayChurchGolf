import assert from "node:assert/strict";
import test from "node:test";
import * as draw from "@/lib/cross-foursome-partner-draw";
import { getCrossFoursome66618Pairings, validateCrossFoursome66618Config, computeCrossFoursome66618GameSummaries } from "@/lib/cross-foursome-66618";

const config = {scoreMode:"best_ball", foursomeA:{A1:"a",A2:"b",A3:"c",A4:"d"}, foursomeB:{B1:"e",B2:"f",B3:"g",B4:"h"}};

test("partner draw is a permutation and rotates through every opposite-cart player once", () => {
  const order = draw.drawCrossFoursomePartners(() => 0);
  assert.deepEqual([...order].sort(), ["A1","A2","A3","A4"]);
  assert.notDeepEqual(order, ["A1","A2","A3","A4"]);
  const formatConfig = {crossFoursome66618:{...config,partnerOrder:order}};
  const games = getCrossFoursome66618Pairings(formatConfig);
  assert.equal(games[0].pairs[0].playerIds[1], "b");
  for (const blue of ["e","f","g","h"]) {
    assert.deepEqual(games.map(game=>game.pairs.find(pair=>pair.playerIds[0]===blue)!.playerIds[1]).sort(), ["a","b","c","d"]);
  }
  assert.deepEqual(getCrossFoursome66618Pairings(JSON.parse(JSON.stringify(formatConfig))), games);
});

test("malformed saved draws cannot be accepted as assignments", () => {
  const errors = validateCrossFoursome66618Config({crossFoursome66618:{...config,partnerOrder:["A1","A1","A3","A4"]}});
  assert.ok(errors.some(error=>error.includes("partner draw")));
});

test("all four net games use one best score, two-tie-all-tie, and no carry", () => {
  const formatConfig = {crossFoursome66618:{...config,scoreMode:"best_net_ball",handicapMode:"full"}};
  const ids = ["a","b","c","d","e","f","g","h"];
  for (const game of getCrossFoursome66618Pairings(formatConfig)) {
    const holes = game.holeNumbers.slice(0,2);
    const playerScores = holes.flatMap((holeNumber,index) => ids.map(playerId => ({
      playerId, holeNumber,
      grossScore: game.pairs[0].playerIds.includes(playerId) || (index === 0 && game.pairs[1].playerIds.includes(playerId)) ? 4 : 6,
    })));
    const result = computeCrossFoursome66618GameSummaries({
      formatConfig,playerScores,totalPot:400,
      playerHandicapIndexes:Object.fromEntries(ids.map(id=>[id,18])),
      courseHandicapRanks:Object.fromEntries(Array.from({length:18},(_,i)=>[i+1,i+1])),
    }).find(summary=>summary.id===game.id)!;
    assert.equal(result.holeOutcomes[0].isTie,true);
    assert.equal(result.holeOutcomes[0].winningVirtualTeamId,null);
    assert.equal(result.holeOutcomes[1].pairScores[0].bestBallScore,3);
    assert.equal(result.pairs[0].holesWon,1);
    assert.deepEqual(result.pairs.slice(1).map(pair=>pair.holesWon),[0,0,0]);
    assert.equal(result.pairs[0].payout,100);
  }
});
