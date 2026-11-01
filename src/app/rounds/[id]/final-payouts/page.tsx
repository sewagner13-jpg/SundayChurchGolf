"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRound } from "@/actions/rounds";
import { getPlayerScores, type PlayerScoreRecord } from "@/actions/player-scores";
import { PlayerWinningsList } from "@/components/player-winnings-list";
import { buildPlayerWinnings, type WinningsRound } from "@/lib/player-winnings";

type Round = WinningsRound & { status: string; course: WinningsRound["course"] & { name: string } };

export default function FinalPayoutsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [scores, setScores] = useState<PlayerScoreRecord[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRound() {
      try {
        const data = await getRound(id);
        if (!active) return;
        if (!data) { router.push("/"); return; }
        if (data.status !== "FINISHED") { router.push(`/rounds/${id}/summary`); return; }
        const playerScores = await getPlayerScores(id);
        if (!active) return;
        setScores(playerScores);
        setRound(data as Round);
      } catch { if (active) setError(true); }
    }
    void loadRound();
    return () => { active = false; };
  }, [id, router]);

  if (error) return <p role="alert" className="py-8 text-center">Could not load winnings. Please refresh to try again.</p>;
  if (!round) return <p className="py-8 text-center">Loading winnings...</p>;

  const rows = buildPlayerWinnings(round, scores);
  const totalCents = rows.reduce((sum, player) => sum + player.totalCents, 0);
  const hasAdjustment = rows.some(player => player.items.some(item => item.kind === "adjustment"));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Money won</h1>
          <Link href="/" className="text-sm font-semibold text-green-800 underline">Home</Link>
        </div>
        <p className="text-sm text-gray-600">{round.course.name} · Round complete</p>
        <p className="text-sm text-gray-700">Each player’s bets and final amount to collect.</p>
        <Link href={`/rounds/${id}/scoreboard`} className="inline-flex min-h-11 items-center rounded-xl border border-green-200 bg-white px-4 text-sm font-semibold text-green-900">Full-day scoreboard</Link>
      </header>
      <PlayerWinningsList rows={rows} />
      <p className="flex justify-between border-t border-gray-200 pt-4 font-semibold text-gray-900"><span>Total won</span><span className="tabular-nums">${(totalCents / 100).toFixed(2)}</span></p>
      {hasAdjustment && <p className="text-xs text-amber-800">Recorded payout adjustments reconcile the available bet details to the saved final amounts. Check round details before paying any adjusted amount.</p>}
      <nav className="flex flex-wrap gap-x-5 gap-y-3 pb-4 text-sm font-semibold text-green-800" aria-label="Round details">
        <Link href={`/rounds/${id}/summary`} className="underline">Round details &amp; contest corrections</Link>
        <Link href={`/rounds/${id}/payouts`} className="underline">Detailed payout breakdown</Link>
      </nav>
    </div>
  );
}
