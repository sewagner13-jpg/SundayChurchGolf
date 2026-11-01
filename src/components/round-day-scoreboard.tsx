"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {getRound} from "@/actions/rounds";
import {getLiveLeaderboard,getAllTeamsScorecard,type LiveLeaderboardData} from "@/actions/scoring";
import {getCrossFoursome66618Config,CROSS_FOURSOME_66618_FORMAT_ID} from "@/lib/cross-foursome-66618";
import {CROSS_THREESOME_666_FORMAT_ID} from "@/lib/cross-threesome-666";
import {getActivePar3Contests,getPar3ContestConfig,PAR3_CONTEST_TYPE_OPTIONS} from "@/lib/par3-contests";
import {FullDayScoreboard} from "./full-day-scoreboard";
import type {CombinedScoreboardData} from "./combined-scoreboard-modal";
interface Round {id:string;status:string;visibility:string;formatId:string;format:{name:string};course:{name:string};formatConfig:Record<string,unknown>|null;roundPlayers:{playerId:string;player:{fullName:string;nickname:string|null}}[]}
interface Snapshot {round:Round;standings:LiveLeaderboardData|null;teams?:CombinedScoreboardData;updated:number}

/** This reader never writes a score or updates the editable scoring form. */
export function RoundDayScoreboard({roundId,embedded=false}:{roundId:string;embedded?:boolean}) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
 const refresh=useCallback(()=>setAttempt(value=>value+1),[]);
 useEffect(()=>{let active=true,busy=false,latestStatus="";
   async function load(){if(busy)return;busy=true;try{
     const found=await getRound(roundId);if(!found)throw new Error("Round not found");
     const round=found as Round;latestStatus=round.status;
     const cross=round.formatId===CROSS_FOURSOME_66618_FORMAT_ID || round.formatId===CROSS_THREESOME_666_FORMAT_ID;
     const [standings,teams]=round.status==="DRAFT" ? [null,undefined] : await Promise.all([getLiveLeaderboard(roundId),cross ? Promise.resolve(undefined) : getAllTeamsScorecard(roundId,null)]);
     if(active){setSnapshot({round,standings,teams:teams as CombinedScoreboardData|undefined,updated:Date.now()});setError(false);}
   }catch{if(active){setSnapshot(null);setError(true);}}finally{busy=false;}}
   void load();const timer=window.setInterval(()=>{if(latestStatus!=="FINISHED")void load();},10000);
   const focus=()=>{void load();};window.addEventListener("focus",focus);
   return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
 },[roundId,attempt]);
 if(error)return <div role="alert" className="space-y-3 rounded-xl border bg-white p-4"><p>Could not refresh the full-day scoreboard. Scores are hidden until refresh succeeds.</p><button onClick={refresh} className="min-h-11 rounded-lg border px-4 font-semibold">Retry scoreboard</button></div>;
 if(!snapshot)return <p role="status" className="py-8 text-center">Loading full-day scoreboard…</p>;
 const {round,standings,teams,updated}=snapshot;
 const names=Object.fromEntries(round.roundPlayers.map(player=>[player.playerId,player.player.nickname || player.player.fullName]));
 const netScoring=round.formatId===CROSS_THREESOME_666_FORMAT_ID || (round.formatId===CROSS_FOURSOME_66618_FORMAT_ID && getCrossFoursome66618Config(round.formatConfig).scoreMode==="best_net_ball");
 const config=getPar3ContestConfig(round.formatConfig);
 const contests=getActivePar3Contests(config).map(contest=>{const winner=config?.results?.find(result=>result.holeNumber===contest.holeNumber)?.winnerPlayerId;return {holeNumber:contest.holeNumber,label:PAR3_CONTEST_TYPE_OPTIONS.find(option=>option.value===contest.contestType)?.label ?? "Hole contest",winner:winner ? names[winner] ?? "Unassigned player" : null};});
 return <div className="min-w-0 space-y-6">
   <header className="space-y-3">{!embedded && <h1 className="text-2xl font-bold">Full-day scoreboard</h1>}<div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{round.course.name}</p><p className="text-sm text-gray-600">{round.format.name} · {round.status==="FINISHED" ? "Round complete" : round.status==="DRAFT" ? "Not started" : "Live"}</p><p className="mt-1 text-xs text-gray-600">Updated {new Date(updated).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}{round.status==="LIVE" ? " · refreshes every 10 seconds" : ""}</p></div><button onClick={refresh} className="min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold">Refresh scoreboard</button></div>
     <nav className="flex flex-wrap gap-3 text-sm font-semibold text-green-900" aria-label="Scoreboard navigation">{!embedded && <Link className="flex min-h-11 items-center rounded-lg border bg-white px-3" href={`/rounds/${roundId}/${round.status==="FINISHED" ? "final-payouts" : round.status==="DRAFT" ? "setup" : "scoring"}`}>{round.status==="FINISHED" ? "Money won" : "Back to round"}</Link>}{embedded && <Link className="flex min-h-11 items-center underline underline-offset-4" href={`/rounds/${roundId}/scoreboard`} target="_blank" rel="noreferrer">Open shareable scoreboard ↗</Link>}</nav>
   </header>
   {round.status==="DRAFT" ? <p>The round has not started yet.</p> : <FullDayScoreboard matches={standings?.matches ?? []} hidden={round.visibility==="BLIND" && round.status==="LIVE"} names={names} netScoring={netScoring} teams={teams} contests={contests}/>}
 </div>;
}
