"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { RoundStatus, VisibilityMode, BlindRevealMode } from "@prisma/client";
import { validateEvenTeams } from "@/lib/scoring-engine";
import {
  getActivePar3Contests,
  getPar3ContestConfig,
  getPar3ContestParticipantIds,
} from "@/lib/par3-contests";
import { getPar3ContestTotalPotDecimal } from "@/lib/par3-contests.server";
import { getTeamDisplayLabel } from "@/lib/team-labels";

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
  formatConfig?: Record<string, unknown>;
}

export interface UpdateRoundDraftData {
  name?: string;
  date?: Date;
  courseId?: string;
  formatId?: string;
  buyInPerPlayer?: number;
  visibility?: VisibilityMode;
  blindRevealMode?: BlindRevealMode;
  formatConfig?: Record<string, unknown>;
}

export interface UpdateLiveRoundFormatData {
  formatConfig?: Record<string, unknown>;
}

function mergeRoundFormatConfig(
  existingConfig: Prisma.JsonValue | null,
  updates: Record<string, unknown>
) {
  return {
    ...((existingConfig as Prisma.JsonObject | null) ?? {}),
    ...updates,
  } as Prisma.InputJsonValue;
}

export async function setRoundLockCode(id: string, code: string) {
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Lock code must be exactly 4 digits");
  }

  const round = await prisma.round.findUnique({
    where: { id },
  });

  if (!round) throw new Error("Round not found");
  if (round.lockCode) {
    throw new Error("Round already has a lock code");
  }
  if (round.status !== "DRAFT" && round.status !== "LIVE") {
    throw new Error("Can only set a lock code for draft or live rounds");
  }

  await prisma.round.update({
    where: { id },
    data: { lockCode: code },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/setup`);
  revalidatePath(`/rounds/${id}/scoring`);
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
      formatConfig: (data.formatConfig as Prisma.InputJsonValue | undefined) ?? undefined,
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
      formatConfig:
        data.formatConfig === undefined
          ? undefined
          : ((data.formatConfig as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull),
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

export async function updateLiveRoundFormat(
  id: string,
  unlockCode: string,
  data: UpdateLiveRoundFormatData
) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      teams: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "LIVE") {
    throw new Error("Can only update format settings while the round is LIVE");
  }
  if (!round.lockCode) {
    throw new Error("Round has no lock code set");
  }
  if (round.lockCode !== unlockCode) {
    throw new Error("Invalid lock code");
  }

  const updated = await prisma.round.update({
    where: { id },
    data: {
      formatConfig:
        data.formatConfig === undefined
          ? undefined
          : ((data.formatConfig as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull),
    },
    include: {
      course: { include: { holes: true } },
      format: true,
      teams: { include: { roundPlayers: { include: { player: true } } } },
      roundPlayers: { include: { player: true, team: true } },
      holeScores: true,
      holeResults: true,
    },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/scoring`);
  revalidatePath(`/rounds/${id}/summary`);
  return updated;
}

