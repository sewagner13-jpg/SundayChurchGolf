"use client";

import {useEffect,useState,type ReactNode} from "react";
import type {CrossMatchStanding} from "@/lib/cross-match-standings";
import type {CrossHoleGame} from "@/components/cross-hole-panel";
import {buildBetScoreRows,latestGroupScores} from "@/lib/bet-screen-model";

export interface BetScoringProps {
 roundId:string; holeNumber:number; startingHole:number; par:number;rank:number;courseName:string;
 groupLabel:string;otherGroupLabel:string;otherPlayerIds:string[];names:Record<string,string>;
 inputs:{playerId:string;name:string;grossScore:string}[];games:CrossHoleGame[];matches:CrossMatchStanding[];
 handicaps:Record<string,number|null|undefined>;handicapMode:"relative"|"full";netScoring:boolean;
 saved:Record<string,number|null|undefined>;hidden:boolean;snapshotError?:string|null;standingsError?:string|null;
 saving:boolean;blocked:boolean;error:string|null;canAdvance:boolean;first:boolean;last:boolean;
 hasAll18:boolean;teamFinished:boolean;allFinished:boolean;
 onInput:(id:string,gross:string)=>void;onSave:()=>Promise<unknown>;onRefresh:()=>void;
 onPrevious:()=>void;onNext:()=>void;onChangeGroup:()=>void;onDiscard:()=>Promise<unknown>;
 onMarkDone:()=>Promise<unknown>;onFinish:()=>Promise<unknown>;
 contest?:ReactNode;important?:ReactNode;tools?:ReactNode;
}

