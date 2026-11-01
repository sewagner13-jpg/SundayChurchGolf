"use client";
import {useState} from "react";
import {BetScoringScreen} from "./bet-scoring-screen";
import {computeCrossFoursome66618GameSummaries,getCrossFoursome66618Pairings} from "@/lib/cross-foursome-66618";
import {buildCrossMatchStandings} from "@/lib/cross-match-standings";
const ids="abcdefgh".split("");
const names=Object.fromEntries(ids.map((id,i)=>[id,["Alex","Bill","Chris","Dave","Eddie","Fred","Griff","Harry"][i]]));
const config={crossFoursome66618:{scoreMode:"best_net_ball",handicapMode:"full",foursomeA:{A1:"a",A2:"b",A3:"c",A4:"d"},foursomeB:{B1:"e",B2:"f",B3:"g",B4:"h"}}};
const handicaps=Object.fromEntries(ids.map(id=>[id,18]));
const noop=async()=>{};
export function BetScoringFixture(){
 const [finished,setFinished]=useState(false);
 const [inputs,setInputs]=useState(ids.slice(0,4).map(playerId=>({playerId,name:names[playerId],grossScore:""})));
 const matches=buildCrossMatchStandings(computeCrossFoursome66618GameSummaries({formatConfig:config,playerHandicapIndexes:handicaps,courseHandicapRanks:{1:1,2:1},playerScores:ids.slice(4).flatMap(playerId=>[1,2].map(holeNumber=>({playerId,holeNumber,grossScore:4})))}),names);
 return <><BetScoringScreen roundId="fixture" holeNumber={1} startingHole={1} par={4} rank={1} courseName="Local fixture" groupLabel="A" otherGroupLabel="B" otherPlayerIds={ids.slice(4)} names={names}
 inputs={inputs} games={getCrossFoursome66618Pairings(config)} matches={matches} handicaps={handicaps} handicapMode="full" netScoring saved={{e:4,f:4,g:4,h:4}} hidden={false}
 saving={false} blocked={false} error={null} canAdvance first last={false} hasAll18={finished} teamFinished={finished} allFinished={finished}
 onInput={(id,grossScore)=>setInputs(previous=>previous.map(input=>input.playerId===id ? {...input,grossScore} : input))} onSave={async()=>true} onRefresh={()=>{}}
 onPrevious={()=>{}} onNext={()=>{}} onChangeGroup={()=>{}} onDiscard={async()=>false} onMarkDone={noop} onFinish={noop}/><button onClick={()=>setFinished(true)}>Simulate completed groups</button></>;
}
