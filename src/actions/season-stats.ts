"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";

export async function getLeaderboard(year: number) {
  const stats = await prisma.seasonPlayerStat.findMany({
    where: { year },
    include: {
      player: true,
    },
    orderBy: [
      { totalWinnings: "desc" },
      { topTeamAppearances: "desc" },
      { roundsPlayed: "desc" },
    ],
  });

  // Additional sort by player name for ties
  stats.sort((a, b) => {
    const winningsDiff = b.totalWinnings.sub(a.totalWinnings).toNumber();
    if (winningsDiff !== 0) return winningsDiff;

    if (b.topTeamAppearances !== a.topTeamAppearances) {
      return b.topTeamAppearances - a.topTeamAppearances;
    }

    if (b.roundsPlayed !== a.roundsPlayed) {
      return b.roundsPlayed - a.roundsPlayed;
    }

    const nameA = a.player.nickname || a.player.fullName;
    const nameB = b.player.nickname || b.player.fullName;
    return nameA.localeCompare(nameB);
  });

  // Convert Decimal to number for client serialization
  return stats.map((s) => {
    const totalWinnings = Number(s.totalWinnings);
    const totalBuyInsPaid = Number(s.totalBuyInsPaid);
    const netWinnings = totalWinnings - totalBuyInsPaid;

    return {
      playerId: s.playerId,
      playerName: s.player.nickname || s.player.fullName,
      handicapIndex: s.player.handicapIndex ? Number(s.player.handicapIndex) : null,
      totalWinnings,
      totalBuyInsPaid,
      netWinnings,
      roundsPlayed: s.roundsPlayed,
      topTeamAppearances: s.topTeamAppearances,
    };
  });
}

export async function getPlayerSeasonDetail(playerId: string, year: number) {
  const stat = await prisma.seasonPlayerStat.findUnique({
    where: {
      year_playerId: { year, playerId },
    },
    include: {
      player: true,
    },
  });

  const rounds = await prisma.roundPlayer.findMany({
    where: {
      playerId,
      round: {
        status: "FINISHED",
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    },
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
      round: { date: "desc" },
    },
  });

  return {
    player: stat?.player ?? null,
    stats: stat
      ? {
          totalWinnings: stat.totalWinnings,
          roundsPlayed: stat.roundsPlayed,
          topTeamAppearances: stat.topTeamAppearances,
        }
      : null,
    rounds: rounds.map((rp) => ({
      roundId: rp.roundId,
      date: rp.round.date,
      courseName: rp.round.course.name,
      formatName: rp.round.format.name,
      teamNumber: rp.team?.teamNumber ?? null,
      payout: rp.payoutAmount,
      wasOnTopPayingTeam: rp.wasOnTopPayingTeam,
    })),
  };
}

export async function rebuildSeasonStats(year: number) {
  // Delete all stats for the year
  await prisma.seasonPlayerStat.deleteMany({
    where: { year },
  });

  // Get all FINISHED rounds for the year
  const rounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: {
      roundPlayers: {
        include: {
          team: true,
        },
      },
      teams: true,
    },
  });

  // Aggregate stats per player
  const playerStats = new Map<
    string,
    {
      totalWinnings: Decimal;
      totalBuyInsPaid: Decimal;
      roundsPlayed: number;
      topTeamAppearances: number;
    }
  >();

  for (const round of rounds) {
    for (const rp of round.roundPlayers) {
      const existing = playerStats.get(rp.playerId) ?? {
        totalWinnings: new Decimal(0),
        totalBuyInsPaid: new Decimal(0),
        roundsPlayed: 0,
        topTeamAppearances: 0,
      };

      existing.totalWinnings = existing.totalWinnings.add(rp.payoutAmount);
      existing.totalBuyInsPaid = existing.totalBuyInsPaid.add(round.buyInPerPlayer);
      existing.roundsPlayed += 1;
      if (rp.wasOnTopPayingTeam) {
        existing.topTeamAppearances += 1;
      }

      playerStats.set(rp.playerId, existing);
    }
  }

  // Insert stats
  for (const [playerId, stats] of playerStats) {
    await prisma.seasonPlayerStat.create({
      data: {
        year,
        playerId,
        totalWinnings: stats.totalWinnings,
        totalBuyInsPaid: stats.totalBuyInsPaid,
        roundsPlayed: stats.roundsPlayed,
        topTeamAppearances: stats.topTeamAppearances,
      },
    });
  }

  revalidatePath("/leaderboard");
}

export async function getTopTeamHistory(playerIds: string[]) {
  // Find all FINISHED rounds where these exact players were on the same team
  const rounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
    },
    include: {
      teams: {
        include: {
          roundPlayers: true,
        },
      },
    },
  });

  const sortedIds = [...playerIds].sort();
  let count = 0;

  for (const round of rounds) {
    for (const team of round.teams) {
      const teamPlayerIds = team.roundPlayers
        .map((rp) => rp.playerId)
        .sort();

      if (
        teamPlayerIds.length === sortedIds.length &&
        teamPlayerIds.every((id, i) => id === sortedIds[i])
      ) {
        count++;
      }
    }
  }

  return count;
}

export async function getAvailableYears() {
  const stats = await prisma.seasonPlayerStat.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });

  const years = stats.map((s) => s.year);

  // Ensure current year is included
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }

  return years;
}
