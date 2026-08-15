"use client";

import { useEffect, useRef } from "react";

export interface YellowBallGridData {
  teams: Array<{
    teamId: string;
    teamNumber: number;
    label: string;
    players: string[];
  }>;
  holes: Array<{
    holeNumber: number;
    par: number;
    isTie: boolean;
    winnerTeamIds: string[];
    teamScores: Array<{
      teamId: string;
      yellowBall: {
        designatedPlayerName: string;
        yellowBallNetScore: number;
        scrambleGrossScore: number;
        combinedScore: number;
        handicapApplied: boolean;
      } | null;
    }>;
  }>;
}

export function SundayChurchYellowBallGrid({
  data,
  currentHole,
}: {
  data: YellowBallGridData;
  currentHole?: number | null;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const currentHeaderRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const header = currentHeaderRef.current;
    if (!grid || !header) return;

    const centeredLeft =
      header.offsetLeft - grid.clientWidth / 2 + header.clientWidth / 2;
    grid.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  }, [currentHole]);

  return (
    <div>
      <div
        ref={gridRef}
        data-testid="yellow-ball-score-grid"
        className="max-w-full overflow-x-auto border border-gray-300 bg-white"
      >
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-36 min-w-36 border-b border-r border-gray-300 bg-gray-900 px-3 py-2 text-left text-white">
                Team
              </th>
              {data.holes.map((hole) => (
                <th
                  key={hole.holeNumber}
                  ref={hole.holeNumber === currentHole ? currentHeaderRef : undefined}
                  className={`sticky top-0 z-20 w-24 min-w-24 border-b border-r border-gray-300 px-2 py-2 text-center ${
                    hole.holeNumber === currentHole
                      ? "bg-yellow-300 text-gray-950"
                      : "bg-gray-900 text-white"
                  }`}
                >
                  <span className="block font-bold">{hole.holeNumber}</span>
                  <span className="block text-xs font-normal">Par {hole.par}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team) => (
              <tr key={team.teamId}>
                <th className="sticky left-0 z-10 w-36 min-w-36 border-b border-r border-gray-300 bg-white px-3 py-3 text-left align-top">
                  <span className="block font-bold text-gray-900">{team.label}</span>
                  <span className="mt-1 block text-xs font-normal leading-4 text-gray-500">
                    {team.players.join(", ")}
                  </span>
                </th>
                {data.holes.map((hole) => {
                  const score = hole.teamScores.find(
                    (teamScore) => teamScore.teamId === team.teamId
                  )?.yellowBall;
                  const winner =
                    !hole.isTie && hole.winnerTeamIds.includes(team.teamId);
                  return (
                    <td
                      key={`${team.teamId}-${hole.holeNumber}`}
                      data-testid={`yellow-ball-cell-${team.teamId}-${hole.holeNumber}`}
                      className={`w-24 min-w-24 border-b border-r border-gray-300 px-2 py-3 text-center align-top ${
                        hole.holeNumber === currentHole
                          ? "bg-yellow-50"
                          : winner
                            ? "bg-green-50"
                            : "bg-white"
                      }`}
                    >
                      {score ? (
                        <>
                          <strong className="block text-lg text-gray-950">
                            {score.combinedScore}{score.handicapApplied ? "•" : ""}
                          </strong>
                          <span className="mt-1 block truncate text-xs font-medium text-gray-700" title={score.designatedPlayerName}>
                            {score.designatedPlayerName}
                          </span>
                          <span className="block whitespace-nowrap text-xs text-gray-500">
                            {score.yellowBallNetScore} + Scr {score.scrambleGrossScore}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-600">
        • Handicap-adjusted team total. The yellow-ball player received handicap stroke credit. Team total = yellow-ball net + three-player scramble gross.
      </p>
    </div>
  );
}
