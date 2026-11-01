"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { changeBurgerSelection, readBurgerSelections, retryBurgerWrite } from "@/lib/burger-orders";

const burgerRoundSelect = {
  status: true,
  formatConfig: true,
  roundPlayers: {
    select: {
      playerId: true,
      player: { select: { fullName: true, nickname: true } },
    },
  },
} satisfies Prisma.RoundSelect;

type BurgerRound = Prisma.RoundGetPayload<{ select: typeof burgerRoundSelect }>;

function snapshot(round: BurgerRound) {
  const players = round.roundPlayers.map(({ playerId, player }) => ({
    playerId,
    playerName: player.nickname || player.fullName,
  }));
  return {
    selectedPlayerIds: readBurgerSelections(round.formatConfig, players.map((player) => player.playerId)),
    players,
  };
}

export async function getRoundBurgerOrders(id: string) {
  const round = await prisma.round.findUnique({ where: { id }, select: burgerRoundSelect });
  if (!round) throw new Error("Round not found.");
  return snapshot(round);
}

export async function updateRoundBurgerOrder(id: string, playerId: string, selected: boolean) {
  const result = await retryBurgerWrite(() => prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id }, select: burgerRoundSelect });
    if (!round) throw new Error("Round not found.");
    if (!["LIVE", "FINISHED"].includes(round.status)) {
      throw new Error("Burger selections can only be updated once the round has started.");
    }
    const formatConfig = changeBurgerSelection(
      round.formatConfig,
      round.roundPlayers.map((player) => player.playerId),
      playerId,
      selected
    );
    const updated = await tx.round.update({
      where: { id },
      data: { formatConfig: formatConfig as Prisma.InputJsonObject },
      select: burgerRoundSelect,
    });
    return snapshot(updated);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  revalidatePath(`/rounds/${id}/scoring`);
  revalidatePath(`/rounds/${id}/summary`);
  return result;
}
