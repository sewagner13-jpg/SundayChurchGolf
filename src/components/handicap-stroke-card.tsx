import {
  getNetScore,
  getRelativePlayingHandicaps,
  getStrokesReceivedForHole,
} from "@/lib/handicap-scoring";

export interface HandicapStrokePlayer {
  playerId: string;
  name: string;
}

interface HandicapHole {
  holeNumber: number;
  handicapRank: number;
}

interface HandicapStrokeCardProps {
  players: HandicapStrokePlayer[];
  playerHandicapIndexes: Record<string, number | null | undefined>;
  holes: HandicapHole[];
  currentHole: number;
}

function formatStrokeCount(strokes: number | null) {
  if (strokes === null || strokes === 0) return "-";
  return strokes > 0 ? String(strokes) : `+${Math.abs(strokes)}`;
}

function formatCurrentHoleStrokes(strokes: number | null) {
  if (strokes === null) return "Handicap unavailable";
  if (strokes === 0) return "No shot";
  if (strokes < 0) {
    const count = Math.abs(strokes);
    return `Gives ${count} shot${count === 1 ? "" : "s"}`;
  }
  return `Gets ${strokes} shot${strokes === 1 ? "" : "s"}`;
}

export function HandicapStrokeCard({
  players,
  playerHandicapIndexes,
  holes,
  currentHole,
}: HandicapStrokeCardProps) {
  const relativeHandicaps = getRelativePlayingHandicaps(playerHandicapIndexes);

  return (
    <section className="mb-4 border-y border-emerald-200 bg-emerald-50 px-3 py-3">
      <div className="mb-3 space-y-2">
        <div>
          <h2 className="font-semibold text-emerald-950">Handicap Shots</h2>
          <p className="text-xs text-emerald-800">
            Lowest handicap plays from zero. No slope or tee adjustment.
          </p>
        </div>
        <p className="text-sm text-emerald-950">
          <strong>Enter gross score</strong>. The app calculates net.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-36 border border-emerald-200 bg-emerald-100 px-2 py-2 text-left">
                Player
              </th>
              {holes.map((hole) => (
                <th
                  key={hole.holeNumber}
                  aria-label={`Hole ${hole.holeNumber}${
                    hole.holeNumber === currentHole ? ", current hole" : ""
                  }`}
                  className={`w-9 border border-emerald-200 px-1 py-2 ${
                    hole.holeNumber === currentHole
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-100 text-emerald-950"
                  }`}
                >
                  {hole.holeNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.playerId}>
                <th className="sticky left-0 z-10 border border-emerald-200 bg-white px-2 py-2 text-left font-medium">
                  <span className="block">{player.name}</span>
                  <span className="block font-normal text-emerald-700">
                    HCP {playerHandicapIndexes[player.playerId] ?? "-"} / plays {relativeHandicaps[player.playerId] ?? "-"}
                  </span>
                </th>
                {holes.map((hole) => {
                  const strokes = getStrokesReceivedForHole(
                    relativeHandicaps[player.playerId],
                    hole.handicapRank
                  );
                  return (
                    <td
                      key={hole.holeNumber}
                      aria-label={`${player.name}, hole ${hole.holeNumber}: ${formatCurrentHoleStrokes(strokes)}`}
                      className={`border border-emerald-200 px-1 py-2 font-semibold ${
                        hole.holeNumber === currentHole ? "bg-emerald-200" : "bg-white"
                      }`}
                    >
                      {formatStrokeCount(strokes)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function HandicapPlayerScoreDetails({
  playerId,
  grossScore,
  playerHandicapIndexes,
  handicapRank,
}: {
  playerId: string;
  grossScore: string;
  playerHandicapIndexes: Record<string, number | null | undefined>;
  handicapRank: number;
}) {
  const relativeHandicap = getRelativePlayingHandicaps(playerHandicapIndexes)[playerId];
  const strokes = getStrokesReceivedForHole(relativeHandicap, handicapRank);
  const parsedGrossScore = Number.parseInt(grossScore, 10);
  const gross = Number.isFinite(parsedGrossScore) ? parsedGrossScore : null;
  const net = getNetScore({
    grossScore: gross,
    handicapIndex: relativeHandicap,
    handicapRank,
  });

  return (
    <div className="text-xs text-emerald-700">
      <p className="font-medium">{formatCurrentHoleStrokes(strokes)}</p>
      {gross !== null && net !== null && <p>Gross {gross} · Net {net}</p>}
    </div>
  );
}
