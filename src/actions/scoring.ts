"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { HoleEntryType, Prisma, RoundStatus } from "@prisma/client";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";
import {
  calculateRoundResults,
  areAllHolesComplete,
  resolveCarryoverTiebreaker,
  calculatePlayerPayouts,
  findTopPayingTeams,
  TeamScore,
} from "@/lib/scoring-engine";
import { getScoringOrder } from "@/lib/scoring-order";

export interface ScoreEntry {
  entryType: HoleEntryType;
  value?: number | null;
  selectedDrivePlayerId?: string | null;
}

export async function upsertHoleScore(
  roundId: string,
  teamId: string,
  holeNumber: number,
  entry: ScoreEntry
) {
  // Validate entry
  if (entry.entryType === "VALUE") {
    if (!entry.value || entry.value <= 0) {
      throw new Error("Value must be a positive integer");
    }
  }

  // Single query to check round status and get existing score
  const [round, existingScore, team] = await Promise.all([
    prisma.round.findUnique({
      where: { id: roundId },
      select: { status: true },
    }),
    prisma.holeScore.findUnique({
      where: {
        roundId_teamId_holeNumber: {
          roundId,
          teamId,
          holeNumber,
        },
      },
      select: { entryType: true, value: true, wasEdited: true, holeData: true },
    }),
    entry.selectedDrivePlayerId !== undefined
      ? prisma.team.findFirst({
          where: {
            id: teamId,
            roundId,
          },
          include: {
            roundPlayers: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!round) throw new Error("Round not found");
  if (entry.selectedDrivePlayerId !== undefined) {
    if (!team) {
      throw new Error("Team not found in this round");
    }
    if (
      entry.selectedDrivePlayerId !== null &&
      !team.roundPlayers.some(
        (roundPlayer) => roundPlayer.playerId === entry.selectedDrivePlayerId
      )
    ) {
      throw new Error("Selected drive player does not belong to this team");
    }
  }

  const nextHoleData =
    entry.selectedDrivePlayerId === undefined
      ? existingScore?.holeData
      : {
          ...((existingScore?.holeData as Record<string, unknown> | null) ?? {}),
          drivePlayerId: entry.selectedDrivePlayerId,
        };
  if (round.status !== "LIVE") {
    throw new Error("Can only enter scores while round is LIVE");
  }

  const isEdit =
    existingScore &&
    existingScore.entryType !== "BLANK" &&
    (existingScore.entryType !== entry.entryType ||
      existingScore.value !== entry.value);

  // Upsert the score - no recalculation needed during live play
  // Final results are calculated when round is finished
  await prisma.holeScore.upsert({
    where: {
      roundId_teamId_holeNumber: {
        roundId,
        teamId,
        holeNumber,
      },
    },
    update: {
      entryType: entry.entryType,
      value: entry.entryType === "VALUE" ? entry.value : null,
      holeData: nextHoleData as Prisma.InputJsonValue | undefined,
      wasEdited: existingScore?.wasEdited || isEdit || false,
    },
    create: {
      roundId,
      teamId,
      holeNumber,
      entryType: entry.entryType,
      value: entry.entryType === "VALUE" ? entry.value : null,
      holeData: nextHoleData as Prisma.InputJsonValue | undefined,
      wasEdited: false,
    },
  });

  // Skip recalculation - it's expensive and only needed for display
  // Live skins status is calculated on-demand when user views it
  // Final results are calculated at finishRound
}

export async function recalculateRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      course: { include: { holes: true } },
      teams: { include: { roundPlayers: true } },
      holeScores: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (!round.startingHole || !round.pot || !round.baseSkinValue) {
    return; // Not ready for calculation
  }

  // Prepare data for scoring engine
  const allScores: TeamScore[] = round.holeScores.map((hs) => ({
    teamId: hs.teamId,
    holeNumber: hs.holeNumber,
    entryType: hs.entryType,
    value: hs.value,
  }));

  const teams = round.teams.map((t) => ({
    id: t.id,
    teamNumber: t.teamNumber,
  }));

  const courseHoles = round.course.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: h.par,
    handicapRank: h.handicapRank,
  }));

  // Calculate results
  const { holeResults, teamPayouts, unresolvedCarryover } =
    calculateRoundResults(
      allScores,
      teams,
      round.startingHole,
      round.pot,
      courseHoles
    );

  // Update hole results in database
  for (const result of holeResults) {
    await prisma.holeResult.upsert({
      where: {
        roundId_holeNumber: {
          roundId,
          holeNumber: result.holeNumber,
        },
      },
      update: {
        winnerTeamId: result.winnerTeamId,
        isTie: result.isTie,
        carrySkinsUsed: result.carrySkinsUsed,
        holePayout: result.holePayout,
      },
      create: {
        roundId,
        holeNumber: result.holeNumber,
        winnerTeamId: result.winnerTeamId,
        isTie: result.isTie,
        carrySkinsUsed: result.carrySkinsUsed,
        holePayout: result.holePayout,
      },
    });
  }

  // Update team totals (for intermediate display, final set on finish)
  for (const [teamId, payout] of teamPayouts) {
    await prisma.team.update({
      where: { id: teamId },
      data: { totalPayout: payout },
    });
  }
}