export function BetScoringScreen(props:BetScoringProps) {
 const [dirty,setDirty]=useState(false);
 const [notice,setNotice]=useState("");
 const [confirmFinish,setConfirmFinish]=useState(false);
 useEffect(()=>{setDirty(false);setNotice("");},[props.holeNumber,props.roundId]);
 const game=props.games.find(game=>game.holeNumbers.length===6 && game.holeNumbers.includes(props.holeNumber));
 const active=props.matches.find(match=>match.id===game?.id);
 const rows=buildBetScoreRows({...props,game,rank:props.rank,hidden:props.hidden || !!props.snapshotError});
 const ahead=latestGroupScores(props.matches,props.otherPlayerIds,props.startingHole,props.netScoring);
 const inactive=props.matches.filter(match=>match.id!==game?.id);
 const disabled=props.saving || props.blocked;
 const scoreLabel=props.netScoring ? "net" : "score";
 async function save() {
   setNotice("");
   if(await props.onSave()) {setDirty(false);setNotice("Scores saved");props.onRefresh();}
 }
 return <div className="space-y-6 text-black">
   <header className="pb-1">
     <div><p className="text-xs text-gray-700">{props.courseName} · {props.groupLabel}</p>
       <h1 className="text-2xl font-bold">Hole {props.holeNumber} <span className="text-base font-normal">· Par {props.par}</span></h1></div>
   </header>
   {props.important}
   <section aria-label="Other group" className="border-b border-gray-200 pb-5">
     <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-gray-700">Other group · {props.otherGroupLabel}</h2>
       <p className="text-xs text-gray-700">{props.hidden ? "Scores hidden by round settings" : props.standingsError ? "Refresh failed — scores unavailable" : ahead.holeNumber===null ? "No scores saved yet" : `Latest saved: hole ${ahead.holeNumber} · ${props.netScoring ? "Net" : "Gross"}`}</p></div>
       <button onClick={props.onRefresh} className="min-h-11 px-2 text-xs font-semibold text-green-800 underline underline-offset-4" aria-label="Refresh saved scores">Refresh</button></div>
     <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3" aria-label={props.netScoring ? "Other group net scores" : "Other group scores"}>{props.otherPlayerIds.map(id=><p key={id} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words font-semibold">{props.names[id]}</span><strong className="shrink-0 text-lg tabular-nums">{props.hidden || props.standingsError ? "—" : ahead.scores[id] ?? "—"}</strong></p>)}</div>
   </section>
   <section aria-label="Current six-hole bet" className="rounded-2xl border border-green-200 bg-white p-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{game?.label ?? "Current bet"}</h2><span className="text-sm">Holes {game?.holeNumbers[0]}–{game?.holeNumbers.at(-1)}</span></div>
     <p className="mt-3 break-words text-lg font-bold leading-snug">{props.hidden ? "Standings hidden" : props.standingsError ? "Standings unavailable — refresh to retry" : active?.status ?? "Waiting for saved scores"}</p>
     {!props.hidden && !props.standingsError && active && <details aria-label="Pair standings" className="mt-3 border-t border-gray-100"><summary className="min-h-11 cursor-pointer py-3 text-sm"><span className="font-semibold">Pair standings</span><span className="ml-2 text-xs text-gray-600">{active.completedHoles}/{active.totalHoles} settled</span></summary><div className="space-y-1">{active.pairs.map(pair=><p key={pair.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words font-semibold">{pair.label}</span><strong className="shrink-0">{pair.holesWon} won</strong></p>)}</div><p className="pb-2 pt-3 text-xs text-gray-600">All player scores are needed to award a hole.</p></details>}
   </section>
   <section aria-label="Enter this hole" className="space-y-4">
     <div className="pb-1"><h2 className="text-xl font-bold">Your group’s scores</h2><p className="mt-1 text-xs text-gray-600">Enter strokes · {props.netScoring ? "net calculated automatically" : "gross best ball"}</p></div>
     {props.snapshotError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">Partner scores could not refresh. Your entry is kept. Tap Refresh to retry.</p>}
     {rows.map(row=><section key={row.playerId} aria-label={`Score for ${row.name}`} className="rounded-2xl border border-gray-200 bg-white p-4">
       <div className="flex items-center justify-between gap-4"><div className="min-w-0"><h3 className="break-words text-lg font-bold leading-snug">{row.name}</h3><p className="mt-2 break-words text-sm text-gray-700">Partner: {row.partnerName}</p></div>
         <label className="shrink-0 text-center text-xs font-semibold">Strokes<input aria-label={`Strokes for ${row.name}`} inputMode="numeric" pattern="[0-9]*" value={row.grossScore} disabled={disabled}
           onChange={event=>{setDirty(true);setNotice("");props.onInput(row.playerId,event.target.value.replace(/\D/g,""));}}
           className="mt-1 block min-h-14 w-20 rounded-xl border-2 border-gray-400 px-2 text-center text-2xl font-bold focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100" /></label></div>
       <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4"><p className="text-xs text-gray-600">Your {scoreLabel} <strong className="mt-2 block text-2xl font-bold tabular-nums text-black">{row.net ?? "—"}</strong></p><p className="text-xs text-gray-600">Partner {scoreLabel} <strong className={`mt-2 block font-bold tabular-nums text-black ${row.partnerNet===null || props.hidden ? "text-base" : "text-2xl"}`}>{props.hidden ? "Hidden" : row.partnerNet ?? "Pending"}</strong></p><p className="text-xs text-gray-600">Pair best {scoreLabel} <strong className={`mt-2 block font-bold tabular-nums text-green-900 ${row.bestNet===null ? "text-base" : "text-2xl"}`}>{row.bestNet ?? "Pending"}</strong></p></div>
     </section>)}
     {props.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{props.error}</p>}
     <button onClick={()=>{void save();}} disabled={disabled} className="min-h-12 w-full rounded-xl bg-green-700 p-3 text-lg font-bold text-white disabled:opacity-50">{props.saving ? "Saving…" : "Save this hole"}</button>
     <p role="status" className="text-center text-sm font-semibold">{notice || (dirty ? "Unsaved changes" : "")}</p>
     {dirty && <button disabled={disabled} onClick={async()=>{if(await props.onDiscard()){setDirty(false);setNotice("");}else setNotice("Could not reload. Unsaved changes kept.");}} className="min-h-11 w-full text-sm underline">Discard unsaved changes</button>}
   </section>
   {props.contest}
   <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t bg-white py-3">
     <button onClick={props.onPrevious} disabled={disabled || props.first || dirty} className="min-h-12 rounded-xl border-2 border-gray-300 font-bold disabled:opacity-40">Previous hole</button>
     <button onClick={props.onNext} disabled={disabled || props.last || dirty || !props.canAdvance} className="min-h-12 rounded-xl bg-green-700 font-bold text-white disabled:opacity-40">Next hole</button>
   </div>
   {props.hasAll18 && !props.teamFinished && <button disabled={disabled || dirty} onClick={()=>{void props.onMarkDone();}} className="min-h-12 w-full rounded-xl bg-green-700 p-3 font-bold text-white">Mark our group done</button>}
   {props.teamFinished && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold">Your group is done. {props.allFinished ? "All groups are ready." : "Waiting for the other group."}</p>}
   {props.allFinished && <div className="rounded-xl border-2 border-green-700 p-3">{confirmFinish ? <><p className="mb-2 text-sm">Finalize the bets and open each player’s winnings?</p><button disabled={disabled || dirty} onClick={()=>{void props.onFinish();}} className="min-h-12 w-full rounded-lg bg-green-700 font-bold text-white disabled:opacity-40">Confirm finish & show winnings</button><button onClick={()=>setConfirmFinish(false)} className="min-h-11 w-full">Cancel</button></> : <button disabled={disabled || dirty} onClick={()=>setConfirmFinish(true)} className="min-h-12 w-full font-bold disabled:opacity-40">Finish round & show winnings</button>}</div>}
   <details className="rounded-xl border bg-white p-3"><summary className="min-h-11 cursor-pointer font-semibold">Other bets & group tools</summary>
     {inactive.map(match=><section key={match.id} className="mt-3 border-t pt-3"><h3 className="font-bold">{match.label}</h3><p className="mt-1 break-words text-sm">{match.status}</p><p className="text-xs text-gray-700">{match.completedHoles}/{match.totalHoles} holes settled</p></section>)}
     <button disabled={dirty || disabled} onClick={props.onChangeGroup} className="mt-3 min-h-11 w-full rounded-lg border font-semibold">Change scoring group</button>{props.tools}
   </details>
 </div>;
}
