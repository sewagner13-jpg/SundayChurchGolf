import test from "node:test";
import assert from "node:assert/strict";
import {dayPlayerRows} from "@/lib/day-scoreboard";
import {buildCrossMatchStandings} from "@/lib/cross-match-standings";
import {computeCrossFoursome66618GameSummaries} from "@/lib/cross-foursome-66618";
const ids="abcdefgh".split("");
const config={crossFoursome66618:{scoreMode:"best_net_ball",handicapMode:"full",foursomeA:{A1:"a",A2:"b",A3:"c",A4:"d"},foursomeB:{B1:"e",B2:"f",B3:"g",B4:"h"}}};
function matches(holes:number[]){return buildCrossMatchStandings(computeCrossFoursome66618GameSummaries({formatConfig:config,playerHandicapIndexes:Object.fromEntries(ids.map(id=>[id,18])),courseHandicapRanks:Object.fromEntries(Array.from({length:18},(_,i)=>[i+1,i+1])),playerScores:ids.flatMap(playerId=>holes.map(holeNumber=>({playerId,holeNumber,grossScore:5})))}),{});}
test("full-day player rows deduplicate overlapping six-hole and overall matches",()=>{
 const rows=dayPlayerRows(matches(Array.from({length:18},(_,i)=>i+1)),{a:"Alex"},true);
 assert.equal(rows.length,8);const alex=rows.find(row=>row.playerId==="a")!;
 assert.equal(alex.name,"Alex");assert.equal(alex.holesScored,18);assert.equal(alex.total,72);assert.equal(alex.front,36);assert.equal(alex.back,36);
});
test("partial scorecards retain missing holes and label a running subtotal",()=>{
 const row=dayPlayerRows(matches([1,2]),{},true)[0];
 assert.equal(row.holesScored,2);assert.equal(row.total,8);assert.equal(row.front,null);assert.equal(row.back,null);assert.equal(row.scores[2],null);
});
test("gross scorecards display stored strokes rather than net values",()=>{
 assert.equal(dayPlayerRows(matches([1]),{},false)[0].scores[0],5);
});
test("empty match data produces no invented player scores",()=>{assert.deepEqual(dayPlayerRows([],{},true),[]);});