export async function finishRound(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      format: true,
      course: { include: { holes: true } },
      teams: { include: { roundPlayers: { include: { player: true } } } },
      holeScores: true,
      holeResults: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "LIVE") {
    throw new Error("Can only finish rounds in LIVE status");
  }
  if (!round.startingHole || !round.pot || !round.baseSkinValue) {
    throw new Error("Round is missing required data");
  }

  const formatDefinition =
    FORMAT_DEFINITIONS.find((definition) => definition.id === round.formatId) ??
    FORMAT_DEFINITIONS.find((definition) => definition.name === round.format.name) ??
    null;

  if (formatDefinition && formatDefinition.formatCategory !== "skins") {
    const allTeamsComplete = round.teams.every((team) => {
      const completedScores = round.holeScores.filter(
        (holeScore) =>
          holeScore.teamId === team.id && holeScore.entryType !== "BLANK"
      );
      return completedScores.length === 18;
    });

    if (!allTeamsComplete) {
      throw new Error("All teams must have 18 completed holes before finishing");
    }

    await prisma.$transaction(async (tx) => {
      await tx.team.updateMany({
        where: { roundId },
        data: {
          totalPayout: new Decimal(0),
          isTopPayingTeam: false,
        },
      });

      await tx.roundPlayer.updateMany({
        where: { roundId },
        data: {
          payoutAmount: new Decimal(0),
          wasOnTopPayingTeam: false,
        },
      });

      await tx.holeResult.deleteMany({
        where: { roundId },
      });

      await tx.round.update({
        where: { id: roundId },
        data: {
          status: "FINISHED",
          tiebreakerTeamId: null,
          tiebreakerHoleNum: null,
          tiebreakerSkinsWon: null,
        },
      });

      await tx.roundMessage.updateMany({
        where: { roundId },
        data: {
          imageDataUrl: null,
          imageMimeType: null,
          imageName: null,
        },
      });
    });

    revalidatePath("/");
    revalidatePath(`/rounds/${roundId}`);
    revalidatePath(`/rounds/${roundId}/summary`);
    revalidatePath("/leaderboard");
    return;
  }

  // Verify all holes are complete
  const allScores: TeamScore[] = round.holeScores.map((hs) => ({
    teamId: hs.teamId,
    holeNumber: hs.holeNumber,
    entryType: hs.entryType,
    value: hs.value,
  }));

  const teams = round.teams.map((t) => ({
    id: t.id,
    teamNumber: t.teamNumber,
  }));

  if (!areAllHolesComplete(allScores, teams, round.startingHole)) {
    throw new Error("All holes must be scored before finishing");
  }

  const courseHoles = round.course.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: h.par,
    handicapRank: h.handicapRank,
  }));

  // Calculate final results
  const { holeResults, teamPayouts, unresolvedCarryover } =
    calculateRoundResults(
      allScores,
      teams,
      round.startingHole,
      round.pot,
      courseHoles
    );

  // Handle end-of-round carryover tiebreaker if needed
  const finalTeamPayouts = teamPayouts;
  let tiebreakerInfo: {
    winnerTeamId: string | null;
    decidingHoleNumber: number | null;
    skinsWon: number;
  } | null = null;

  if (unresolvedCarryover > 0) {
    const tiebreakerResult = resolveCarryoverTiebreaker(
      allScores,
      teams,
      courseHoles,
      unresolvedCarryover,
      round.baseSkinValue
    );

    tiebreakerInfo = {
      winnerTeamId: tiebreakerResult.winnerTeamId,
      decidingHoleNumber: tiebreakerResult.decidingHoleNumber,
      skinsWon: tiebreakerResult.skinsWon,
    };

    // Merge additional payouts
    for (const [teamId, additional] of tiebreakerResult.additionalPayouts) {
      const current = finalTeamPayouts.get(teamId) ?? new Decimal(0);
      finalTeamPayouts.set(teamId, current.add(additional));
    }
  }

  // Find top-paying teams
  const topTeamIds = findTopPayingTeams(finalTeamPayouts);

  // Calculate player payouts
  const teamMembers = new Map<string, string[]>();
  for (const team of round.teams) {
    teamMembers.set(
      team.id,
      team.roundPlayers.map((rp) => rp.playerId)
    );
  }
  const playerPayouts = calculatePlayerPayouts(finalTeamPayouts, teamMembers);

  // Update database in transaction
  await prisma.$transaction(async (tx) => {
    // Update hole results
    for (const result of holeResults) {
      await tx.holeResult.upsert({
        where: {
          roundId_holeNumber: {
            roundId,
            holeNumber: result.holeNumber,
          },
        },
        update: {
          winnerTeamId: result.winnerTeamId,
          isTie: result.isTie,
          carrySkinsUsed: result.carrySkinsUsed,
          holePayout: result.holePayout,
        },
        create: {
          roundId,
          holeNumber: result.holeNumber,
          winnerTeamId: result.winnerTeamId,
          isTie: result.isTie,
          carrySkinsUsed: result.carrySkinsUsed,
          holePayout: result.holePayout,
        },
      });
    }

    // Update teams
    for (const team of round.teams) {
      const payout = finalTeamPayouts.get(team.id) ?? new Decimal(0);
      const isTop = topTeamIds.includes(team.id);

      await tx.team.update({
        where: { id: team.id },
        data: {
          totalPayout: payout,
          isTopPayingTeam: isTop,
        },
      });
    }

    // Update round players
    for (const team of round.teams) {
      const isTop = topTeamIds.includes(team.id);

      for (const rp of team.roundPlayers) {
        const payout = playerPayouts.get(rp.playerId) ?? new Decimal(0);

        await tx.roundPlayer.update({
          where: { id: rp.id },
          data: {
            payoutAmount: payout,
            wasOnTopPayingTeam: isTop,
          },
        });
      }
    }

    // Set round to FINISHED with tiebreaker info
    await tx.round.update({
      where: { id: roundId },
      data: {
        status: "FINISHED",
        tiebreakerTeamId: tiebreakerInfo?.winnerTeamId ?? null,
        tiebreakerHoleNum: tiebreakerInfo?.decidingHoleNumber ?? null,
        tiebreakerSkinsWon: tiebreakerInfo?.skinsWon ?? null,
      },
    });

    await tx.roundMessage.updateMany({
      where: { roundId },
      data: {
        imageDataUrl: null,
        imageMimeType: null,
        imageName: null,
      },
    });

    // Update season stats
    const year = round.date.getFullYear();
    const buyIn = round.buyInPerPlayer;

    for (const team of round.teams) {
      const isTop = topTeamIds.includes(team.id);

      for (const rp of team.roundPlayers) {
        const payout = playerPayouts.get(rp.playerId) ?? new Decimal(0);

        await tx.seasonPlayerStat.upsert({
          where: {
            year_playerId: {
              year,
              playerId: rp.playerId,
            },
          },
          update: {
            totalWinnings: { increment: payout },
            totalBuyInsPaid: { increment: buyIn },
            roundsPlayed: { increment: 1 },
            topTeamAppearances: isTop ? { increment: 1 } : undefined,
          },
          create: {
            year,
            playerId: rp.playerId,
            totalWinnings: payout,
            totalBuyInsPaid: buyIn,
            roundsPlayed: 1,
            topTeamAppearances: isTop ? 1 : 0,
          },
        });
      }
    }
  });

  revalidatePath("/");
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/leaderboard");
}

