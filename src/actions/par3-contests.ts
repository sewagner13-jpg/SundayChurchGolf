"use server";

import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getActivePar3Contests,
  getPar3ContestConfig,
  type Par3HoleContestResult,
} from "@/lib/par3-contests";
import { getPar3ContestPrizePerHoleDecimal } from "@/lib/par3-contests.server";

interface TeamMemberMapValue {
  roundPlayerId: string;
  playerId: string;
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

  const prizePerHole = getPar3ContestPrizePerHoleDecimal(
    par3ContestConfig,
    round.roundPlayers.length
  );
  const activeContestMap = new Map(
    activeContests.map((contest) => [contest.holeNumber, contest])
  );
  const previousResults = par3ContestConfig.results ?? [];

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

    const delta = prizePerHole.mul(direction);

    if (contest.payoutTarget === "PLAYER") {
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
  results.forEach((result) => applyResultDelta(result, 1));

  const updatedFormatConfig = {
    ...(round.formatConfig as Record<string, unknown> | null),
    par3Contest: {
      ...par3ContestConfig,
      results,
    },
  };

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
        formatConfig: updatedFormatConfig as Prisma.InputJsonValue,
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
  revalidatePath("/leaderboard");
  revalidatePath("/stats");
}
