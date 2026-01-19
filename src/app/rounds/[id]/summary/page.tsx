"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRound, deleteRound } from "@/actions/rounds";
import { getTopTeamHistory } from "@/actions/season-stats";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { ConfirmModal } from "@/components/modal";
import { getScoringOrder } from "@/lib/scoring-engine";
interface Team {
  id: string;
  teamNumber: number;
  totalPayout: number;
  isTopPayingTeam: boolean;
  roundPlayers: {
    id: string;
    playerId: string;
    player: { fullName: string; nickname: string | null };
  }[];
}

interface HoleScore {
  teamId: string;
  holeNumber: number;
  entryType: string;
  value: number | null;
  wasEdited: boolean;
}

interface HoleResult {
  holeNumber: number;
  winnerTeamId: string | null;
  isTie: boolean;
  holePayout: number;
}

interface Round {
  id: string;
  date: Date;
  status: string;
  startingHole: number | null;
  buyInPerPlayer: number;
  pot: number | null;
  baseSkinValue: number | null;
  tiebreakerTeamId: string | null;
  tiebreakerHoleNum: number | null;
  tiebreakerSkinsWon: number | null;
  course: {
    name: string;
    holes: { holeNumber: number; par: number }[];
  };
  format: { name: string };
  teams: Team[];
  roundPlayers: {
    id: string;
    playerId: string;
    payoutAmount: number;
    wasOnTopPayingTeam: boolean;
    player: { fullName: string; nickname: string | null };
  }[];
  holeScores: HoleScore[];
  holeResults: HoleResult[];
}

