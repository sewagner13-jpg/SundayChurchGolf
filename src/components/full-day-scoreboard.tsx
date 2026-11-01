import type {CrossMatchStanding} from "@/lib/cross-match-standings";
import {dayPlayerRows} from "@/lib/day-scoreboard";
import type {CombinedScoreboardData} from "./combined-scoreboard-modal";

interface Props {
 matches:CrossMatchStanding[];netScoring:boolean;names?:Record<string,string>;hidden?:boolean;
 teams?:CombinedScoreboardData;contests?:{holeNumber:number;label:string;winner:string|null}[];
}
const labelCell="sticky left-0 z-10 min-w-[9rem] max-w-[11rem] break-words bg-white px-3 py-3 text-left text-sm font-semibold text-black";
const holeCell="min-w-10 border-l border-gray-100 px-2 py-3 text-center text-sm tabular-nums";

export function FullDayScoreboard({matches,netScoring,names={},hidden=false,teams,contests=[]}:Props) {
 if(hidden) return <p role="status" className="rounded-xl border bg-gray-50 p-4">The full-day scores are hidden while this blind round is live.</p>;
 const players=dayPlayerRows(matches,names,netScoring);
 return <div className="min-w-0 space-y-8 text-black">
   {matches.length>0 && <section aria-label="All bets" className="space-y-5"><div><h2 className="text-xl font-bold">All bets</h2><p className="mt-1 text-sm text-gray-600">Every six-hole event and the full-round bet. Swipe each scorecard sideways to see more holes.</p></div>
     {matches.map(match=><article key={match.id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
       <header className="mb-4 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">{match.label}</h3><span className="text-xs text-gray-600">{match.completedHoles}/{match.totalHoles} settled</span></div><p className="break-words font-semibold">{match.status}</p></header>
       <div role="region" aria-label={`${match.label} scrollable scores`} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border border-gray-100">
         <table aria-label={`${match.label} best-ball scorecard`} className="w-full border-collapse" style={{minWidth:144+match.holeNumbers.length*40}}>
           <thead className="bg-gray-50"><tr><th scope="col" className={labelCell}>Pair · holes won</th>{match.holeNumbers.map(hole=><th key={hole} scope="col" className={holeCell}>{hole}</th>)}</tr></thead>
           <tbody>{match.pairs.map(pair=><tr key={pair.id} className="border-t border-gray-200"><th scope="row" className={labelCell}><span className="block">{pair.label}</span><span className="mt-1 block text-xs text-green-800">{pair.holesWon} won</span></th>{match.holes.map(hole=>{
             const score=hole.pairs.find(candidate=>candidate.id===pair.id);
             return <td key={hole.holeNumber} aria-label={`${pair.label}, hole ${hole.holeNumber}: ${score?.bestBall==null ? "Pending" : `${netScoring ? "net" : "gross"} ${score.bestBall}${score.won ? ", won hole" : !hole.complete ? ", provisional" : ""}`}`} className={`${holeCell} ${score?.won ? "bg-green-100 font-bold text-green-950" : ""}`}>{score?.bestBall==null ? "—" : <>{score.bestBall}{score.won ? "✓" : !hole.complete ? "*" : ""}</>}</td>;
           })}</tr>)}</tbody>
         </table>
       </div>
       <p className="mt-3 text-xs text-gray-600">{netScoring ? "Net" : "Gross"} best ball · ✓ hole won · * waiting for the other scores · two tie, all tie</p>
     </article>)}
   </section>}
   {players.length>0 && <section className="min-w-0 space-y-3"><h2 className="text-xl font-bold">Player scorecard · {netScoring ? "net" : "gross"}</h2>
     <div role="region" aria-label="Scrollable player scorecard" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border bg-white"><table aria-label={`Player ${netScoring ? "net" : "gross"} scorecard`} className="border-collapse" style={{minWidth:144+21*40}}>
       <thead className="bg-gray-50"><tr><th scope="col" className={labelCell}>Player</th>{Array.from({length:18},(_,index)=><th key={index} scope="col" className={holeCell}>{index+1}</th>)}{["Out","In","Total"].map(label=><th key={label} scope="col" className={holeCell}>{label}</th>)}</tr></thead>
       <tbody>{players.map(player=><tr key={player.playerId} className="border-t"><th scope="row" className={labelCell}><span className="block">{player.name}</span><span className="mt-1 block text-xs text-gray-600">{player.holesScored}/18 saved</span></th>{player.scores.map((score,index)=><td key={index} className={holeCell}>{score ?? "—"}</td>)}<td className={holeCell}>{player.front ?? "—"}</td><td className={holeCell}>{player.back ?? "—"}</td><td className={`${holeCell} font-bold`}>{player.total ?? "—"}{player.total!==null && player.holesScored<18 ? "*" : ""}</td></tr>)}</tbody>
     </table></div><p className="text-xs text-gray-600">* Running subtotal. Out and In appear when all nine scores are saved.</p>
   </section>}
   {teams && <section className="min-w-0 space-y-3"><h2 className="text-xl font-bold">All groups · all 18 holes</h2><div role="region" aria-label="Scrollable group scorecard" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border bg-white"><table aria-label="Full-day group scorecard" className="border-collapse" style={{minWidth:144+teams.holes.length*40}}><thead><tr><th className={labelCell} scope="col">Group</th>{teams.holes.map(hole=><th key={hole.holeNumber} scope="col" className={holeCell}>{hole.holeNumber}</th>)}</tr></thead><tbody>{teams.teams.map(team=><tr key={team.teamId} className="border-t"><th className={labelCell} scope="row">{team.label}</th>{teams.holes.map(hole=>{const score=hole.teamScores.find(score=>score.teamId===team.teamId);return <td key={hole.holeNumber} className={holeCell}>{score?.entryType==="X" ? "X" : score?.displayScore ?? (score?.entryType==="VALUE" ? score.grossScore ?? score.value ?? "—" : "—")}</td>;})}</tr>)}</tbody></table></div></section>}
   {contests.length>0 && <section className="space-y-3"><h2 className="text-xl font-bold">Hole contests</h2>{contests.map(contest=><div key={contest.holeNumber} className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-600">Hole {contest.holeNumber} · {contest.label}</p><p className="mt-2 font-bold">{contest.winner ?? "Winner not recorded"}</p></div>)}</section>}
 </div>;
}
