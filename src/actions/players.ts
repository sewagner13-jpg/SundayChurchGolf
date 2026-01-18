"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export interface PlayerFormData {
  fullName: string;
  nickname?: string | null;
  handicapIndex?: number | null;
}

export async function createPlayer(data: PlayerFormData) {
  const player = await prisma.player.create({
    data: {
      fullName: data.fullName,
      nickname: data.nickname || null,
      handicapIndex: data.handicapIndex ? new Decimal(data.handicapIndex) : null,
      handicapLastUpdatedAt: data.handicapIndex ? new Date() : null,
    },
  });

  revalidatePath("/players");
  return player;
}

export async function updatePlayer(id: string, data: PlayerFormData) {
  const existing = await prisma.player.findUnique({ where: { id } });
  if (!existing) throw new Error("Player not found");

  // Check if handicap changed
  const handicapChanged =
    data.handicapIndex !== undefined &&
    (existing.handicapIndex === null ||
      !existing.handicapIndex.equals(new Decimal(data.handicapIndex ?? 0)));

  const player = await prisma.player.update({
    where: { id },
    data: {
      fullName: data.fullName,
      nickname: data.nickname || null,
      handicapIndex:
        data.handicapIndex !== undefined
          ? data.handicapIndex
            ? new Decimal(data.handicapIndex)
            : null
          : undefined,
      handicapLastUpdatedAt: handicapChanged ? new Date() : undefined,
    },
  });

  revalidatePath("/players");
  return player;
}

export async function setPlayerActive(id: string, isActive: boolean) {
  const player = await prisma.player.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/players");
  return player;
}

export async function deletePlayer(id: string) {
  // Check if player has ever been used in a round
  const usedInRound = await prisma.roundPlayer.findFirst({
    where: { playerId: id },
  });

  if (usedInRound) {
    throw new Error(
      "Cannot delete player who has played in rounds. Set player to inactive instead."
    );
  }

  await prisma.player.delete({ where: { id } });
  revalidatePath("/players");
}

export async function listPlayers(includeInactive = false) {
  const where = includeInactive ? {} : { isActive: true };

  const players = await prisma.player.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  // Convert Decimal to number for client serialization
  return players.map((p) => ({
    ...p,
    handicapIndex: p.handicapIndex ? Number(p.handicapIndex) : null,
  }));
}

export async function getPlayer(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      roundPlayers: {
        include: {
          round: {
            include: {
              course: true,
              format: true,
            },
          },
          team: true,
        },
        orderBy: {
          round: {
            date: "desc",
          },
        },
      },
      seasonStats: {
        orderBy: { year: "desc" },
      },
    },
  });
}