export async function getHoleView(
  roundId: string,
  holeNumber: number,
  teamIdContext?: string | null
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      course: { include: { holes: true } },
      teams: {
        orderBy: { teamNumber: "asc" },
        include: {
          roundPlayers: { include: { player: true } },
        },
      },
      holeScores: {
        where: { holeNumber },
      },
      holeResults: {
        where: { holeNumber },
      },
    },
  });

  if (!round) throw new Error("Round not found");

  const hole = round.course.holes.find((h) => h.holeNumber === holeNumber);
  if (!hole) throw new Error("Hole not found");

  const holeResult = round.holeResults[0] ?? null;
  const isBlind = round.visibility === "BLIND";
  const isLive = round.status === "LIVE";

  // Check if hole is complete
  const isHoleComplete = round.teams.every((team) => {
    const score = round.holeScores.find((hs) => hs.teamId === team.id);
    return score && score.entryType !== "BLANK";
  });

  // Shape response based on visibility rules
  const teamScores = round.teams.map((team) => {
    const score = round.holeScores.find((hs) => hs.teamId === team.id);
    const isOwnTeam = teamIdContext === team.id;

    // Determine what to show
    let showValue = true;
    let showResult = true;

    if (isBlind && isLive) {
      if (round.blindRevealMode === "REVEAL_AFTER_ROUND") {
        // Show only own team, placeholders for others
        showValue = isOwnTeam;
        showResult = false;
      } else if (round.blindRevealMode === "REVEAL_AFTER_HOLE") {
        // Show values only after hole complete
        showValue = isOwnTeam || isHoleComplete;
        showResult = isHoleComplete;
      }
    }

    return {
      teamId: team.id,
      teamNumber: team.teamNumber,
      players: team.roundPlayers.map((rp) => ({
        id: rp.player.id,
        name: rp.player.nickname || rp.player.fullName,
      })),
      entryType: showValue ? score?.entryType ?? "BLANK" : null,
      value: showValue ? score?.value ?? null : null,
      grossScore: showValue ? score?.grossScore ?? null : null,
      holeData: showValue ? (score?.holeData as Record<string, unknown> | null) ?? null : null,
      wasEdited: showValue ? score?.wasEdited ?? false : false,
      hasEntry: score ? score.entryType !== "BLANK" : false,
    };
  });

  return {
    holeNumber,
    par: hole.par,
    handicapRank: hole.handicapRank,
    isComplete: isHoleComplete,
    teamScores,
    result:
      !isBlind || !isLive || (round.blindRevealMode === "REVEAL_AFTER_HOLE" && isHoleComplete)
        ? {
            winnerTeamId: holeResult?.winnerTeamId ?? null,
            isTie: holeResult?.isTie ?? false,
          }
        : null,
    // Never show payouts during LIVE
    payout: !isLive && holeResult ? holeResult.holePayout : null,
  };
}

