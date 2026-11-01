import type { CrossFoursomeGameSummary } from "./cross-foursome-types";
import type { CrossThreesomeGameSummary } from "./cross-threesome-666";

export interface CrossMatchStanding {
  id: string;
  label: string;
  holeNumbers: number[];
  totalHoles: number;
  completedHoles: number;
  completed: boolean;
  status: string;
  pairs: {id: string; label: string; holesWon: number; leading: boolean}[];
  holes: {
    holeNumber: number;
    result: string;
    complete: boolean;
    pairs: {id: string; playerIds: string[]; label: string; bestBall: number | null; gross: (number | null)[]; net: (number | null)[]; won: boolean}[];
  }[];
}

/** Present engine results without recomputing winners or payouts. */
export function buildCrossMatchStandings(
  summaries: (CrossFoursomeGameSummary | CrossThreesomeGameSummary)[],
  names: Record<string, string>,
  hidden = false,
): CrossMatchStanding[] {
  if (hidden) return [];
  const name = (ids: readonly string[]) => ids.map(id => names[id] ?? "Unassigned player").join(" / ");
  return summaries.map(game => {
    const pairs = game.pairs.map(pair => ({id: pair.virtualTeamId, label:name(pair.playerIds),
      holesWon:pair.holesWon, leading:game.winningVirtualTeamIds.includes(pair.virtualTeamId)}));
    const leaders = pairs.filter(pair => pair.leading);
    const completed = game.completedHoles === game.holeNumbers.length;
    const wins = pairs.map(pair => pair.holesWon).sort((a,b)=>b-a);
    const margin = (wins[0] ?? 0) - (wins[1] ?? 0);
    const status = game.completedHoles === 0 ? "Not started" : leaders.length !== 1
      ? (completed ? "Match tied" : "Tied for the lead")
      : completed ? `${leaders[0].label} wins`
      : `${leaders[0].label} leads by ${margin} hole${margin===1 ? "" : "s"}`;
    return {id:game.id,label:game.label,holeNumbers:game.holeNumbers,totalHoles:game.holeNumbers.length,
      completedHoles:game.completedHoles,completed,status,pairs,
      holes:game.holeOutcomes.map(hole => ({holeNumber:hole.holeNumber,complete:hole.isComplete,
        result:!hole.isComplete ? "Waiting for all players" : hole.isTie ? "Tied hole — no winner"
          : `${pairs.find(pair=>pair.id===hole.winningVirtualTeamId)?.label ?? "Pair"} wins`,
        pairs:hole.pairScores.map(pair=>({id:pair.virtualTeamId,playerIds:[...pair.playerIds],label:name(pair.playerIds),
          bestBall:pair.grossScores.every(score=>score!==null) ? pair.bestBallScore : null,
          gross:pair.grossScores,net:pair.netScores,won:hole.isComplete && hole.winningVirtualTeamId===pair.virtualTeamId})),
      })),
    };
  });
}
