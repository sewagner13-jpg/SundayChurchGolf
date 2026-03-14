"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isValidGHINNumber } from "@/lib/ghin";
import { setRoundPlayers } from "@/actions/rounds";

function validateHandicapIndex(handicapIndex: number) {
  if (Number.isNaN(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
    throw new Error("Handicap index must be between -10 and 54");
  }
}

export async function refreshPlayerHandicap(
  playerId: string,
  handicapIndex: number
) {
  validateHandicapIndex(handicapIndex);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) throw new Error("Player not found");
  if (!isValidGHINNumber(player.ghinNumber)) {
    throw new Error("Player has an invalid GHIN number");
  }

  const now = new Date();
  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      handicapIndex: new Decimal(handicapIndex),
      handicapLastUpdatedAt: now,
      lastVerifiedDate: now,
      handicapSource: "manual_ghin_refresh",
    },
  });

  revalidatePath("/players");
  revalidatePath("/leaderboard");
  revalidatePath("/stats");
  return {
    ...updated,
    handicapIndex:
      updated.handicapIndex !== null ? Number(updated.handicapIndex) : null,
  };
}

export async function getSundaySetupPlayers(roundId: string) {
  const [round, players] = await Promise.all([
    prisma.round.findUnique({
      where: { id: roundId },
      include: {
        roundPlayers: {
          include: {
            player: true,
          },
          orderBy: {
            player: {
              fullName: "asc",
            },
          },
        },
      },
    }),
    prisma.player.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  if (!round) throw new Error("Round not found");

  return {
    round: {
      id: round.id,
      status: round.status,
      date: round.date,
      name: round.name,
      formatId: round.formatId,
    },
    players: players.map((player) => ({
      ...player,
      handicapIndex:
        player.handicapIndex !== null ? Number(player.handicapIndex) : null,
    })),
    selectedPlayerIds: round.roundPlayers.map((roundPlayer) => roundPlayer.playerId),
    snapshots: round.roundPlayers.map((roundPlayer) => ({
      playerId: roundPlayer.playerId,
      eventHandicapIndex:
        roundPlayer.eventHandicapIndex !== null
          ? Number(roundPlayer.eventHandicapIndex)
          : null,
      eventHandicapLockedAt: roundPlayer.eventHandicapLockedAt,
    })),
  };
}

export async function saveSundaySetupSelection(
  roundId: string,
  playerIds: string[]
) {
  await setRoundPlayers(roundId, playerIds);
  revalidatePath(`/rounds/${roundId}/setup`);
  revalidatePath(`/rounds/${roundId}/sunday-setup`);
}

export async function lockRoundEventHandicaps(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundPlayers: {
        include: {
          player: true,
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Event handicaps can only be locked while the round is in draft");
  }

  const lockedAt = new Date();
  await prisma.$transaction(
    round.roundPlayers.map((roundPlayer) =>
      prisma.roundPlayer.update({
        where: { id: roundPlayer.id },
        data: {
          eventHandicapIndex:
            roundPlayer.player.handicapIndex === null
              ? null
              : new Decimal(roundPlayer.player.handicapIndex),
          eventHandicapLockedAt: lockedAt,
        },
      })
    )
  );

  revalidatePath(`/rounds/${roundId}/setup`);
  revalidatePath(`/rounds/${roundId}/sunday-setup`);
  return {
    lockedAt,
    count: round.roundPlayers.length,
  };
}
