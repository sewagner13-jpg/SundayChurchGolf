"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { RoundStatus, VisibilityMode, BlindRevealMode } from "@prisma/client";
import { validateEvenTeams } from "@/lib/scoring-engine";

const MAX_PLAYERS_PER_ROUND = 12;
const MIN_PLAYERS_PER_ROUND = 2;

export interface CreateRoundData {
  date: Date;
  courseId: string;
  formatId: string;
  buyInPerPlayer: number;
  visibility: VisibilityMode;
  blindRevealMode?: BlindRevealMode;
}

export interface UpdateRoundDraftData {
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
  const round = await prisma.round.findUnique({ where: { id } });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only delete rounds in DRAFT status");
  }

  await prisma.round.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/rounds");
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
  return prisma.round.findUnique({
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
