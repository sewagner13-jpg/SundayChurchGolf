import test from "node:test";
import assert from "node:assert/strict";
import { computeCrossFoursome66618GameSummaries } from "@/lib/cross-foursome-66618";
import { computeCrossThreesome666GameSummaries } from "@/lib/cross-threesome-666";
import { buildCrossMatchStandings } from "@/lib/cross-match-standings";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
const names = Object.fromEntries(ids.map(id => [id, `Player ${id}`]));
const config = {crossFoursome66618: {scoreMode: "best_ball", foursomeA: {A1:"a", A2:"b", A3:"c", A4:"d"}, foursomeB:{B1:"e", B2:"f", B3:"g", B4:"h"}}};
function summaries(values: Record<string, number> = {}) {
  return computeCrossFoursome66618GameSummaries({formatConfig:config, totalPot:240,
    playerScores:Object.entries(values).map(([playerId,grossScore])=>({playerId,grossScore,holeNumber:1}))});
}
test("each game retains its own pairings and actual six/18-hole lengths", () => {
  const games = buildCrossMatchStandings(summaries(),names);
  assert.deepEqual(games.map(game=>game.totalHoles),[6,6,6,18]);
  assert.equal(games[0].pairs.length,4);
  assert.equal(games[0].status,"Not started");
  assert.equal(games[0].pairs[0].label,"Player e / Player a");
});
test("partial holes display pending without awarding a winner", () => {
  const game = buildCrossMatchStandings(summaries({a:3,b:5,c:5,d:5}),names)[0];
  assert.equal(game.completedHoles,0);
  assert.equal(game.holes[0].result,"Waiting for all players");
  assert.equal(game.holes[0].pairs[0].bestBall,null);
  assert.ok(game.pairs.every(pair=>pair.holesWon===0));
});
test("a completed unique winner leads by the difference in hole wins", () => {
  const game = buildCrossMatchStandings(summaries({a:3,b:5,c:5,d:5,e:4,f:5,g:5,h:5}),names)[0];
  assert.equal(game.completedHoles,1);
  assert.equal(game.status,"Player e / Player a leads by 1 hole");
  assert.equal(game.holes[0].result,"Player e / Player a wins");
  assert.equal(game.holes[0].pairs[0].bestBall,3);
});
test("two best balls tied mean all pairs tie the hole", () => {
  const game = buildCrossMatchStandings(summaries(Object.fromEntries(ids.map(id=>[id,4]))),names)[0];
  assert.equal(game.holes[0].result,"Tied hole — no winner");
  assert.equal(game.status,"Tied for the lead");
  assert.ok(game.pairs.every(pair=>pair.holesWon===0));
});
test("blind match view exposes no scores, names or standings", () => {
  assert.deepEqual(buildCrossMatchStandings(summaries({a:3}),names,true),[]);
});
test("completed matches show the engine winner and actual progress", () => {
  const values={a:3,b:5,c:5,d:5,e:4,f:5,g:5,h:5};
  const games=computeCrossFoursome66618GameSummaries({formatConfig:config,playerScores:Array.from({length:6},(_,index)=>Object.entries(values).map(([playerId,grossScore])=>({playerId,grossScore,holeNumber:index+1}))).flat()});
  const game=buildCrossMatchStandings(games,names)[0];
  assert.equal(game.completed,true);
  assert.equal(game.completedHoles,6);
  assert.equal(game.status,"Player e / Player a wins");
  assert.equal(game.pairs[0].holesWon,6);
});
test("net best balls and gross player scores stay distinct", () => {
  const games=computeCrossFoursome66618GameSummaries({formatConfig:{crossFoursome66618:{...config.crossFoursome66618,scoreMode:"best_net_ball",handicapMode:"full"}},playerHandicapIndexes:Object.fromEntries(ids.map(id=>[id,18])),courseHandicapRanks:{1:1},playerScores:ids.map(playerId=>({playerId,holeNumber:1,grossScore:5}))});
  const pair=buildCrossMatchStandings(games,names)[0].holes[0].pairs[0];
  assert.equal(pair.bestBall,4);
  assert.deepEqual(pair.gross,[5,5]);
  assert.deepEqual(pair.net,[4,4]);
});
test("the same presenter supports three-pair matches", () => {
  const games=computeCrossThreesome666GameSummaries({formatConfig:{crossThreesome666:{threesomeA:{A1:"a",A2:"b",A3:"c"},threesomeB:{B1:"e",B2:"f",B3:"g"}}},playerScores:[],playerHandicapIndexes:{},courseHandicapRanks:{}});
  assert.equal(buildCrossMatchStandings(games,names)[0].pairs.length,3);
});
