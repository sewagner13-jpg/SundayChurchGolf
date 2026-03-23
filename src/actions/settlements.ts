"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export interface SettlementEntryInput {
  playerId: string;
  amount: number; // positive = won, negative = owed
}

export async function createManualSettlement(
  date: string, // "YYYY-MM-DD"
  description: string | null,
  entries: SettlementEntryInput[]
) {
  if (!entries.length) throw new Error("At least one player entry is required");

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) throw new Error("Invalid date");
  const year = parsed.getFullYear();

  const settlement = await prisma.$transaction(async (tx) => {
    const s = await tx.manualSettlement.create({
      data: {
        date: parsed,
        year,
        description: description?.trim() || null,
        entries: {
          create: entries.map((e) => ({
            playerId: e.playerId,
            amount: new Decimal(e.amount),
          })),
        },
      },
      include: { entries: true },
    });

    // Update SeasonPlayerStat for each player
    for (const entry of entries) {
      if (entry.amount === 0) continue;
      const delta = new Decimal(entry.amount);
      await tx.seasonPlayerStat.upsert({
        where: { year_playerId: { year, playerId: entry.playerId } },
        update: { totalWinnings: { increment: delta } },
        create: {
          year,
          playerId: entry.playerId,
          totalWinnings: delta,
          totalBuyInsPaid: new Decimal(0),
          roundsPlayed: 0,
          topTeamAppearances: 0,
        },
      });
    }

    return s;
  });

  revalidatePath("/settlements");
  revalidatePath("/leaderboard");
  revalidatePath("/stats");
  return settlement;
}

export async function deleteManualSettlement(settlementId: string) {
  const settlement = await prisma.manualSettlement.findUnique({
    where: { id: settlementId },
    include: { entries: true },
  });
  if (!settlement) throw new Error("Settlement not found");

  await prisma.$transaction(async (tx) => {
    // Reverse each player's stat delta before deleting
    for (const entry of settlement.entries) {
      if (entry.amount.equals(0)) continue;
      const delta = entry.amount.negated();
      await tx.seasonPlayerStat.updateMany({
        where: { year: settlement.year, playerId: entry.playerId },
        data: { totalWinnings: { increment: delta } },
      });
    }
    await tx.manualSettlement.delete({ where: { id: settlementId } });
  });

  revalidatePath("/settlements");
  revalidatePath("/leaderboard");
  revalidatePath("/stats");
}

export async function listManualSettlements(year?: number) {
  const where = year ? { year } : {};
  return prisma.manualSettlement.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      entries: {
        include: { player: { select: { id: true, fullName: true, nickname: true } } },
        orderBy: { amount: "desc" },
      },
    },
  });
}
