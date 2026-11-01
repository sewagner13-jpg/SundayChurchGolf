import { getNetScore, getPlayingHandicaps } from "./handicap-scoring";
import { getScoringOrder } from "./scoring-order";
import type { CrossHoleGame } from "../components/cross-hole-panel";
import type { CrossMatchStanding } from "./cross-match-standings";

export function buildBetScoreRows({inputs,game,names,saved,handicaps,rank,netScoring,handicapMode,hidden}: {
 inputs:{playerId:string;name:string;grossScore:string}[]; game?:CrossHoleGame;
 names:Record<string,string>;saved:Record<string,number|null|undefined>;
 handicaps:Record<string,number|null|undefined>;rank:number;netScoring:boolean;handicapMode:"relative"|"full";hidden:boolean;
}) {
 const playing=getPlayingHandicaps(handicaps,handicapMode);
 const net=(id:string,gross:number|null|undefined)=>gross==null || !Number.isFinite(gross) || gross<=0 ? null
   : netScoring ? getNetScore({grossScore:gross,handicapIndex:playing[id],handicapRank:rank}) : gross;
 return inputs.map(input=>{
   const pair=game?.pairs.find(pair=>pair.playerIds.includes(input.playerId));
   const partnerId=pair?.playerIds.find(id=>id!==input.playerId);
   const own=net(input.playerId,input.grossScore.trim()==="" ? null : Number(input.grossScore));
   const partner=hidden || !partnerId ? null : net(partnerId,saved[partnerId]);
   return {...input,net:own,partnerId,partnerName:partnerId ? names[partnerId] ?? "Partner" : "No partner assigned",partnerNet:partner,
     bestNet:own===null || partner===null ? null : Math.min(own,partner)};
 });
}

export function latestGroupScores(matches:CrossMatchStanding[], playerIds:string[], startingHole:number, netScoring=true) {
 const scores=new Map<number,Record<string,number|null>>();
 for(const match of matches) for(const hole of match.holes) for(const pair of hole.pairs) {
   pair.playerIds.forEach((id,index)=>{
     if(!playerIds.includes(id)) return;
     const row=scores.get(hole.holeNumber) ?? {};
     row[id]=(netScoring ? pair.net[index] : pair.gross[index]) ?? null; scores.set(hole.holeNumber,row);
   });
 }
 const latest=getScoringOrder(startingHole).filter(hole=>Object.values(scores.get(hole) ?? {}).some(score=>score!==null)).at(-1) ?? null;
 return {holeNumber:latest,scores:Object.fromEntries(playerIds.map(id=>[id,latest===null ? null : scores.get(latest)?.[id] ?? null]))};
}