export async function getTeamScorecard(roundId: string, teamId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      course: { include: { holes: { orderBy: { holeNumber: "asc" } } } },
      holeScores: {
        where: { teamId },
      },
    },
  });

  if (!round) throw new Error("Round not found");

  return round.course.holes.map((hole) => {
    const score = round.holeScores.find((hs) => hs.holeNumber === hole.holeNumber);
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      entryType: score?.entryType ?? null,
      value: score?.value ?? null,
      grossScore: score?.grossScore ?? null,
      displayScore: (score?.holeData as { displayScore?: string } | null)?.displayScore ?? null,
    };
  });
}

// Get each team's scoring progress and finish status (combined to reduce API calls)
export async function getTeamsProgress(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: {
        orderBy: { teamNumber: "asc" },
        include: {
          roundPlayers: { include: { player: true } },
        },
      },
      holeScores: true,
    },
  });

  if (!round) throw new Error("Round not found");

  return round.teams.map((team) => {
    const teamScores = round.holeScores.filter(
      (hs) => hs.teamId === team.id && hs.entryType !== "BLANK"
    );

    return {
      teamId: team.id,
      teamNumber: team.teamNumber,
      players: team.roundPlayers.map((rp) => ({
        id: rp.player.id,
        name: rp.player.nickname || rp.player.fullName,
      })),
      holesScored: teamScores.length,
      scoredHoles: teamScores.map((s) => s.holeNumber),
      finishedScoring: team.finishedScoring,
    };
  });
}

