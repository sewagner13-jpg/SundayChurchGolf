"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRound } from "@/actions/rounds";
import { Card, CardContent, CardHeader } from "@/components/card";
import { Button } from "@/components/button";
import {
  getActivePar3Contests,
  getPar3ContestConfig,
  type Par3PayoutTarget,
} from "@/lib/par3-contests";
import { getTeamDisplayLabel } from "@/lib/team-labels";

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

interface RoundPlayer {
  id: string;
  playerId: string;
  payoutAmount: number;
  player: { fullName: string; nickname: string | null };
  team: { id: string; teamNumber: number } | null;
}

interface Round {
  id: string;
  date: Date;
  status: string;
  buyInPerPlayer: number;
  pot: number | null;
  formatConfig: Record<string, unknown> | null;
  course: { name: string };
  format: { name: string };
  teams: Team[];
  roundPlayers: RoundPlayer[];
}

export default function RoundPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRound();
  }, [id]);

  async function loadRound() {
    const data = await getRound(id);
    if (!data) {
      router.push("/");
      return;
    }

    if (data.status !== "FINISHED") {
      router.push(`/rounds/${id}/summary`);
      return;
    }

    setRound(data as Round);
    setLoading(false);
  }

  if (loading || !round) {
    return <p className="py-8 text-center">Loading payouts...</p>;
  }

  const sortedTeams = [...round.teams].sort((a, b) => b.totalPayout - a.totalPayout);
  const sortedPlayers = [...round.roundPlayers].sort(
    (a, b) => b.payoutAmount - a.payoutAmount
  );
  const totalTeamPayout = sortedTeams.reduce((sum, team) => sum + team.totalPayout, 0);
  const totalPlayerPayout = sortedPlayers.reduce(
    (sum, player) => sum + player.payoutAmount,
    0
  );
  const par3Config = getPar3ContestConfig(round.formatConfig);
  const activePar3Contests = getActivePar3Contests(par3Config);
  const par3Results = (par3Config?.results as
    | Array<{
        holeNumber: number;
        winnerPlayerId: string | null;
        payoutAmount?: number | null;
        payoutTarget?: Par3PayoutTarget;
      }>
    | undefined) ?? [];
  const par3ResultsMap = new Map(par3Results.map((result) => [result.holeNumber, result]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-sm text-gray-600">
            Final team and player totals for payout collection.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/rounds/${id}/summary`}>
            <Button variant="secondary">Back to Summary</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 text-sm text-gray-700">
          <div className="grid gap-2 md:grid-cols-4">
            <p>
              <span className="text-gray-500">Course:</span> {round.course.name}
            </p>
            <p>
              <span className="text-gray-500">Format:</span> {round.format.name}
            </p>
            <p>
              <span className="text-gray-500">Team payouts:</span>{" "}
              <strong>${totalTeamPayout.toFixed(2)}</strong>
            </p>
            <p>
              <span className="text-gray-500">Player payouts:</span>{" "}
              <strong>${totalPlayerPayout.toFixed(2)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Team Totals</CardHeader>
        <CardContent className="space-y-2">
          {sortedTeams.map((team, index) => (
            <div
              key={team.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-3 ${
                team.isTopPayingTeam
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold">
                  #{index + 1} {getTeamDisplayLabel(team.roundPlayers)}
                </p>
                <p className="text-xs text-gray-500">
                  {team.roundPlayers
                    .map((roundPlayer) => roundPlayer.player.nickname || roundPlayer.player.fullName)
                    .join(", ")}
                </p>
              </div>
              <p className="text-xl font-bold text-green-700">
                ${team.totalPayout.toFixed(2)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Player Totals</CardHeader>
        <CardContent className="space-y-2">
          {sortedPlayers.map((roundPlayer, index) => (
            <div
              key={roundPlayer.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3"
            >
              <div>
                <p className="font-semibold">
                  #{index + 1}{" "}
                  {roundPlayer.player.nickname || roundPlayer.player.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {roundPlayer.team
                    ? `Team ${roundPlayer.team.teamNumber}`
                    : "No team"}
                </p>
              </div>
              <p className="text-xl font-bold text-green-700">
                ${roundPlayer.payoutAmount.toFixed(2)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {activePar3Contests.length > 0 && (
        <Card>
          <CardHeader>Par 3 Distribution</CardHeader>
          <CardContent className="space-y-2">
            {activePar3Contests.map((contest) => {
              const result = par3ResultsMap.get(contest.holeNumber);
              const winner = round.roundPlayers.find(
                (roundPlayer) => roundPlayer.playerId === result?.winnerPlayerId
              );
              return (
                <div
                  key={contest.holeNumber}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3"
                >
                  <div>
                    <p className="font-medium">Hole {contest.holeNumber}</p>
                    <p className="text-xs text-gray-500">
                      {winner
                        ? winner.player.nickname || winner.player.fullName
                        : "No winner entered"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700">
                      ${(result?.payoutAmount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(result?.payoutTarget ?? contest.payoutTarget) === "TEAM"
                        ? "Shared with team"
                        : "Kept individually"}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
