"use server";

import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getActivePar3Contests,
  getPar3ContestConfig,
  getPar3ContestParticipantIds,
  type Par3PayoutTarget,
  type Par3HoleContestResult,
} from "@/lib/par3-contests";
import {
  getPar3ContestPrizePerHoleDecimal,
  getPar3ContestTotalPotDecimal,
} from "@/lib/par3-contests.server";

interface TeamMemberMapValue {
  roundPlayerId: string;
  playerId: string;
}

function toInputJsonValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.InputJsonObject | Prisma.InputJsonArray | null {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toInputJsonValue(item)) as Prisma.InputJsonArray;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, toInputJsonValue(entryValue)]);

    return Object.fromEntries(entries) as Prisma.InputJsonObject;
  }

  throw new Error("Unsupported value in par 3 contest format config");
}

function addToMap(
  map: Map<string, Decimal>,
  key: string,
  amount: Decimal
) {
  map.set(key, (map.get(key) ?? new Decimal(0)).add(amount));
}

export async function savePar3ContestResults(
  roundId: string,
  results: Par3HoleContestResult[]
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: {
        include: {
          roundPlayers: true,
        },
      },
      roundPlayers: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "FINISHED") {
    throw new Error("Par 3 contest winners can only be entered after the round");
  }

  const par3ContestConfig = getPar3ContestConfig(
    round.formatConfig as Record<string, unknown> | null
  );

  if (!par3ContestConfig?.enabled) {
    throw new Error("Par 3 contest is not enabled for this round");
  }

  const activeContests = getActivePar3Contests(par3ContestConfig);
  if (activeContests.length === 0) {
    throw new Error("No par 3 contests are configured for this round");
  }
  const par3ParticipantIds = getPar3ContestParticipantIds(
    par3ContestConfig,
    round.roundPlayers.map((roundPlayer) => roundPlayer.playerId)
  );

  const prizePerHole = getPar3ContestPrizePerHoleDecimal(
    par3ContestConfig,
    par3ParticipantIds
  );
  const totalAvailablePot = getPar3ContestTotalPotDecimal(
    par3ContestConfig,
    par3ParticipantIds
  );
  const activeContestMap = new Map(
    activeContests.map((contest) => [contest.holeNumber, contest])
  );
  const previousResults = par3ContestConfig.results ?? [];

  const sanitizedResults = results.map((result) => {
    const numericPayout =
      result.payoutAmount === null || result.payoutAmount === undefined
        ? 0
        : Number(result.payoutAmount);

    if (!Number.isFinite(numericPayout) || numericPayout < 0) {
      throw new Error("Par 3 payout amounts must be 0 or greater");
    }

    if (!result.winnerPlayerId && numericPayout > 0) {
      throw new Error("Choose a winner before assigning a Par 3 payout");
    }

    return {
      holeNumber: result.holeNumber,
      winnerPlayerId: result.winnerPlayerId,
      payoutAmount: numericPayout,
      payoutTarget: result.payoutTarget,
    };
  });

  const totalAssignedPayout = sanitizedResults.reduce(
    (sum, result) => sum.add(result.payoutAmount),
    new Decimal(0)
  );

  if (totalAssignedPayout.gt(totalAvailablePot)) {
    throw new Error("Par 3 payouts cannot exceed the available Par 3 pot");
  }

  const playerToRoundPlayerId = new Map(
    round.roundPlayers.map((roundPlayer) => [roundPlayer.playerId, roundPlayer.id])
  );
  const playerToTeamId = new Map<string, string>();
  const teamMembers = new Map<string, TeamMemberMapValue[]>();

  for (const team of round.teams) {
    const members = team.roundPlayers.map((roundPlayer) => ({
      roundPlayerId: roundPlayer.id,
      playerId: roundPlayer.playerId,
    }));
    teamMembers.set(team.id, members);
    for (const member of members) {
      playerToTeamId.set(member.playerId, team.id);
    }
  }

  const teamDeltas = new Map<string, Decimal>();
  const roundPlayerDeltas = new Map<string, Decimal>();
  const seasonStatDeltas = new Map<string, Decimal>();

  function applyResultDelta(
    result: Par3HoleContestResult,
    direction: 1 | -1
  ) {
    if (!result.winnerPlayerId) return;

    const contest = activeContestMap.get(result.holeNumber);
    if (!contest) return;

    const roundPlayerId = playerToRoundPlayerId.get(result.winnerPlayerId);
    if (!roundPlayerId) return;

    const payoutAmount =
      result.payoutAmount === null || result.payoutAmount === undefined
        ? prizePerHole.toNumber()
        : result.payoutAmount;
    const delta = new Decimal(payoutAmount).mul(direction);

    const effectivePayoutTarget =
      result.payoutTarget ?? contest.payoutTarget;

    if (effectivePayoutTarget === "PLAYER") {
      addToMap(roundPlayerDeltas, roundPlayerId, delta);
      addToMap(seasonStatDeltas, result.winnerPlayerId, delta);
      return;
    }

    const teamId = playerToTeamId.get(result.winnerPlayerId);
    if (!teamId) return;

    addToMap(teamDeltas, teamId, delta);

    const members = teamMembers.get(teamId) ?? [];
    if (members.length === 0) return;

    const split = delta.div(members.length);
    for (const member of members) {
      addToMap(roundPlayerDeltas, member.roundPlayerId, split);
      addToMap(seasonStatDeltas, member.playerId, split);
    }
  }

  previousResults.forEach((result) => applyResultDelta(result, -1));
  sanitizedResults.forEach((result) => applyResultDelta(result, 1));

  const jsonResults = sanitizedResults.map(
    (result) =>
      ({
        holeNumber: result.holeNumber,
        winnerPlayerId: result.winnerPlayerId,
        payoutAmount: result.payoutAmount,
        payoutTarget:
          (result.payoutTarget as Par3PayoutTarget | undefined) ?? undefined,
      }) satisfies Prisma.JsonObject
  );

  const updatedFormatConfig = toInputJsonValue({
    ...((round.formatConfig as Prisma.JsonObject | null) ?? {}),
    par3Contest: {
      ...par3ContestConfig,
      results: jsonResults,
    },
  }) as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx) => {
    for (const [teamId, delta] of teamDeltas) {
      await tx.team.update({
        where: { id: teamId },
        data: {
          totalPayout: { increment: delta },
        },
      });
    }

    for (const [roundPlayerId, delta] of roundPlayerDeltas) {
      await tx.roundPlayer.update({
        where: { id: roundPlayerId },
        data: {
          payoutAmount: { increment: delta },
        },
      });
    }

    for (const [playerId, delta] of seasonStatDeltas) {
      await tx.seasonPlayerStat.update({
        where: {
          year_playerId: {
            year: round.date.getFullYear(),
            playerId,
          },
        },
        data: {
          totalWinnings: { increment: delta },
        },
      });
    }

    await tx.round.update({
      where: { id: roundId },
      data: {
        formatConfig: updatedFormatConfig,
      },
    });

    const refreshedTeams = await tx.team.findMany({
      where: { roundId },
      orderBy: { totalPayout: "desc" },
    });

    const topTotal = refreshedTeams[0]?.totalPayout ?? new Decimal(0);
    const topTeamIds = refreshedTeams
      .filter((team) => team.totalPayout.eq(topTotal))
      .map((team) => team.id);

    await Promise.all(
      refreshedTeams.map((team) =>
        tx.team.update({
          where: { id: team.id },
          data: {
            isTopPayingTeam: topTeamIds.includes(team.id) && topTotal.gt(0),
          },
        })
      )
    );

    await Promise.all(
      round.roundPlayers.map((roundPlayer) =>
        tx.roundPlayer.update({
          where: { id: roundPlayer.id },
          data: {
            wasOnTopPayingTeam: topTeamIds.includes(roundPlayer.teamId ?? "") && topTotal.gt(0),
          },
        })
      )
    );
  });

  revalidatePath(`/rounds/${roundId}/summary`);
  revalidatePath(`/rounds/${roundId}/payouts`);
  revalidatePath("/leaderboard");
  revalidatePath("/stats");
}
