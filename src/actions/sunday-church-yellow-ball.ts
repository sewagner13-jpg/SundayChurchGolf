"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID,
  computeSundayChurchYellowBallHoleData,
  getSundayChurchYellowBallCarrier,
  getSundayChurchYellowBallConfig,
  getSundayChurchYellowBallTeamConfig,
  validateSundayChurchYellowBallHoleInput,
  validateSundayChurchYellowBallOrder,
  type SundayChurchYellowBallHoleInput,
} from "@/lib/sunday-church-yellow-ball-skins";

function assertYellowBallFormat(formatId: string) {
  if (formatId !== SUNDAY_CHURCH_YELLOW_BALL_SKINS_FORMAT_ID) {
    throw new Error("This round is not Sunday Church Yellow Ball Skins.");
  }
}

export async function saveSundayChurchYellowBallOrder(
  roundId: string,
  teamId: string,
  yellowBallOrder: string[]
) {
  await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: { id: roundId },
      select: { status: true, formatId: true },
    });
    const team = await tx.team.findFirst({
      where: { id: teamId, roundId },
      include: { roundPlayers: true },
    });
    if (!round) throw new Error("Round not found.");
    assertYellowBallFormat(round.formatId);
    if (round.status !== "LIVE") {
      throw new Error("Lock the yellow-ball order after the round starts.");
    }
    if (!team) throw new Error("Team not found in this round.");

    const errors = validateSundayChurchYellowBallOrder(
      yellowBallOrder,
      team.roundPlayers.map((roundPlayer) => roundPlayer.playerId)
    );
    if (errors.length > 0) throw new Error(errors[0]);

    const scoreCount = await tx.holeScore.count({
      where: { roundId, teamId, entryType: { not: "BLANK" } },
    });
    if (scoreCount > 0) {
      throw new Error("The yellow-ball order is locked because this team has recorded a score.");
    }

    await tx.team.update({
      where: { id: teamId },
      data: {
        formatConfig: {
          ...((team.formatConfig as Record<string, unknown> | null) ?? {}),
          yellowBallOrder,
        } as Prisma.InputJsonValue,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath(`/rounds/${roundId}/scoring`);
  return { status: "success" as const, message: "Yellow-ball order locked." };
}

export async function saveSundayChurchYellowBallHole(
  roundId: string,
  teamId: string,
  holeNumber: number,
  rawInput: SundayChurchYellowBallHoleInput
) {
  const inputErrors = validateSundayChurchYellowBallHoleInput(rawInput);
  if (inputErrors.length > 0) throw new Error(inputErrors[0]);

  const holeData = await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: { id: roundId },
      include: {
        course: { include: { holes: true } },
        roundPlayers: true,
        teams: {
          where: { id: teamId },
          include: { roundPlayers: true, holeScores: true },
        },
      },
    });
    if (!round) throw new Error("Round not found.");
    assertYellowBallFormat(round.formatId);
    if (round.status !== "LIVE") {
      throw new Error("Scores can only be entered during a live round.");
    }
    const team = round.teams[0];
    if (!team) throw new Error("Team not found in this round.");

    const teamPlayerIds = team.roundPlayers.map((roundPlayer) => roundPlayer.playerId);
    const teamConfig = getSundayChurchYellowBallTeamConfig(team.formatConfig);
    const orderErrors = validateSundayChurchYellowBallOrder(
      teamConfig.yellowBallOrder,
      teamPlayerIds
    );
    if (orderErrors.length > 0) {
      throw new Error("Lock this team's yellow-ball order before scoring.");
    }

    if (holeNumber <= 16 && rawInput.designatedPlayerId !== undefined) {
      throw new Error("The yellow-ball player for holes 1 through 16 is derived from the locked order.");
    }
    const hole17Data = team.holeScores.find((score) => score.holeNumber === 17)
      ?.holeData as { designatedPlayerId?: string } | null | undefined;
    const hole18Data = team.holeScores.find((score) => score.holeNumber === 18)
      ?.holeData as { designatedPlayerId?: string } | null | undefined;
    const designatedPlayerId = getSundayChurchYellowBallCarrier({
      holeNumber,
      yellowBallOrder: teamConfig.yellowBallOrder,
      designatedPlayerId: rawInput.designatedPlayerId,
      previousDesignatedPlayerId: hole17Data?.designatedPlayerId ?? null,
      nextDesignatedPlayerId: hole18Data?.designatedPlayerId ?? null,
    });
    if (!teamPlayerIds.includes(designatedPlayerId)) {
      throw new Error("The yellow-ball player must belong to this team.");
    }

    const yellowBallConfig = getSundayChurchYellowBallConfig(
      round.formatConfig as Record<string, unknown> | null
    );
    const playerHandicapIndexes = Object.fromEntries(
      round.roundPlayers.map((roundPlayer) => [
        roundPlayer.playerId,
        roundPlayer.eventHandicapIndex === null
          ? null
          : Number(roundPlayer.eventHandicapIndex),
      ])
    );
    if (
      yellowBallConfig.useYellowBallHandicaps &&
      Object.values(playerHandicapIndexes).some((handicap) => handicap === null)
    ) {
      throw new Error("Every selected player needs a locked handicap before handicap scoring.");
    }
    const courseHole = round.course.holes.find((hole) => hole.holeNumber === holeNumber);
    if (!courseHole) throw new Error("Course hole not found.");

    const computedHoleData = computeSundayChurchYellowBallHoleData({
      designatedPlayerId,
      yellowBallGrossScore: rawInput.yellowBallGrossScore,
      scrambleGrossScore: rawInput.scrambleGrossScore,
      playerHandicapIndexes,
      handicapRank: courseHole.handicapRank,
      useYellowBallHandicaps: yellowBallConfig.useYellowBallHandicaps,
    });
    const existingScore = team.holeScores.find((score) => score.holeNumber === holeNumber);

    await tx.playerScore.deleteMany({ where: { roundId, teamId, holeNumber } });
    await tx.playerScore.create({
      data: {
        roundId,
        teamId,
        playerId: designatedPlayerId,
        holeNumber,
        grossScore: computedHoleData.yellowBallGrossScore,
        extraData: { isYellowBall: true },
      },
    });
    await tx.holeScore.upsert({
      where: { roundId_teamId_holeNumber: { roundId, teamId, holeNumber } },
      update: {
        entryType: "VALUE",
        value: computedHoleData.combinedScore,
        grossScore: computedHoleData.combinedScore,
        holeData: computedHoleData as unknown as Prisma.InputJsonValue,
        wasEdited: existingScore?.entryType !== "BLANK",
      },
      create: {
        roundId,
        teamId,
        holeNumber,
        entryType: "VALUE",
        value: computedHoleData.combinedScore,
        grossScore: computedHoleData.combinedScore,
        holeData: computedHoleData as unknown as Prisma.InputJsonValue,
      },
    });
    return computedHoleData;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath(`/rounds/${roundId}/scoring`);
  revalidatePath(`/rounds/${roundId}/summary`);
  return {
    status: "success" as const,
    message: `Saved Hole ${holeNumber}: ${holeData.combinedScore}${holeData.handicapApplied ? "•" : ""}`,
    holeData,
  };
}
