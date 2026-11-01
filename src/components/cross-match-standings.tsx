"use client";

import type { CrossMatchStanding } from "@/lib/cross-match-standings";

export function CrossMatchStandings({matches, currentHole, hidden = false, netScoring = true}: {
  matches: CrossMatchStanding[]; currentHole?: number; hidden?: boolean; netScoring?: boolean;
}) {
  return <section aria-label="Individual matches" className="mt-4 min-w-0 space-y-4 text-black">
    <div><h3 className="text-lg font-bold">Individual matches</h3>
      <p className="text-sm text-gray-700">Saved scores · refreshes every 10 seconds · {netScoring ? "Net" : "Gross"} best ball</p></div>
    {hidden ? <p className="rounded-lg border bg-gray-50 p-3">Match scores are hidden by this round’s visibility settings.</p>
      : matches.map(match => <article key={match.id} aria-label={match.label} className="min-w-0 rounded-xl border-2 border-emerald-200 bg-white p-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className="text-lg font-bold">{match.label}</h4>
            <p className="text-sm text-gray-700">Holes {match.holeNumbers[0]}–{match.holeNumbers.at(-1)}</p></div>
          <span className="rounded bg-emerald-50 px-2 py-1 text-sm font-semibold">{match.completed ? "Complete" : currentHole && match.holeNumbers.includes(currentHole) ? "Playing now" : "Match"}</span>
        </header>
        <p className="mt-3 break-words rounded-lg bg-emerald-50 p-3 font-bold">{match.status}</p>
        <p className="mt-2 text-sm text-gray-700">{match.completedHoles}/{match.totalHoles} holes complete</p>
        <div className="mt-2 divide-y divide-gray-200">{match.pairs.map(pair => <div key={pair.id} className="flex min-w-0 items-center justify-between gap-3 py-3">
          <p className="min-w-0 break-words font-semibold text-black">{pair.label}</p>
          <div className="shrink-0 text-center"><strong className="block text-2xl">{pair.holesWon}</strong><span className="text-xs text-gray-700">holes won</span></div>
        </div>)}</div>
        <details className="mt-2 border-t border-gray-200">
          <summary className="min-h-12 cursor-pointer py-3 font-bold">Hole-by-hole scores</summary>
          <div className="space-y-3">{match.holes.map(hole => <section key={hole.holeNumber} aria-label={`${match.label}, hole ${hole.holeNumber}`} className={`rounded-lg border p-3 ${hole.holeNumber===currentHole ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
            <h5 className="font-bold">Hole {hole.holeNumber}</h5>
            <p className="mt-1 break-words text-sm font-semibold">{hole.result}</p>
            {hole.pairs.map(pair => <div key={pair.id} className="mt-3 border-t border-gray-200 pt-2 text-sm">
              <div className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words font-semibold text-black">{pair.label}{pair.won ? " ✓" : ""}</span>
                <strong className="shrink-0">{pair.bestBall===null ? "Pending" : `Best ball ${pair.bestBall}`}</strong></div>
              <p className="mt-1 text-xs text-gray-700">Gross {pair.gross.map(score=>score ?? "—").join(" / ")}{netScoring ? ` · Net ${pair.net.map(score=>score ?? "—").join(" / ")}` : ""}</p>
            </div>)}
          </section>)}</div>
        </details>
      </article>)}
    {!hidden && <p className="text-xs text-gray-700">Holes are awarded after every player’s score is saved. Two pairs tie the best ball, all pairs tie the hole.</p>}
  </section>;
}
