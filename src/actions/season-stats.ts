"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { computeFormatScore, getIrishGolfSegmentFormatId, getMinimumScoresRequired, type PlayerInput } from "@/lib/format-scoring";

async function getCountedScoreUsageByPlayer(year: number) {
  const rounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: {
      course: {
        include: {
          holes: true,
        },
      },
      format: true,
      teams: {
        include: {
          roundPlayers: {
            include: {
              player: true,
            },
          },
        },
      },
      playerScores: true,
    },
  });

  const countedUsage = new Map<string, number>();

  for (const round of rounds) {
    for (const team of round.teams) {
      team.roundPlayers.forEach((roundPlayer) => {
        if (!countedUsage.has(roundPlayer.playerId)) {
          countedUsage.set(roundPlayer.playerId, 0);
        }
      });
    }

    for (const hole of round.course.holes) {
      for (const team of round.teams) {
        const teamScores = round.playerScores.filter(
          (playerScore) =>
            playerScore.teamId === team.id &&
            playerScore.holeNumber === hole.holeNumber
        );

        const players: PlayerInput[] = team.roundPlayers.map((roundPlayer) => {
          const playerScore = teamScores.find(
            (score) => score.playerId === roundPlayer.playerId
          );
          return {
            playerId: roundPlayer.playerId,
            playerName: roundPlayer.player.nickname || roundPlayer.player.fullName,
            grossScore: playerScore?.grossScore ?? null,
            driveSelected:
              (playerScore?.extraData as Record<string, unknown> | null)
                ?.driveSelected === true,
          };
        });

        const effectiveFormatId =
          round.formatId === "irish_golf_6_6_6"
            ? getIrishGolfSegmentFormatId(
                hole.holeNumber,
                (round.formatConfig as Record<string, unknown>) ?? {}
              ) ?? round.formatId
            : round.formatId;

        if (getMinimumScoresRequired(effectiveFormatId) === null) {
          continue;
        }

        const result = computeFormatScore(
          effectiveFormatId,
          players,
          hole.holeNumber,
          hole.par,
          {},
          (round.formatConfig as Record<string, unknown>) ?? {}
        );

        result?.countedPlayerIds.forEach((playerId) => {
          countedUsage.set(playerId, (countedUsage.get(playerId) ?? 0) + 1);
        });
      }
    }
  }

  return countedUsage;
}

export async function getLeaderboard(year: number) {
  const countedScoreUsage = await getCountedScoreUsageByPlayer(year);
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
      handicapIndex:
        s.player.handicapIndex !== null ? Number(s.player.handicapIndex) : null,
      totalWinnings,
      totalBuyInsPaid,
      netWinnings,
      roundsPlayed: s.roundsPlayed,
      topTeamAppearances: s.topTeamAppearances,
      countedScoresUsed: countedScoreUsage.get(s.playerId) ?? 0,
    };
  });
}

export async function getPlayerSeasonDetail(playerId: string, year: number) {
  const countedScoreUsage = await getCountedScoreUsageByPlayer(year);
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
          countedScoresUsed: countedScoreUsage.get(playerId) ?? 0,
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

// Get all team combination winnings for a year
// Returns groups of players who played together and their combined winnings
export async function getTeamCombinationStats(year: number) {
  const rounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: {
      teams: {
        include: {
          roundPlayers: {
            include: {
              player: true,
            },
          },
        },
      },
    },
  });

  // Track team combinations: key is sorted player IDs joined by "|"
  const combinations = new Map<
    string,
    {
      playerIds: string[];
      playerNames: string[];
      totalWinnings: number;
      roundsPlayed: number;
      wins: number; // Times they were top paying team
    }
  >();

  for (const round of rounds) {
    for (const team of round.teams) {
      const playerIds = team.roundPlayers.map((rp) => rp.playerId).sort();
      const key = playerIds.join("|");

      const existing = combinations.get(key) ?? {
        playerIds,
        playerNames: team.roundPlayers
          .map((rp) => rp.player.nickname || rp.player.fullName)
          .sort(),
        totalWinnings: 0,
        roundsPlayed: 0,
        wins: 0,
      };

      existing.totalWinnings += Number(team.totalPayout);
      existing.roundsPlayed += 1;
      if (team.isTopPayingTeam) {
        existing.wins += 1;
      }

      combinations.set(key, existing);
    }
  }

  // Convert to array and sort by winnings
  return Array.from(combinations.values())
    .filter((c) => c.roundsPlayed > 0)
    .sort((a, b) => b.totalWinnings - a.totalWinnings);
}

// Get pair combination winnings for a year
// Tracks every pair of players who have played on the same team together
export async function getPairCombinationStats(year: number) {
  const rounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: {
      teams: {
        include: {
          roundPlayers: {
            include: {
              player: true,
            },
          },
        },
      },
    },
  });

  // Track pairs: key is sorted player IDs joined by "|"
  const pairs = new Map<
    string,
    {
      playerIds: [string, string];
      playerNames: [string, string];
      totalWinnings: number;
      roundsPlayed: number;
      wins: number;
    }
  >();

  for (const round of rounds) {
    for (const team of round.teams) {
      const players = team.roundPlayers.map((rp) => ({
        id: rp.playerId,
        name: rp.player.nickname || rp.player.fullName,
      }));

      // Generate all pairs from this team
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const p1 = players[i];
          const p2 = players[j];

          // Sort by ID to ensure consistent key
          const sorted = [p1, p2].sort((a, b) => a.id.localeCompare(b.id));
          const key = `${sorted[0].id}|${sorted[1].id}`;

          const existing = pairs.get(key) ?? {
            playerIds: [sorted[0].id, sorted[1].id] as [string, string],
            playerNames: [sorted[0].name, sorted[1].name] as [string, string],
            totalWinnings: 0,
            roundsPlayed: 0,
            wins: 0,
          };

          // Each pair gets the full team payout attributed to them
          existing.totalWinnings += Number(team.totalPayout);
          existing.roundsPlayed += 1;
          if (team.isTopPayingTeam) {
            existing.wins += 1;
          }

          pairs.set(key, existing);
        }
      }
    }
  }

  // Convert to array and sort by winnings
  return Array.from(pairs.values())
    .filter((p) => p.roundsPlayed > 0)
    .sort((a, b) => b.totalWinnings - a.totalWinnings);
}
