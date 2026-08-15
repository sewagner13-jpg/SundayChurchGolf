"use client";

import type { ReactNode } from "react";

import { SundayChurchYellowBallGrid } from "@/components/sunday-church-yellow-ball-grid";

export interface CombinedScoreboardHole {
  holeNumber: number;
  par: number;
  formatName: string | null;
  scoringMode: "skins" | "aggregate" | "match_play";
  isComplete: boolean;
  isTie: boolean;
  winnerTeamIds: string[];
  winnerLabel: string | null;
  teamScores: Array<{
    teamId: string;
    teamNumber: number;
    label: string;
    entryType: string | null;
    value: number | null;
    grossScore: number | null;
    displayScore: string | null;
    wasEdited: boolean;
    yellowBall: {
      designatedPlayerName: string;
      yellowBallNetScore: number;
      scrambleGrossScore: number;
      combinedScore: number;
      handicapApplied: boolean;
    } | null;
  }>;
}

export interface CombinedScoreboardData {
  teams: Array<{
    teamId: string;
    teamNumber: number;
    label: string;
    players: string[];
  }>;
  holes: CombinedScoreboardHole[];
}

function renderScore(teamScore: CombinedScoreboardHole["teamScores"][number]): ReactNode {
  if (teamScore.entryType === "X") return <span className="text-gray-500">X</span>;
  if (teamScore.displayScore) {
    return <span className="font-bold text-green-700">{teamScore.displayScore}</span>;
  }
  if (teamScore.entryType === "VALUE" && teamScore.grossScore !== null) {
    return <span className="font-bold text-green-700">{teamScore.grossScore}</span>;
  }
  if (teamScore.entryType === "VALUE" && teamScore.value !== null) {
    return <span className="font-bold text-green-700">+{teamScore.value}</span>;
  }
  return <span className="text-gray-300">-</span>;
}

export function CombinedScoreboardModal({
  data,
  currentHole,
  isYellowBall,
  onRefresh,
  onClose,
}: {
  data: CombinedScoreboardData;
  currentHole: number;
  isYellowBall: boolean;
  onRefresh: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-2 max-h-[88vh] w-full max-w-6xl overflow-hidden bg-white p-4 shadow-xl sm:mx-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Live Team Scoreboard</h2>
            <p className="text-xs text-gray-500">All teams and all holes</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onRefresh} className="bg-gray-100 px-3 py-2 text-xs font-medium">
              Refresh
            </button>
            <button type="button" onClick={onClose} className="bg-gray-100 px-3 py-2 text-xs font-medium">
              Close
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[74vh] overflow-y-auto">
          {isYellowBall ? (
            <SundayChurchYellowBallGrid data={data} currentHole={currentHole} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 text-left font-semibold">Hole</th>
                    {data.teams.map((team) => (
                      <th key={team.teamId} className="min-w-44 px-2 py-2 text-left font-semibold">
                        <span className="block">{team.label}</span>
                        <span className="block text-xs font-normal text-gray-500">{team.players.join(", ")}</span>
                      </th>
                    ))}
                    <th className="min-w-40 px-2 py-2 text-left font-semibold">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holes.map((hole) => (
                    <tr key={hole.holeNumber} className={`border-b ${currentHole === hole.holeNumber ? "bg-blue-50" : ""}`}>
                      <td className="px-2 py-3 align-top">
                        <strong>#{hole.holeNumber}</strong>
                        <span className="block text-xs text-gray-500">Par {hole.par}</span>
                      </td>
                      {data.teams.map((team) => {
                        const teamScore = hole.teamScores.find((score) => score.teamId === team.teamId);
                        const winner = !hole.isTie && hole.winnerTeamIds.includes(team.teamId);
                        return (
                          <td key={`${hole.holeNumber}-${team.teamId}`} className={`px-2 py-3 align-top ${winner ? "bg-green-50" : ""}`}>
                            <span className={teamScore?.wasEdited ? "italic text-red-500" : undefined}>
                              {teamScore ? renderScore(teamScore) : "-"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-3 align-top">
                        {!hole.isComplete ? (
                          <span className="text-gray-400">In progress</span>
                        ) : hole.isTie ? (
                          <span className="font-medium text-yellow-700">Tie</span>
                        ) : (
                          <span className="font-semibold text-green-700">{hole.winnerLabel}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
