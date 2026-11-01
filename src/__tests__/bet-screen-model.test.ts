import test from "node:test";
import assert from "node:assert/strict";
import { buildBetScoreRows, latestGroupScores } from "@/lib/bet-screen-model";
import { buildCrossMatchStandings } from "@/lib/cross-match-standings";
import { computeCrossFoursome66618GameSummaries, getCrossFoursome66618Pairings } from "@/lib/cross-foursome-66618";
const config={crossFoursome66618:{scoreMode:"best_net_ball",handicapMode:"full",foursomeA:{A1:"a",A2:"b",A3:"c",A4:"d"},foursomeB:{B1:"e",B2:"f",B3:"g",B4:"h"}}};
const handicaps=Object.fromEntries("abcdefgh".split("").map(id=>[id,18]));
const game=getCrossFoursome66618Pairings(config)[0];
test("score entry shows the active bet partner net beside own draft without needing a separate panel",()=>{
 const rows=buildBetScoreRows({inputs:[{playerId:"a",name:"Alex",grossScore:"5"}],game,names:{e:"Eddie"},saved:{e:4},handicaps,rank:1,netScoring:true,handicapMode:"full",hidden:false});
 assert.equal(rows[0].net,4); assert.equal(rows[0].partnerName,"Eddie"); assert.equal(rows[0].partnerNet,3); assert.equal(rows[0].bestNet,3);
});
test("a missing partner stays pending and cannot make the pair complete",()=>{
 const rows=buildBetScoreRows({inputs:[{playerId:"a",name:"Alex",grossScore:"5"}],game,names:{},saved:{},handicaps,rank:1,netScoring:true,handicapMode:"full",hidden:false});
 assert.equal(rows[0].partnerNet,null); assert.equal(rows[0].bestNet,null);
});
test("hidden scores never expose the remote partner even with a stale snapshot",()=>{
 const rows=buildBetScoreRows({inputs:[{playerId:"a",name:"Alex",grossScore:"5"}],game,names:{},saved:{e:4},handicaps,rank:1,netScoring:true,handicapMode:"full",hidden:true});
 assert.equal(rows[0].partnerNet,null); assert.equal(rows[0].bestNet,null);
});
test("the other group strip finds their latest saved hole without using own drafts",()=>{
 const summaries=computeCrossFoursome66618GameSummaries({formatConfig:config,playerHandicapIndexes:handicaps,courseHandicapRanks:{1:1,2:1},playerScores:[{playerId:"e",holeNumber:1,grossScore:4},{playerId:"e",holeNumber:2,grossScore:5},{playerId:"a",holeNumber:6,grossScore:4}]});
 const matches=buildCrossMatchStandings(summaries,{});
 const ahead=latestGroupScores(matches,["e","f","g","h"],1);
 assert.equal(ahead.holeNumber,2); assert.equal(ahead.scores.e,4); assert.equal(ahead.scores.f,null);
});
test("no other group scores remains empty instead of guessing a hole",()=>{
 assert.deepEqual(latestGroupScores([], ["e"], 1),{holeNumber:null,scores:{e:null}});
});
test("gross-mode group strip uses strokes without a handicap reduction",()=>{
 const summaries=computeCrossFoursome66618GameSummaries({formatConfig:config,playerHandicapIndexes:handicaps,courseHandicapRanks:{1:1},playerScores:[{playerId:"e",holeNumber:1,grossScore:5}]});
 assert.equal(latestGroupScores(buildCrossMatchStandings(summaries,{}),["e"],1,false).scores.e,5);
});