export default function RoundSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [topTeamHistories, setTopTeamHistories] = useState<
    { teamId: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRound();
  }, [id]);

  async function loadRound() {
    const data = await getRound(id);
    if (!data) {
      router.push("/");
      return;
    }

    if (data.status === "DRAFT") {
      router.push(`/rounds/${id}/setup`);
      return;
    }

    if (data.status === "LIVE") {
      router.push(`/rounds/${id}/scoring`);
      return;
    }

    setRound(data as Round);

    // Get top team histories
    const topTeams = data.teams.filter((t) => t.isTopPayingTeam);
    const histories = await Promise.all(
      topTeams.map(async (team) => {
        const playerIds = team.roundPlayers.map((rp) => rp.playerId);
        const count = await getTopTeamHistory(playerIds);
        return { teamId: team.id, count };
      })
    );
    setTopTeamHistories(histories);
    setLoading(false);
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRound(id);
      router.push("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete round");
      setDeleting(false);
    }
  };

  if (loading || !round) {
    return <p className="text-center py-8">Loading...</p>;
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const scoringOrder = getScoringOrder(round.startingHole ?? 1);
  const topTeams = round.teams.filter((t) => t.isTopPayingTeam);

  const holeResultsMap = new Map(
    round.holeResults.map((hr) => [hr.holeNumber, hr])
  );

  const holeScoresMap = new Map<string, HoleScore>();
  round.holeScores.forEach((hs) => {
    holeScoresMap.set(`${hs.teamId}-${hs.holeNumber}`, hs);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Round Summary</h1>
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
          <Link href="/">
            <Button variant="secondary" size="sm">
              Back
            </Button>
          </Link>
        </div>
      </div>

      {/* Round Info */}
      <Card>
        <CardContent>
          <h2 className="font-bold text-lg">{formatDate(round.date)}</h2>
          <p className="text-gray-600">{round.course.name}</p>
          <p className="text-gray-600">{round.format.name}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span>
              <strong>{round.roundPlayers.length}</strong> players
            </span>
            <span>
              <strong>${round.buyInPerPlayer}</strong> buy-in
            </span>
            <span>
              <strong>${round.pot ?? 0}</strong> pot
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top Paying Team(s) */}
      {topTeams.length > 0 && (
        <Card className="border-2 border-yellow-400 bg-yellow-50">
          <CardHeader>Top Paying Team(s)</CardHeader>
          <CardContent className="space-y-4">
            {topTeams.map((team) => {
              const history = topTeamHistories.find(
                (h) => h.teamId === team.id
              );
              return (
                <div key={team.id} className="border-b last:border-b-0 pb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Team {team.teamNumber}</span>
                    <span className="text-green-600 font-bold text-lg">
                      ${Math.round(team.totalPayout)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {team.roundPlayers
                      .map((rp) => rp.player.nickname || rp.player.fullName)
                      .join(", ")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Times this exact team has played together:{" "}
                    {history?.count ?? 1}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Team Payouts */}
      <Card>
        <CardHeader>Team Payouts</CardHeader>
        <CardContent>
          <div className="space-y-3">
            {round.teams
              .sort((a, b) => b.totalPayout - a.totalPayout)
              .map((team) => (
                <div
                  key={team.id}
                  className="flex justify-between items-center py-2 border-b last:border-b-0"
                >
                  <div>
                    <span className="font-medium">Team {team.teamNumber}</span>
                    <p className="text-sm text-gray-600">
                      {team.roundPlayers
                        .map((rp) => rp.player.nickname || rp.player.fullName)
                        .join(", ")}
                    </p>
                  </div>
                  <span
                    className={`font-bold ${
                      team.isTopPayingTeam ? "text-green-600" : ""
                    }`}
                  >
                    ${Math.round(team.totalPayout)}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Player Payouts */}
      <Card>
        <CardHeader>Player Payouts</CardHeader>
        <CardContent>
          <div className="space-y-2">
            {round.roundPlayers
              .sort((a, b) => b.payoutAmount - a.payoutAmount)
              .map((rp) => (
                <div
                  key={rp.id}
                  className="flex justify-between items-center py-1"
                >
                  <span>{rp.player.nickname || rp.player.fullName}</span>
                  <span
                    className={`font-medium ${
                      rp.wasOnTopPayingTeam ? "text-green-600" : ""
                    }`}
                  >
                    ${Math.round(rp.payoutAmount)}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Hole-by-Hole Results */}
      <Card>
        <CardHeader>Hole-by-Hole Results</CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Hole</th>
                  {round.teams.map((team) => (
                    <th key={team.id} className="py-2 text-center">
                      T{team.teamNumber}
                    </th>
                  ))}
                  <th className="py-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {scoringOrder.map((holeNumber) => {
                  const result = holeResultsMap.get(holeNumber);
                  const holeInfo = round.course.holes.find(
                    (h) => h.holeNumber === holeNumber
                  );

                  return (
                    <tr key={holeNumber} className="border-b">
                      <td className="py-2">
                        <span className="font-medium">{holeNumber}</span>
                        <span className="text-gray-400 text-xs ml-1">
                          P{holeInfo?.par}
                        </span>
                      </td>
                      {round.teams.map((team) => {
                        const score = holeScoresMap.get(
                          `${team.id}-${holeNumber}`
                        );
                        const isWinner = result?.winnerTeamId === team.id;

                        return (
                          <td
                            key={team.id}
                            className={`py-2 text-center ${
                              isWinner ? "font-bold text-green-600" : ""
                            } ${score?.wasEdited ? "text-red-600" : ""}`}
                          >
                            {score?.entryType === "X"
                              ? "X"
                              : score?.entryType === "VALUE"
                              ? score.value
                              : "-"}
                          </td>
                        );
                      })}
                      <td className="py-2 text-right text-xs">
                        {result?.isTie ? (
                          <span className="text-gray-500">Carry</span>
                        ) : result?.winnerTeamId ? (
                          <span className="text-green-600">
                            T
                            {
                              round.teams.find(
                                (t) => t.id === result.winnerTeamId
                              )?.teamNumber
                            }{" "}
                            ${Math.round(result.holePayout)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Red values indicate edited scores
          </p>
        </CardContent>
      </Card>

      {/* Tiebreaker Result */}
      {round.tiebreakerSkinsWon && round.tiebreakerSkinsWon > 0 && (
        <Card className="border-2 border-purple-400 bg-purple-50">
          <CardHeader>Carryover Tiebreaker</CardHeader>
          <CardContent>
            <p className="text-sm">
              <strong>{round.tiebreakerSkinsWon} skins</strong> were carried over
              at the end of the round.
            </p>
            {round.tiebreakerTeamId ? (
              <p className="text-sm mt-2">
                <span className="text-purple-700 font-bold">
                  Team{" "}
                  {round.teams.find((t) => t.id === round.tiebreakerTeamId)
                    ?.teamNumber}
                </span>{" "}
                won the tiebreaker on{" "}
                <strong>Hole {round.tiebreakerHoleNum}</strong> (handicap rank
                tiebreaker) and received{" "}
                <span className="text-green-600 font-bold">
                  $
                  {Math.round(
                    round.tiebreakerSkinsWon * (round.baseSkinValue ?? 0)
                  )}
                </span>
              </p>
            ) : (
              <p className="text-sm mt-2 text-gray-600">
                No single winner could be determined by handicap rank.{" "}
                <strong>
                  $
                  {Math.round(
                    round.tiebreakerSkinsWon * (round.baseSkinValue ?? 0)
                  )}
                </strong>{" "}
                was split evenly among all teams.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Round"
        message="Are you sure you want to delete this round? This will also remove the stats from the leaderboard. This cannot be undone."
        confirmText={deleting ? "Deleting..." : "Delete Round"}
        confirmVariant="danger"
      />
    </div>
  );
}
