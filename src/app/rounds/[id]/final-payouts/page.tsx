"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRound } from "@/actions/rounds";
import { Card, CardContent, CardHeader } from "@/components/card";
import { Button } from "@/components/button";

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
  course: { name: string };
  format: { name: string };
  roundPlayers: RoundPlayer[];
}

export default function FinalPayoutsPage({
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
    return <p className="py-8 text-center">Loading final payouts...</p>;
  }

  const sortedPlayers = [...round.roundPlayers].sort(
    (a, b) => b.payoutAmount - a.payoutAmount
  );
  const totalPaidOut = sortedPlayers.reduce(
    (sum, roundPlayer) => sum + Math.max(0, roundPlayer.payoutAmount),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Final Payout List</h1>
          <p className="text-sm text-gray-600">
            These are the final amounts to pay each player for the full day.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/rounds/${id}/payouts`}>
            <Button variant="secondary">Detailed Payouts</Button>
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
              <span className="text-gray-500">Players paid:</span>{" "}
              <strong>{sortedPlayers.length}</strong>
            </p>
            <p>
              <span className="text-gray-500">Total paid out:</span>{" "}
              <strong>${totalPaidOut.toFixed(2)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Pay These Amounts</CardHeader>
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
                ${Math.max(0, roundPlayer.payoutAmount).toFixed(2)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