export async function updateRoundBurgerSelections(
  id: string,
  selectedPlayerIds: string[]
) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      roundPlayers: {
        select: {
          playerId: true,
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (!["LIVE", "FINISHED"].includes(round.status)) {
    throw new Error("Burger selections can only be updated once the round has started");
  }

  const validPlayerIds = new Set(round.roundPlayers.map((roundPlayer) => roundPlayer.playerId));
  const normalizedSelections = [...new Set(selectedPlayerIds)].filter((playerId) =>
    validPlayerIds.has(playerId)
  );

  await prisma.round.update({
    where: { id },
    data: {
      formatConfig: mergeRoundFormatConfig(round.formatConfig, {
        burgerOrders: {
          selectedPlayerIds: normalizedSelections,
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  });

  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/scoring`);
  revalidatePath(`/rounds/${id}/summary`);
  revalidatePath(`/rounds/${id}/final-payouts`);

  return {
    selectedPlayerIds: normalizedSelections,
  };
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

export async function reopenRound(id: string, unlockCode: string) {
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
  if (!round.lockCode) {
    throw new Error("This round cannot be reopened because it has no lock code");
  }
  if (round.lockCode !== unlockCode) {
    throw new Error("Invalid lock code");
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
  revalidatePath("/rounds");
  revalidatePath("/leaderboard");
}

export async function getRoundLog() {
  const rounds = await prisma.round.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      course: true,
      format: true,
      roundPlayers: {
        include: {
          player: true,
        },
      },
      teams: {
        orderBy: { teamNumber: "asc" },
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

  return rounds.map((round) => ({
    id: round.id,
    name: round.name,
    date: round.date,
    status: round.status,
    hasLockCode: !!round.lockCode,
    courseName: round.course.name,
    formatName: round.format.name,
    playerCount: round.roundPlayers.length,
    teamCount: round.teams.length,
    topTeamLabels: round.teams
      .filter((team) => team.isTopPayingTeam)
      .map((team) => getTeamDisplayLabel(team.roundPlayers)),
  }));
}

export async function setRoundPlayers(id: string, playerIds: string[]) {
  console.log("[setRoundPlayers] Called with:", { roundId: id, playerCount: playerIds.length });

  const round = await prisma.round.findUnique({ where: { id } });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only set players while in DRAFT status");
  }
  if (round.lockCode) {
    throw new Error("Teams are locked. Unlock them first to make changes.");
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
  const result = await prisma.roundPlayer.createMany({
    data: playerIds.map((playerId) => ({
      roundId: id,
      playerId,
    })),
  });

  console.log("[setRoundPlayers] Created round players:", result.count);

  revalidatePath(`/rounds/${id}`);
}

export async function startRound(id: string, startingHole: 1 | 10) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      teams: { include: { roundPlayers: true } },
      roundPlayers: { include: { player: true } },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only start rounds in DRAFT status");
  }
  if (round.teams.length === 0) {
    throw new Error("Teams must be generated before starting");
  }
  if (!round.lockCode) {
    throw new Error("Lock teams with a 4-digit code before starting the round");
  }

  if (round.formatId === "vegas") {
    if (round.teamSize !== 2) {
      throw new Error("Vegas requires teams of 2");
    }

    const vegasMatchups = (round.formatConfig as {
      vegasMatchups?: Array<{ teamId: string; opponentTeamId: string }>;
    } | null)?.vegasMatchups;

    if (!vegasMatchups || vegasMatchups.length !== round.teams.length) {
      throw new Error("Vegas requires explicit team matchups before starting");
    }

    const teamIds = new Set(round.teams.map((team) => team.id));
    const seenTeams = new Set<string>();

    for (const matchup of vegasMatchups) {
      if (
        !matchup.teamId ||
        !matchup.opponentTeamId ||
        matchup.teamId === matchup.opponentTeamId
      ) {
        throw new Error("Vegas matchups must pair each team with another team");
      }
      if (!teamIds.has(matchup.teamId) || !teamIds.has(matchup.opponentTeamId)) {
        throw new Error("Vegas matchups include a team that is not in this round");
      }
      seenTeams.add(matchup.teamId);
      const reverse = vegasMatchups.find(
        (entry) =>
          entry.teamId === matchup.opponentTeamId &&
          entry.opponentTeamId === matchup.teamId
      );
      if (!reverse) {
        throw new Error("Vegas matchups must be reciprocal");
      }
    }

    if (seenTeams.size !== round.teams.length) {
      throw new Error("Vegas matchups must include every team exactly once");
    }
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
  const roundPlayerIds = round.roundPlayers.map((roundPlayer) => roundPlayer.playerId);
  const par3ContestConfig = getPar3ContestConfig(
    round.formatConfig as Record<string, unknown> | null
  );
  const includedPar3Pot =
    par3ContestConfig?.enabled &&
    par3ContestConfig.fundingType === "INCLUDED_IN_MAIN_BUY_IN"
      ? getPar3ContestTotalPotDecimal(par3ContestConfig, roundPlayerIds)
      : new Decimal(0);

  if (includedPar3Pot.gt(round.buyInPerPlayer.mul(playerCount))) {
    throw new Error("Par 3 contest amount cannot exceed the main buy-in pot");
  }

  if (par3ContestConfig?.enabled && getActivePar3Contests(par3ContestConfig).length === 0) {
    throw new Error("Enable at least one par 3 contest or turn the par 3 contest off");
  }

  if (
    par3ContestConfig?.enabled &&
    getPar3ContestParticipantIds(par3ContestConfig, roundPlayerIds).length === 0
  ) {
    throw new Error("Choose at least one Par 3 contest participant");
  }

  const pot = round.buyInPerPlayer.mul(playerCount).sub(includedPar3Pot);
  const baseSkinValue = pot.div(18);

  await prisma.$transaction(
    round.roundPlayers
      .filter((roundPlayer) => roundPlayer.eventHandicapLockedAt === null)
      .map((roundPlayer) =>
        prisma.roundPlayer.update({
          where: { id: roundPlayer.id },
          data: {
            eventHandicapIndex:
              roundPlayer.player.handicapIndex === null
                ? null
                : new Decimal(roundPlayer.player.handicapIndex),
            eventHandicapLockedAt: new Date(),
          },
        })
      )
  );

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

// Revert a LIVE round back to DRAFT (requires unlock code)
export async function revertToDraft(id: string, unlockCode: string) {
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      teams: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "LIVE") {
    throw new Error("Can only revert rounds that are LIVE");
  }
  if (!round.lockCode) {
    throw new Error("Round has no lock code set");
  }
  if (round.lockCode !== unlockCode) {
    throw new Error("Invalid unlock code");
  }

  // Clear all hole scores
  await prisma.holeScore.deleteMany({ where: { roundId: id } });

  // Reset team finishedScoring flags
  await prisma.team.updateMany({
    where: { roundId: id },
    data: { finishedScoring: false },
  });

  // Revert round to DRAFT and clear pot/baseSkinValue
  await prisma.round.update({
    where: { id },
    data: {
      status: "DRAFT",
      pot: null,
      baseSkinValue: null,
      startingHole: 1,
    },
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${id}`);
  revalidatePath(`/rounds/${id}/setup`);
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
    handicapIndex: player.handicapIndex !== null ? Number(player.handicapIndex) : null,
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
      eventHandicapIndex:
        rp.eventHandicapIndex !== null ? Number(rp.eventHandicapIndex) : null,
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
