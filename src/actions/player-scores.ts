"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";
import {
  computeFormatScore,
  getIrishGolfSegmentFormatId,
  getNassauSegmentFormatId,
  type PlayerInput,
} from "@/lib/format-scoring";
import {
  SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID,
  getEffectiveHoleFormatId,
} from "@/lib/sunday-church-hole-games";
import { CROSS_FOURSOME_66618_FORMAT_ID } from "@/lib/cross-foursome-66618";
import { CROSS_THREESOME_666_FORMAT_ID } from "@/lib/cross-threesome-666";

export interface PlayerScoreEntry {
  roundId: string;
  teamId: string;
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
  extraData?: Record<string, unknown>;
}

export interface PlayerScoreRecord {
  id: string;
  roundId: string;
  teamId: string;
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
  extraData: Record<string, unknown> | null;
}

export interface PlayerHoleScoreInput {
  playerId: string;
  grossScore: number | null;
  extraData?: Record<string, unknown>;
}

function toJsonValue(
  value?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

/** Return all player scores for a round, optionally filtered by hole and/or team. */
export async function getPlayerScores(
  roundId: string,
  options?: { holeNumber?: number; teamId?: string }
): Promise<PlayerScoreRecord[]> {
  const scores = await prisma.playerScore.findMany({
    where: {
      roundId,
      ...(options?.holeNumber !== undefined
        ? { holeNumber: options.holeNumber }
        : {}),
      ...(options?.teamId ? { teamId: options.teamId } : {}),
    },
    orderBy: [{ holeNumber: "asc" }, { playerId: "asc" }],
  });

  return scores.map((s) => ({
    id: s.id,
    roundId: s.roundId,
    teamId: s.teamId,
    playerId: s.playerId,
    holeNumber: s.holeNumber,
    grossScore: s.grossScore,
    extraData: s.extraData as Record<string, unknown> | null,
  }));
}

/** Upsert a single player score. */
export async function upsertPlayerScore(
  entry: PlayerScoreEntry
): Promise<PlayerScoreRecord> {
  const result = await prisma.playerScore.upsert({
    where: {
      roundId_teamId_playerId_holeNumber: {
        roundId: entry.roundId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        holeNumber: entry.holeNumber,
      },
    },
    update: {
      grossScore: entry.grossScore ?? null,
      extraData: toJsonValue(entry.extraData),
    },
    create: {
      roundId: entry.roundId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      holeNumber: entry.holeNumber,
      grossScore: entry.grossScore ?? null,
      extraData: toJsonValue(entry.extraData),
    },
  });

  revalidatePath(`/rounds/${entry.roundId}/scoring`);

  return {
    id: result.id,
    roundId: result.roundId,
    teamId: result.teamId,
    playerId: result.playerId,
    holeNumber: result.holeNumber,
    grossScore: result.grossScore,
    extraData: result.extraData as Record<string, unknown> | null,
  };
}

/** Upsert a batch of player scores atomically. */
export async function upsertPlayerScores(
  entries: PlayerScoreEntry[]
): Promise<{ updated: number }> {
  if (entries.length === 0) return { updated: 0 };

  const upserts = entries.map((entry) =>
    prisma.playerScore.upsert({
      where: {
        roundId_teamId_playerId_holeNumber: {
          roundId: entry.roundId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          holeNumber: entry.holeNumber,
        },
      },
      update: {
        grossScore: entry.grossScore ?? null,
        extraData: toJsonValue(entry.extraData),
      },
      create: {
        roundId: entry.roundId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        holeNumber: entry.holeNumber,
        grossScore: entry.grossScore ?? null,
        extraData: toJsonValue(entry.extraData),
      },
    })
  );

  const results = await prisma.$transaction(upserts);

  if (entries.length > 0) {
    revalidatePath(`/rounds/${entries[0].roundId}/scoring`);
  }

  return { updated: results.length };
}

export async function upsertPlayerScoresForHole(
  roundId: string,
  teamId: string,
  holeNumber: number,
  entries: PlayerHoleScoreInput[],
  overrideDesignatedPlayerId?: string | null
): Promise<{
  updated: number;
  teamGrossScore: number | null;
  displayScore: string | null;
}> {
  if (entries.length === 0) {
    throw new Error("At least one player score is required");
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      format: true,
      course: {
        include: {
          holes: true,
        },
      },
      teams: {
        where: { id: teamId },
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

  if (!round) throw new Error("Round not found");
  if (round.status !== "LIVE") {
    throw new Error("Can only enter player scores while round is LIVE");
  }

  const team = round.teams[0];
  if (!team) throw new Error("Team not found in this round");

  const hole = round.course.holes.find((courseHole) => courseHole.holeNumber === holeNumber);
  if (!hole) throw new Error("Hole not found");

  const formatDefinition =
    FORMAT_DEFINITIONS.find((definition) => definition.id === round.formatId) ??
    FORMAT_DEFINITIONS.find((definition) => definition.name === round.format.name);

  const effectiveFormatId =
    formatDefinition?.id === "irish_golf_6_6_6"
      ? getIrishGolfSegmentFormatId(holeNumber, (round.formatConfig as Record<string, unknown>) ?? {}) ??
        formatDefinition.id
      : formatDefinition?.id === "nassau"
      ? getNassauSegmentFormatId(holeNumber, (round.formatConfig as Record<string, unknown>) ?? {}) ??
        formatDefinition.id
      : getEffectiveHoleFormatId(
          formatDefinition?.id ?? round.formatId,
          holeNumber,
          (round.formatConfig as Record<string, unknown>) ?? {}
        ) ??
        formatDefinition?.id ??
        round.formatId;
  const effectiveFormatDefinition =
    FORMAT_DEFINITIONS.find((definition) => definition.id === effectiveFormatId) ??
    formatDefinition;

  if (!effectiveFormatDefinition?.requiresIndividualScores) {
    throw new Error("This format does not use per-player scoring");
  }

  const submittedPlayerIds = new Set(entries.map((entry) => entry.playerId));
  const teamPlayerIds = new Set(team.roundPlayers.map((roundPlayer) => roundPlayer.playerId));

  for (const playerId of submittedPlayerIds) {
    if (!teamPlayerIds.has(playerId)) {
      throw new Error("One or more submitted players do not belong to this team");
    }
  }

  const scoreEntries = team.roundPlayers.map((roundPlayer) => {
    const submitted = entries.find((entry) => entry.playerId === roundPlayer.playerId);
    return {
      roundId,
      teamId,
      playerId: roundPlayer.playerId,
      holeNumber,
      grossScore: submitted?.grossScore ?? null,
      extraData: submitted?.extraData ?? {},
    };
  });

  const upserts = scoreEntries.map((entry) =>
    prisma.playerScore.upsert({
      where: {
        roundId_teamId_playerId_holeNumber: {
          roundId: entry.roundId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          holeNumber: entry.holeNumber,
        },
      },
      update: {
        grossScore: entry.grossScore,
        extraData: toJsonValue(entry.extraData),
      },
      create: {
        roundId: entry.roundId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        holeNumber: entry.holeNumber,
        grossScore: entry.grossScore,
        extraData: toJsonValue(entry.extraData),
      },
    })
  );

  if (
    (formatDefinition?.id ?? round.formatId) === CROSS_FOURSOME_66618_FORMAT_ID ||
    (formatDefinition?.id ?? round.formatId) === CROSS_THREESOME_666_FORMAT_ID
  ) {
    const crossFormatId = formatDefinition?.id ?? round.formatId;
    await prisma.$transaction([
      ...upserts,
      prisma.holeScore.upsert({
        where: {
          roundId_teamId_holeNumber: {
            roundId,
            teamId,
            holeNumber,
          },
        },
        update: {
          entryType: "VALUE",
          value: null,
          grossScore: null,
          holeData: {
            displayScore: "Entered",
            effectiveFormatId: crossFormatId,
            scoringRole: "physical_group",
          },
        },
        create: {
          roundId,
          teamId,
          holeNumber,
          entryType: "VALUE",
          value: null,
          grossScore: null,
          holeData: {
            displayScore: "Entered",
            effectiveFormatId: crossFormatId,
            scoringRole: "physical_group",
          },
        },
      }),
    ]);

    revalidatePath(`/rounds/${roundId}/scoring`);
    revalidatePath(`/rounds/${roundId}/summary`);

    return {
      updated: scoreEntries.length,
      teamGrossScore: null,
      displayScore: "Entered",
    };
  }

  const usesManualDesignatedPlayer =
    (formatDefinition?.id ?? round.formatId) === SUNDAY_CHURCH_HOLE_GAMES_FORMAT_ID &&
    effectiveFormatDefinition.requiresDesignatedPlayer;

  const players: PlayerInput[] = team.roundPlayers.map((roundPlayer) => {
    const entry = scoreEntries.find((scoreEntry) => scoreEntry.playerId === roundPlayer.playerId);
    return {
      playerId: roundPlayer.playerId,
      playerName: roundPlayer.player.nickname || roundPlayer.player.fullName,
      grossScore: entry?.grossScore ?? null,
      driveSelected: (entry?.extraData?.driveSelected as boolean) ?? false,
    };
  });

  // For lone_ranger, prefer the stored per-team order from formatConfig
  const loneRangerTeamOrder =
    effectiveFormatId === "lone_ranger"
      ? ((round.formatConfig as Record<string, unknown>)
          ?.loneRangerOrder as Record<string, string[]>)?.[teamId] ?? null
      : null;
  const rotationIndex =
    formatDefinition?.id === "nassau"
      ? holeNumber <= 9
        ? holeNumber - 1
        : holeNumber - 10
      : holeNumber - 1;

  const designatedPlayerId =
    usesManualDesignatedPlayer
      ? overrideDesignatedPlayerId ?? null
      : // Client-supplied override (free-pick holes, wolf selection, etc.) wins first
      overrideDesignatedPlayerId !== undefined && overrideDesignatedPlayerId !== null
      ? overrideDesignatedPlayerId
      : effectiveFormatId === "money_ball" || effectiveFormatId === "wolf_team"
      ? team.roundPlayers[rotationIndex % team.roundPlayers.length]?.playerId ?? null
      : effectiveFormatId === "lone_ranger"
      ? loneRangerTeamOrder
        ? loneRangerTeamOrder[rotationIndex % loneRangerTeamOrder.length] ?? null
        : team.roundPlayers[rotationIndex % team.roundPlayers.length]?.playerId ?? null
      : null;

  if (usesManualDesignatedPlayer && !designatedPlayerId) {
    throw new Error("Choose the designated player for this hole");
  }
  if (designatedPlayerId && !teamPlayerIds.has(designatedPlayerId)) {
    throw new Error("Designated player does not belong to this team");
  }

  const moneyBallEntry = designatedPlayerId
    ? scoreEntries.find((entry) => entry.playerId === designatedPlayerId)
    : null;
  const wolfEntry = designatedPlayerId
    ? scoreEntries.find((entry) => entry.playerId === designatedPlayerId)
    : null;

  const result = computeFormatScore(
    effectiveFormatId,
    players,
    holeNumber,
    hole.par,
    {
      designatedPlayerId,
      moneyBallPlayerId: designatedPlayerId,
      moneyBallLost: (moneyBallEntry?.extraData?.moneyBallLost as boolean) ?? false,
      partnerPlayerId:
        (wolfEntry?.extraData?.wolfPartnerPlayerId as string | undefined) ?? null,
    },
    (round.formatConfig as Record<string, unknown>) ?? {}
  );

  if (!result) {
    throw new Error("This format is not supported for live player scoring yet");
  }

  const holeData = {
    ...result.extraData,
    countedPlayerIds: result.countedPlayerIds,
    displayScore: result.teamDisplayScore ?? null,
    effectiveFormatId,
    designatedPlayerId,
  } as Prisma.InputJsonValue;

  await prisma.$transaction([
    ...upserts,
    prisma.holeScore.upsert({
      where: {
        roundId_teamId_holeNumber: {
          roundId,
          teamId,
          holeNumber,
        },
      },
      update: {
        entryType: result.teamGrossScore === null ? "BLANK" : "VALUE",
        value: result.teamGrossScore,
        grossScore: result.teamGrossScore,
        holeData,
      },
      create: {
        roundId,
        teamId,
        holeNumber,
        entryType: result.teamGrossScore === null ? "BLANK" : "VALUE",
        value: result.teamGrossScore,
        grossScore: result.teamGrossScore,
        holeData,
      },
    }),
  ]);

  revalidatePath(`/rounds/${roundId}/scoring`);
  revalidatePath(`/rounds/${roundId}/summary`);

  return {
    updated: scoreEntries.length,
    teamGrossScore: result.teamGrossScore,
    displayScore: result.teamDisplayScore ?? null,
  };
}
