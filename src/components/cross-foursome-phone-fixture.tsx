"use client";

import { useState } from "react";
import { CrossHolePanel } from "@/components/cross-hole-panel";
import { CrossMatchStandings } from "@/components/cross-match-standings";
import { buildCrossMatchStandings } from "@/lib/cross-match-standings";
import { computeCrossFoursome66618GameSummaries, getCrossFoursome66618Pairings } from "@/lib/cross-foursome-66618";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
const names = ["Alex Long-Name Wagner", "Bill", "Chris", "Dave", "Eddie", "Fred", "Griff", "Harry"];
const formatConfig = { crossFoursome66618: {
  scoreMode: "best_net_ball", handicapMode: "full",
  foursomeA: { A1: "a", A2: "b", A3: "c", A4: "d" },
  foursomeB: { B1: "e", B2: "f", B3: "g", B4: "h" },
}};
const handicaps = Object.fromEntries(ids.map(id => [id, 18]));

/** Local browser fixture: saved records are simulated; production components and engine are real. */
export function CrossFoursomePhoneFixture() {
  const [holeNumber, setHoleNumber] = useState(1);
  const [draft, setDraft] = useState("5");
  const [saved, setSaved] = useState<Record<string, number>>({ a: 5, b: 6, c: 6, d: 6 });
  const [hidden, setHidden] = useState(false);
  const summaries = computeCrossFoursome66618GameSummaries({
    formatConfig, playerHandicapIndexes: handicaps, courseHandicapRanks: { [holeNumber]: 1 },
    playerScores: Object.entries(saved).map(([playerId, grossScore]) => ({playerId, grossScore, holeNumber})),
    totalPot: 240,
  });
  const outcome = summaries.find(game => game.holeNumbers.includes(holeNumber))!.holeOutcomes
    .find(hole => hole.holeNumber === holeNumber)!;
  return <main className="mx-auto max-w-lg space-y-4 p-4">
    <CrossHolePanel holeNumber={holeNumber} par={4} handicapRank={1} netScoring handicapMode="full"
      players={ids.map((playerId, index) => ({playerId, name: names[index], group: index < 4 ? "Red Cart" : "Blue Cart"}))}
      ownPlayerIds={ids.slice(0, 4)} handicapIndexes={handicaps} grossScores={saved}
      games={getCrossFoursome66618Pairings(formatConfig)} hidden={hidden} loading={false} error={null}
      lastUpdated={1} onRefresh={() => setSaved(previous => ({...previous, e: 4, f: 6, g: 6, h: 6}))} />
    <section id="current-hole-score-entry" className="space-y-3">
      <label className="block">Your unsaved gross
        <input aria-label="Your unsaved gross" inputMode="numeric" value={draft}
          onChange={event => setDraft(event.target.value)} className="min-h-12 w-full rounded border p-3 text-xl" />
      </label>
      <p role="status">{outcome.isComplete ? "All scores received" : "Waiting for all pairs"}</p>
      <button className="min-h-12 rounded border px-4" onClick={() => setHidden(!hidden)}>Toggle blind visibility</button>
      <button className="min-h-12 rounded border px-4" onClick={() => {setHoleNumber(7); setSaved({});}}>Next segment</button>
    </section>
    <CrossMatchStandings matches={buildCrossMatchStandings(summaries,Object.fromEntries(ids.map((id,index)=>[id,names[index]])),hidden)} currentHole={holeNumber} hidden={hidden} />
  </main>;
}
