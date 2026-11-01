import type {CrossMatchStanding} from "./cross-match-standings";

/** Reuse the engine's saved player scores; overlapping bets count each hole once. */
export function dayPlayerRows(matches:CrossMatchStanding[],names:Record<string,string>,netScoring:boolean) {
 const players=new Map<string,(number|null)[]>();
 for(const match of matches) for(const hole of match.holes) for(const pair of hole.pairs) {
   pair.playerIds.forEach((id,index)=>{
     if(!id) return;
     const scores=players.get(id) ?? Array<number|null>(18).fill(null);
     const score=(netScoring ? pair.net[index] : pair.gross[index]) ?? null;
     if(hole.holeNumber>=1 && hole.holeNumber<=18) scores[hole.holeNumber-1]=score;
     players.set(id,scores);
   });
 }
 const subtotal=(scores:(number|null)[],required?:number)=>{
   const values=scores.filter((value):value is number=>value!==null && Number.isFinite(value));
   return !values.length || (required!==undefined && values.length!==required) ? null : values.reduce((sum,value)=>sum+value,0);
 };
 return [...players].map(([playerId,scores])=>({playerId,name:names[playerId] ?? "Player",scores,
   holesScored:scores.filter(score=>score!==null).length,front:subtotal(scores.slice(0,9),9),back:subtotal(scores.slice(9),9),total:subtotal(scores),
 })).sort((a,b)=>a.name.localeCompare(b.name));
}
