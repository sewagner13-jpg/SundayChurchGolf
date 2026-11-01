"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { retryBurgerWrite } from "@/lib/burger-orders";
import { changeLiveHoleContestWinner, liveContestConfig } from "@/lib/live-hole-contests";
import { getActivePar3Contests, getPar3ContestConfig, getPar3ContestParticipantIds } from "@/lib/par3-contests";

const roundSelect = {
  status: true,
  formatConfig: true,
  roundPlayers: { select: { playerId: true, player: { select: { fullName: true, nickname: true } } } },
} satisfies Prisma.RoundSelect;
type ContestRound = Prisma.RoundGetPayload<{ select: typeof roundSelect }>;

function snapshot(round: ContestRound, holeNumber: number) {
  const config = getPar3ContestConfig(liveContestConfig(round.formatConfig));
  const contest = getActivePar3Contests(config).find((hole) => hole.holeNumber === holeNumber) ?? null;
  const eligible = new Set(getPar3ContestParticipantIds(config, round.roundPlayers.map((entry) => entry.playerId)));
  return {
    holeNumber,
    editable: round.status === "LIVE",
    contest,
    winnerPlayerId: config?.results?.find((result) => result.holeNumber === holeNumber)?.winnerPlayerId ?? null,
    players: round.roundPlayers.filter((entry) => eligible.has(entry.playerId)).map(({ playerId, player }) => ({
      playerId, playerName: player.nickname || player.fullName,
    })).sort((a, b) => a.playerName.localeCompare(b.playerName)),
  };
}

export async function getLiveHoleContest(roundId: string, holeNumber: number) {
  const round = await prisma.round.findUnique({ where: { id: roundId }, select: roundSelect });
  if (!round) throw new Error("Round not found.");
  return snapshot(round, holeNumber);
}

export async function saveLiveHoleContestWinner(
  roundId: string,
  holeNumber: number,
  winnerPlayerId: string | null,
  expectedWinnerPlayerId: string | null,
) {
  return retryBurgerWrite(() => prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: roundId }, select: roundSelect });
    if (!round) throw new Error("Round not found.");
    const formatConfig = changeLiveHoleContestWinner(
      round.formatConfig, round.status, round.roundPlayers.map((entry) => entry.playerId),
      holeNumber, winnerPlayerId, expectedWinnerPlayerId,
    );
    const updated = await tx.round.update({
      where: { id: roundId }, data: { formatConfig: formatConfig as unknown as Prisma.InputJsonObject }, select: roundSelect,
    });
    return snapshot(updated, holeNumber);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
