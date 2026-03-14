"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface PlayerScoreEntry {
  roundId: string;
  teamId: string;
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
  extraData?: Record<string, unknown>;
}

export interface PlayerScoreRecord {
  id: string;
  roundId: string;
  teamId: string;
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
  extraData: Record<string, unknown> | null;
}

/** Return all player scores for a round, optionally filtered by hole and/or team. */
export async function getPlayerScores(
  roundId: string,
  options?: { holeNumber?: number; teamId?: string }
): Promise<PlayerScoreRecord[]> {
  const scores = await prisma.playerScore.findMany({
    where: {
      roundId,
      ...(options?.holeNumber !== undefined
        ? { holeNumber: options.holeNumber }
        : {}),
      ...(options?.teamId ? { teamId: options.teamId } : {}),
    },
    orderBy: [{ holeNumber: "asc" }, { playerId: "asc" }],
  });

  return scores.map((s) => ({
    id: s.id,
    roundId: s.roundId,
    teamId: s.teamId,
    playerId: s.playerId,
    holeNumber: s.holeNumber,
    grossScore: s.grossScore,
    extraData: s.extraData as Record<string, unknown> | null,
  }));
}

/** Upsert a single player score. */
export async function upsertPlayerScore(
  entry: PlayerScoreEntry
): Promise<PlayerScoreRecord> {
  const result = await prisma.playerScore.upsert({
    where: {
      roundId_teamId_playerId_holeNumber: {
        roundId: entry.roundId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        holeNumber: entry.holeNumber,
      },
    },
    update: {
      grossScore: entry.grossScore ?? null,
      extraData: entry.extraData ?? undefined,
    },
    create: {
      roundId: entry.roundId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      holeNumber: entry.holeNumber,
      grossScore: entry.grossScore ?? null,
      extraData: entry.extraData ?? undefined,
    },
  });

  revalidatePath(`/rounds/${entry.roundId}/scoring`);

  return {
    id: result.id,
    roundId: result.roundId,
    teamId: result.teamId,
    playerId: result.playerId,
    holeNumber: result.holeNumber,
    grossScore: result.grossScore,
    extraData: result.extraData as Record<string, unknown> | null,
  };
}

/** Upsert a batch of player scores atomically. */
export async function upsertPlayerScores(
  entries: PlayerScoreEntry[]
): Promise<{ updated: number }> {
  if (entries.length === 0) return { updated: 0 };

  const upserts = entries.map((entry) =>
    prisma.playerScore.upsert({
      where: {
        roundId_teamId_playerId_holeNumber: {
          roundId: entry.roundId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          holeNumber: entry.holeNumber,
        },
      },
      update: {
        grossScore: entry.grossScore ?? null,
        extraData: entry.extraData ?? undefined,
      },
      create: {
        roundId: entry.roundId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        holeNumber: entry.holeNumber,
        grossScore: entry.grossScore ?? null,
        extraData: entry.extraData ?? undefined,
      },
    })
  );

  const results = await prisma.$transaction(upserts);

  if (entries.length > 0) {
    revalidatePath(`/rounds/${entries[0].roundId}/scoring`);
  }

  return { updated: results.length };
}
