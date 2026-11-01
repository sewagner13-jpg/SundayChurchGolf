"use client";
import React, { useState } from "react";
import { getPlayingHandicaps, getStrokesReceivedForHole } from "@/lib/handicap-scoring";

export interface CrossHoleGame {
  id: string;
  label: string;
  holeNumbers: number[];
  pairs: { virtualTeamId: string; playerIds: readonly string[] }[];
}
export interface CrossHolePanelProps {
  holeNumber: number; par: number; handicapRank: number;
  netScoring: boolean; handicapMode: "relative" | "full";
  players: {playerId: string; name: string; group: string}[];
  ownPlayerIds: string[];
  handicapIndexes: Record<string, number | null | undefined>;
  grossScores: Record<string, number | null | undefined>;
  games: CrossHoleGame[];
  hidden: boolean; loading: boolean; error: string | null;
  lastUpdated: number | null; onRefresh: () => void;
}
function shotsLabel(shots: number | null) {
  if (shots === null) return "Handicap unavailable";
  if (shots === 0) return "No shots";
  return `${shots > 0 ? "Gets" : "Gives"} ${Math.abs(shots)} shot${Math.abs(shots) === 1 ? "" : "s"}`;
}
export function CrossHolePanel(props: CrossHolePanelProps) {
  const [selectedId, setSelectedId] = useState(props.ownPlayerIds[0] ?? "");
  const focusedId = props.ownPlayerIds.includes(selectedId) ? selectedId : props.ownPlayerIds[0];
  const handicaps = getPlayingHandicaps(props.handicapIndexes, props.handicapMode);
  const playerMap = new Map(props.players.map(player => [player.playerId, player]));
  const strokes = (id: string) => getStrokesReceivedForHole(handicaps[id], props.handicapRank);
  const score = (id: string) => {
    const gross = props.grossScores[id];
    if (props.hidden || !Number.isInteger(gross) || (gross ?? 0) <= 0) return null;
    const shots = strokes(id);
    return {gross: gross as number, net: shots === null ? null : (gross as number) - shots};
  };
  const games = [...props.games].sort((a,b) => Number(b.holeNumbers.includes(props.holeNumber))-Number(a.holeNumbers.includes(props.holeNumber)));
  return <section aria-label="Current hole partner scores" className="min-w-0 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
    <header><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Hole {props.holeNumber} · Par {props.par} · Stroke index {props.handicapRank}</p>
      <h2 className="mt-1 text-xl font-bold">Shots &amp; partners</h2>
      <p className="mt-1 text-sm">{props.netScoring ? "Enter gross. Net is calculated using locked round handicaps." : "Gross best-ball game. Handicaps do not affect scores."}</p>
    </header>
    <a href="#current-hole-score-entry" className="flex min-h-12 items-center justify-center rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">Enter this hole’s scores ↓</a>
    {props.netScoring && <div className="rounded-lg bg-white p-3"><h3 className="mb-2 text-sm font-semibold">Your group · shots on this hole</h3>
      <div className="grid grid-cols-2 gap-2">{props.ownPlayerIds.map(id=><div key={id} className="min-w-0 rounded-lg bg-emerald-50 p-2 text-sm"><span className="block break-words font-semibold text-black">{playerMap.get(id)?.name ?? "Unassigned player"}</span><strong className="mt-1 block">{shotsLabel(strokes(id))}</strong></div>)}</div>
    </div>}
    <label className="block text-sm font-semibold">Show partners for
      <select value={focusedId} onChange={event=>setSelectedId(event.target.value)} className="mt-2 min-h-12 min-w-0 w-full rounded-lg border border-emerald-300 bg-white px-3 text-base font-semibold text-black">
        {props.ownPlayerIds.map(id=><option key={id} value={id}>{playerMap.get(id)?.name ?? "Unassigned player"}</option>)}
      </select>
    </label>
    <div role="status" className="text-sm">{props.hidden ? "Scores hidden by this round’s visibility settings." : props.error ? "Refresh failed. Saved scores are hidden until refresh succeeds." : props.loading ? "Refreshing saved scores…" : props.lastUpdated ? `Updated ${new Date(props.lastUpdated).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"})} · refreshes every 10 seconds` : "Waiting for saved scores…"}</div>
    {!props.hidden && <button type="button" onClick={props.onRefresh} disabled={props.loading} className="min-h-12 rounded-lg border border-emerald-300 bg-white px-4 font-semibold disabled:opacity-50">Refresh scores</button>}
    <div className="space-y-3">{games.map(game=>{
      const active=game.holeNumbers.includes(props.holeNumber);
      const pair=game.pairs.find(pair=>pair.playerIds.includes(focusedId));
      if (!active) return <article key={game.id} className="rounded-lg border border-emerald-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{game.label}</h3><span className="text-sm text-gray-600">Holes {game.holeNumbers[0]}–{game.holeNumbers.at(-1)}</span></div>
        <p className="mt-2 text-sm">Partner: <strong className="break-words text-black">{pair?.playerIds.filter(id => id !== focusedId).map(id => playerMap.get(id)?.name ?? "Unassigned player").join(" / ") || "Assignment unavailable"}</strong></p>
      </article>;
      const values=pair?.playerIds.map(score) ?? [];
      const complete=values.length===2 && values.every(value=>value!==null && (!props.netScoring || value.net!==null));
      const best=complete ? Math.min(...values.map(value=>props.netScoring ? value!.net! : value!.gross)) : null;
      return <article key={game.id} className="rounded-lg border border-emerald-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{game.label}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-600"}`}>{active ? "Counts on this hole" : `Holes ${game.holeNumbers[0]}–${game.holeNumbers.at(-1)}`}</span></div>
        {!pair ? <p className="mt-2 text-sm">Partner assignment unavailable.</p> : pair.playerIds.map(id=>{
          const player=playerMap.get(id);const saved=score(id);
          return <div key={id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold text-black">{player?.name ?? "Unassigned player"}</p><p className="text-sm text-gray-600">{player?.group ?? "Group unavailable"}</p>{active && props.netScoring && <p className="mt-1 text-sm text-emerald-800">{shotsLabel(strokes(id))}</p>}</div>{active && <div className="shrink-0 text-right">{props.hidden ? <span className="text-sm text-gray-600">Scores hidden</span> : saved ? <><p className="text-sm">Gross {saved.gross}</p>{props.netScoring && <p className="text-2xl font-bold">{saved.net===null ? "Net pending" : `Net ${saved.net}`}</p>}</> : <span className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">Pending</span>}</div>}</div>;
        })}
        {active && !props.hidden && <p className="mt-3 border-t border-emerald-100 pt-3 text-sm font-semibold">{best===null ? "Waiting for both scores" : `Best ${props.netScoring ? "net " : "gross "}ball ${best} · hole result waits for all pairs`}</p>}
      </article>;
    })}</div>
    <p className="text-sm text-emerald-800">Saved scores only. Your unsaved entry stays in the score form below.</p>
  </section>;
}
