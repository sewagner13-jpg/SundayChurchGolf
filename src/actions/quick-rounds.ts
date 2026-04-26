"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { rebuildSeasonStats } from "@/actions/season-stats";

export interface QuickRoundTeamInput {
  playerIds: string[];
  /** Total dollar payout for the whole team (positive = won, negative = lost) */
  teamPayout: number;
}

export interface CreateQuickRoundInput {
  date: string; // ISO date string e.g. "2025-04-20"
  courseId: string;
  formatId: string;
  buyInPerPlayer: number;
  name?: string;
  teams: QuickRoundTeamInput[];
}

export async function createQuickRound(input: CreateQuickRoundInput) {
  if (input.teams.length < 2) {
    throw new Error("At least 2 teams are required");
  }

  const allPlayerIds = input.teams.flatMap((t) => t.playerIds);
  if (allPlayerIds.length === 0) {
    throw new Error("At least one player is required");
  }

  // Detect duplicate players across teams
  const uniquePlayerIds = new Set(allPlayerIds);
  if (uniquePlayerIds.size !== allPlayerIds.length) {
    throw new Error("A player cannot appear on more than one team");
  }

  // Check teams have players
  for (let i = 0; i < input.teams.length; i++) {
    if (input.teams[i].playerIds.length === 0) {
      throw new Error(`Team ${i + 1} has no players`);
    }
  }

  const roundDate = new Date(input.date);
  const year = roundDate.getFullYear();

  // Create the round
  const round = await prisma.round.create({
    data: {
      date: roundDate,
      status: "FINISHED",
      courseId: input.courseId,
      formatId: input.formatId,
      buyInPerPlayer: input.buyInPerPlayer,
      name: input.name?.trim() || null,
      formatConfig: { manualEntry: true },
    },
  });

  // Determine which team has the highest total payout (top paying team)
  const maxPayout = Math.max(...input.teams.map((t) => t.teamPayout));

  // Create teams and round players
  for (let i = 0; i < input.teams.length; i++) {
    const teamInput = input.teams[i];
    const playerCount = teamInput.playerIds.length;
    const perPlayerPayout =
      playerCount > 0 ? teamInput.teamPayout / playerCount : 0;
    const isTopPayingTeam = teamInput.teamPayout === maxPayout && maxPayout > 0;

    const team = await prisma.team.create({
      data: {
        roundId: round.id,
        teamNumber: i + 1,
        totalPayout: teamInput.teamPayout,
        isTopPayingTeam,
        finishedScoring: true,
      },
    });

    for (const playerId of teamInput.playerIds) {
      await prisma.roundPlayer.create({
        data: {
          roundId: round.id,
          teamId: team.id,
          playerId,
          payoutAmount: perPlayerPayout,
          wasOnTopPayingTeam: isTopPayingTeam,
        },
      });
    }
  }

  // Rebuild season stats so this round is reflected immediately
  await rebuildSeasonStats(year);

  revalidatePath("/rounds");
  revalidatePath("/leaderboard");
  revalidatePath("/");

  return { roundId: round.id };
}

export async function deleteQuickRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { date: true, formatConfig: true },
  });

  if (!round) throw new Error("Round not found");

  const config = round.formatConfig as Record<string, unknown> | null;
  if (!config?.manualEntry) {
    throw new Error(
      "Only manually recorded rounds can be deleted from this screen"
    );
  }

  const year = new Date(round.date).getFullYear();

  // Cascade deletes teams, round players, etc.
  await prisma.round.delete({ where: { id: roundId } });

  await rebuildSeasonStats(year);

  revalidatePath("/rounds");
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

export interface QuickRoundSummary {
  id: string;
  name: string | null;
  date: Date;
  courseName: string;
  formatName: string;
  playerCount: number;
  teamCount: number;
}

export async function listQuickRounds(): Promise<QuickRoundSummary[]> {
  const rounds = await prisma.round.findMany({
    where: { status: "FINISHED" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      course: true,
      format: true,
      roundPlayers: true,
      teams: true,
    },
  });

  return rounds
    .filter((r) => {
      const cfg = r.formatConfig as Record<string, unknown> | null;
      return cfg?.manualEntry === true;
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      courseName: r.course.name,
      formatName: r.format.name,
      playerCount: r.roundPlayers.length,
      teamCount: r.teams.length,
    }));
}
