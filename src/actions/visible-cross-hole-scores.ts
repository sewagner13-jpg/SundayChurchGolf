"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { VisibleHoleScores } from "@/lib/hole-score-refresh";

/** This panel never uses the unrestricted individual-score reader. */
export async function getVisibleCrossHoleScores(roundId: string, holeNumber: number): Promise<VisibleHoleScores> {
  if (typeof roundId !== "string" || !roundId || !Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    throw new Error("A valid round and hole are required");
  }
  // The visibility check and score read share one database snapshot. A concurrent
  // visibility edit cannot make this return scores from a separately checked state.
  return prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({where: {id: roundId}, select: {visibility: true}});
    if (!round || round.visibility !== "OPEN") return {hidden: true, scores: []};
    const scores = await tx.playerScore.findMany({
      where: {roundId, holeNumber},
      select: {roundId: true, teamId: true, playerId: true, holeNumber: true, grossScore: true},
      orderBy: {playerId: "asc"},
    });
    return {hidden: false, scores};
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
}
