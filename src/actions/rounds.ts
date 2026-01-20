"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { RoundStatus, VisibilityMode, BlindRevealMode } from "@prisma/client";
import { validateEvenTeams } from "@/lib/scoring-engine";

const MAX_PLAYERS_PER_ROUND = 12;
const MIN_PLAYERS_PER_ROUND = 2;

export interface CreateRoundData {
  name?: string;
  date: Date;
  courseId: string;
  formatId: string;
  buyInPerPlayer: number;
  visibility: VisibilityMode;
  blindRevealMode?: BlindRevealMode;
}

export interface UpdateRoundDraftData {
  name?: string;
  date?: Date;
  courseId?: string;
  formatId?: string;
  buyInPerPlayer?: number;
  visibility?: VisibilityMode;
  blindRevealMode?: BlindRevealMode;
}

// Check if an active round (DRAFT or LIVE) exists
async function hasActiveRound(): Promise<boolean> {
  const activeRound = await prisma.round.findFirst({
    where: {
      status: { in: ["DRAFT", "LIVE"] },
    },
  });
  return !!activeRound;
}

export async function createRound(data: CreateRoundData) {
  // STRICT: Only one active round allowed
  if (await hasActiveRound()) {
    throw new Error(
      "Cannot create new round while an active round (DRAFT or LIVE) exists."
    );
  }

  if (data.buyInPerPlayer <= 0) {
    throw new Error("Buy-in must be greater than 0");
  }

  const round = await prisma.round.create({
    data: {
      name: data.name || null,
      date: data.date,
      courseId: data.courseId,
      formatId: data.formatId,
      buyInPerPlayer: new Decimal(data.buyInPerPlayer),
      visibility: data.visibility,
      blindRevealMode: data.blindRevealMode ?? "REVEAL_AFTER_ROUND",
      status: "DRAFT",
    },
    include: {
      course: true,
      format: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/rounds");
  return round;
}

export async function updateRoundDraft(id: string, data: UpdateRoundDraftData) {
  const round = await prisma.round.findUnique({ where: { id } });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only update round details while in DRAFT status");
  }

  if (data.buyInPerPlayer !== undefined && data.buyInPerPlayer <= 0) {
    throw new Error("Buy-in must be greater than 0");
  }

  const updated = await prisma.round.update({
    where: { id },
    data: {
      name: data.name,
      date: data.date,
      courseId: data.courseId,
      formatId: data.formatId,
      buyInPerPlayer: data.buyInPerPlayer
        ? new Decimal(data.buyInPerPlayer)
        : undefined,
      visibility: data.visibility,
      blindRevealMode: data.blindRevealMode,
    },
    include: {
      course: true,
      format: true,
    },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  return updated;
}

export async function deleteRound(id: string) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      roundPlayers: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status === "LIVE") {
    throw new Error("Cannot delete a round that is currently LIVE. Finish it first.");
  }

  // If FINISHED, we need to reverse the season stats
  if (round.status === "FINISHED") {
    const year = round.date.getFullYear();

    for (const rp of round.roundPlayers) {
      const stat = await prisma.seasonPlayerStat.findUnique({
        where: { year_playerId: { year, playerId: rp.playerId } },
      });

      if (stat) {
        const newWinnings = stat.totalWinnings.sub(rp.payoutAmount);
        const newBuyIns = stat.totalBuyInsPaid.sub(round.buyInPerPlayer);
        const newRounds = Math.max(0, stat.roundsPlayed - 1);
        const newTopTeam = rp.wasOnTopPayingTeam
          ? Math.max(0, stat.topTeamAppearances - 1)
          : stat.topTeamAppearances;

        if (newRounds === 0) {
          // Delete the stat if no rounds left
          await prisma.seasonPlayerStat.delete({
            where: { year_playerId: { year, playerId: rp.playerId } },
          });
        } else {
          await prisma.seasonPlayerStat.update({
            where: { year_playerId: { year, playerId: rp.playerId } },
            data: {
              totalWinnings: newWinnings,
              totalBuyInsPaid: newBuyIns,
              roundsPlayed: newRounds,
              topTeamAppearances: newTopTeam,
            },
          });
        }
      }
    }
  }

  await prisma.round.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/rounds");
  revalidatePath("/leaderboard");
}

export async function reopenRound(id: string) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      roundPlayers: true,
      teams: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "FINISHED") {
    throw new Error("Can only reopen rounds that are FINISHED");
  }

  // Reverse the season stats that were added when the round was finished
  const year = round.date.getFullYear();

  for (const rp of round.roundPlayers) {
    const stat = await prisma.seasonPlayerStat.findUnique({
      where: { year_playerId: { year, playerId: rp.playerId } },
    });

    if (stat) {
      const newWinnings = stat.totalWinnings.sub(rp.payoutAmount);
      const newBuyIns = stat.totalBuyInsPaid.sub(round.buyInPerPlayer);
      const newRounds = Math.max(0, stat.roundsPlayed - 1);
      const newTopTeam = rp.wasOnTopPayingTeam
        ? Math.max(0, stat.topTeamAppearances - 1)
        : stat.topTeamAppearances;

      if (newRounds === 0) {
        await prisma.seasonPlayerStat.delete({
          where: { year_playerId: { year, playerId: rp.playerId } },
        });
      } else {
        await prisma.seasonPlayerStat.update({
          where: { year_playerId: { year, playerId: rp.playerId } },
          data: {
            totalWinnings: newWinnings,
            totalBuyInsPaid: newBuyIns,
            roundsPlayed: newRounds,
            topTeamAppearances: newTopTeam,
          },
        });
      }
    }
  }

  // Reset team payouts and top team status
  for (const team of round.teams) {
    await prisma.team.update({
      where: { id: team.id },
      data: {
        totalPayout: 0,
        isTopPayingTeam: false,
      },
    });
  }

  // Reset round player payouts
  for (const rp of round.roundPlayers) {
    await prisma.roundPlayer.update({
      where: { id: rp.id },
      data: {
        payoutAmount: 0,
        wasOnTopPayingTeam: false,
      },
    });
  }

  // Clear hole results (they'll be recalculated)
  await prisma.holeResult.deleteMany({ where: { roundId: id } });

  // Set round back to LIVE and clear tiebreaker info
  await prisma.round.update({
    where: { id },
    data: {
      status: "LIVE",
      tiebreakerTeamId: null,
      tiebreakerHoleNum: null,
      tiebreakerSkinsWon: null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/scoring`);
  revalidatePath(`/rounds/${id}/summary`);
  revalidatePath("/leaderboard");
}

export async function setRoundPlayers(id: string, playerIds: string[]) {
  const round = await prisma.round.findUnique({ where: { id } });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only set players while in DRAFT status");
  }

  if (playerIds.length < MIN_PLAYERS_PER_ROUND) {
    throw new Error(`Minimum ${MIN_PLAYERS_PER_ROUND} players required`);
  }
  if (playerIds.length > MAX_PLAYERS_PER_ROUND) {
    throw new Error(`Maximum ${MAX_PLAYERS_PER_ROUND} players allowed`);
  }

  // Clear existing round players and teams
  await prisma.roundPlayer.deleteMany({ where: { roundId: id } });
  await prisma.team.deleteMany({ where: { roundId: id } });

  // Create new round players
  await prisma.roundPlayer.createMany({
    data: playerIds.map((playerId) => ({
      roundId: id,
      playerId,
    })),
  });

  revalidatePath(`/rounds/${id}`);
}

export async function startRound(id: string, startingHole: 1 | 10) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      teams: { include: { roundPlayers: true } },
      roundPlayers: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only start rounds in DRAFT status");
  }
  if (round.teams.length === 0) {
    throw new Error("Teams must be generated before starting");
  }

  // Verify all players are assigned to teams
  const playersOnTeams = round.teams.flatMap((t) =>
    t.roundPlayers.map((rp) => rp.playerId)
  );
  const allPlayers = round.roundPlayers.map((rp) => rp.playerId);

  if (playersOnTeams.length !== allPlayers.length) {
    throw new Error("All players must be assigned to teams");
  }

  // Calculate pot and base skin value
  const playerCount = round.roundPlayers.length;
  const pot = round.buyInPerPlayer.mul(playerCount);
  const baseSkinValue = pot.div(18);

  // Update round to LIVE
  const updated = await prisma.round.update({
    where: { id },
    data: {
      status: "LIVE",
      startingHole,
      pot,
      baseSkinValue,
    },
    include: {
      course: { include: { holes: true } },
      format: true,
      teams: { include: { roundPlayers: { include: { player: true } } } },
    },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/scoring`);
  return updated;
}

export async function listRounds(year?: number) {
  const where = year
    ? {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      }
    : {};

  return prisma.round.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      course: true,
      format: true,
      roundPlayers: true,
      teams: true,
    },
  });
}