// Get live skins status - calculates on-the-fly from scores (NOT stored holeResults)
// holeResults are only stored at round finish, so we must compute live
export async function getLiveSkinsStatus(roundId: string, startingHole: number) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: { orderBy: { teamNumber: "asc" } },
      holeScores: true,
      course: { include: { holes: true } },
    },
  });

  if (!round) throw new Error("Round not found");

  const scoringOrder = getScoringOrder(startingHole);
  const teamCount = round.teams.length;

  // Map scores to TeamScore format for the engine
  const allScores: TeamScore[] = round.holeScores.map((hs) => ({
    teamId: hs.teamId,
    holeNumber: hs.holeNumber,
    entryType: hs.entryType as HoleEntryType,
    value: hs.value,
  }));

  // Calculate live results using the scoring engine (same logic as finishRound)
  const pot = round.pot ?? new Decimal(0);
  const courseHoles = round.course.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: h.par,
    handicapRank: h.handicapRank,
  }));

  const { holeResults } = calculateRoundResults(
    allScores,
    round.teams,
    startingHole,
    pot,
    courseHoles
  );

  const holeResultsMap = new Map(holeResults.map((hr) => [hr.holeNumber, hr]));

  return scoringOrder.map((holeNumber) => {
    const holeInfo = round.course.holes.find((h) => h.holeNumber === holeNumber);
    const scoresForHole = round.holeScores.filter(
      (hs) => hs.holeNumber === holeNumber && hs.entryType !== "BLANK"
    );
    const result = holeResultsMap.get(holeNumber);
    const isComplete = scoresForHole.length === teamCount;

    return {
      holeNumber,
      par: holeInfo?.par ?? 4,
      teamsScored: scoresForHole.length,
      totalTeams: teamCount,
      isComplete,
      result: isComplete && result
        ? {
            winnerTeamId: result.winnerTeamId,
            winnerTeamNumber: result.winnerTeamId
              ? round.teams.find((t) => t.id === result.winnerTeamId)?.teamNumber ?? null
              : null,
            isTie: result.isTie,
            carryover: result.carrySkinsUsed > 1,
            skinsWon: result.carrySkinsUsed,
            holePayout: Number(result.holePayout),
          }
        : null,
    };
  });
}

// Mark a team as finished scoring
export async function markTeamFinished(roundId: string, teamId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: true,
      holeScores: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "LIVE") {
    throw new Error("Round is not live");
  }

  // Verify team belongs to this round
  const team = round.teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found in this round");

  // Check that team has scored all 18 holes
  const teamScores = round.holeScores.filter(
    (hs) => hs.teamId === teamId && hs.entryType !== "BLANK"
  );
  if (teamScores.length < 18) {
    throw new Error(`Team has only scored ${teamScores.length}/18 holes`);
  }

  // Mark team as finished
  await prisma.team.update({
    where: { id: teamId },
    data: { finishedScoring: true },
  });

  revalidatePath(`/rounds/${roundId}/scoring`);

  // Check if all teams are now finished
  const updatedRound = await prisma.round.findUnique({
    where: { id: roundId },
    include: { teams: true },
  });

  const allTeamsFinished = updatedRound?.teams.every((t) => t.finishedScoring);

  return { allTeamsFinished };
}

// Get team finish status
export async function getTeamFinishStatus(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: {
        orderBy: { teamNumber: "asc" },
        include: {
          roundPlayers: { include: { player: true } },
        },
      },
      holeScores: true,
    },
  });

  if (!round) throw new Error("Round not found");

  return round.teams.map((team) => {
    const teamScores = round.holeScores.filter(
      (hs) => hs.teamId === team.id && hs.entryType !== "BLANK"
    );

    return {
      teamId: team.id,
      teamNumber: team.teamNumber,
      players: team.roundPlayers.map((rp) => ({
        id: rp.player.id,
        name: rp.player.nickname || rp.player.fullName,
      })),
      holesScored: teamScores.length,
      finishedScoring: team.finishedScoring,
    };
  });
}