export async function getRound(id: string) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { holeNumber: "asc" } } } },
      format: true,
      teams: {
        orderBy: { teamNumber: "asc" },
        include: {
          roundPlayers: {
            include: { player: true },
          },
        },
      },
      roundPlayers: {
        include: { player: true, team: true },
      },
      holeScores: true,
      holeResults: {
        orderBy: { holeNumber: "asc" },
      },
    },
  });

  if (!round) return null;

  // Helper to convert player Decimal fields
  const serializePlayer = (player: typeof round.roundPlayers[0]["player"]) => ({
    ...player,
    handicapIndex: player.handicapIndex ? Number(player.handicapIndex) : null,
  });

  // Convert Decimal values to numbers for client-side serialization
  return {
    ...round,
    buyInPerPlayer: Number(round.buyInPerPlayer),
    pot: round.pot ? Number(round.pot) : null,
    baseSkinValue: round.baseSkinValue ? Number(round.baseSkinValue) : null,
    teams: round.teams.map((team) => ({
      ...team,
      totalPayout: Number(team.totalPayout),
      handicapTotal: team.handicapTotal ? Number(team.handicapTotal) : null,
      roundPlayers: team.roundPlayers.map((rp) => ({
        ...rp,
        player: serializePlayer(rp.player),
      })),
    })),
    roundPlayers: round.roundPlayers.map((rp) => ({
      ...rp,
      payoutAmount: Number(rp.payoutAmount),
      player: serializePlayer(rp.player),
    })),
    holeResults: round.holeResults.map((hr) => ({
      ...hr,
      holePayout: Number(hr.holePayout),
    })),
  };
}

export async function getActiveRound() {
  return prisma.round.findFirst({
    where: {
      status: { in: ["DRAFT", "LIVE"] },
    },
    include: {
      course: true,
      format: true,
    },
  });
}

export async function getFinishedRounds() {
  return prisma.round.findMany({
    where: { status: "FINISHED" },
    orderBy: { date: "desc" },
    include: {
      course: true,
      format: true,
      roundPlayers: true,
    },
  });
}
