"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { validateEvenTeams } from "@/lib/scoring-engine";

interface PlayerWithHandicap {
  id: string;
  playerId: string;
  handicapIndex: Decimal | null;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function balanceTeams(
  players: PlayerWithHandicap[],
  teamSize: number
): PlayerWithHandicap[][] {
  // Calculate average handicap for players missing one
  const playersWithHandicap = players.filter((p) => p.handicapIndex !== null);
  const averageHandicap =
    playersWithHandicap.length > 0
      ? playersWithHandicap.reduce(
          (sum, p) => sum.add(p.handicapIndex!),
          new Decimal(0)
        ).div(playersWithHandicap.length)
      : new Decimal(15); // Default if no one has handicap

  // Assign effective handicaps
  const playersWithEffective = players.map((p) => ({
    ...p,
    effectiveHandicap: p.handicapIndex ?? averageHandicap,
  }));

  // Sort by handicap (highest first)
  playersWithEffective.sort((a, b) =>
    b.effectiveHandicap.sub(a.effectiveHandicap).toNumber()
  );

  const teamCount = Math.floor(players.length / teamSize);
  const teams: PlayerWithHandicap[][] = Array.from(
    { length: teamCount },
    () => []
  );
  const teamTotals: Decimal[] = Array.from(
    { length: teamCount },
    () => new Decimal(0)
  );

  // Greedy assignment: add each player to team with lowest total
  for (const player of playersWithEffective) {
    let minIdx = 0;
    let minTotal = teamTotals[0];

    for (let i = 1; i < teamCount; i++) {
      if (teamTotals[i].lt(minTotal)) {
        minTotal = teamTotals[i];
        minIdx = i;
      }
    }

    teams[minIdx].push(player);
    teamTotals[minIdx] = teamTotals[minIdx].add(player.effectiveHandicap);
  }

  return teams;
}

export async function generateTeams(
  roundId: string,
  teamSize: number,
  mode: "RANDOM" | "BALANCED"
) {
  console.log("[generateTeams] Called with:", { roundId, teamSize, mode });

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundPlayers: {
        include: { player: true },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only generate teams while in DRAFT status");
  }

  const playerCount = round.roundPlayers.length;
  console.log("[generateTeams] Round players count:", playerCount);

  if (playerCount === 0) {
    throw new Error("No players in round. Please add players first.");
  }

  if (!validateEvenTeams(playerCount, teamSize)) {
    throw new Error(
      `Cannot create even teams: ${playerCount} players is not divisible by team size ${teamSize}`
    );
  }

  // Delete existing teams
  await prisma.team.deleteMany({ where: { roundId } });

  // Prepare players with handicaps
  const players: PlayerWithHandicap[] = round.roundPlayers.map((rp) => ({
    id: rp.id,
    playerId: rp.playerId,
    handicapIndex: rp.player.handicapIndex,
  }));

  let teamAssignments: PlayerWithHandicap[][];

  if (mode === "RANDOM") {
    const shuffled = shuffleArray(players);
    const teamCount = Math.floor(playerCount / teamSize);
    teamAssignments = [];

    for (let i = 0; i < teamCount; i++) {
      teamAssignments.push(shuffled.slice(i * teamSize, (i + 1) * teamSize));
    }
  } else {
    teamAssignments = balanceTeams(players, teamSize);
  }

  // Create teams and assign players
  for (let i = 0; i < teamAssignments.length; i++) {
    const teamPlayers = teamAssignments[i];

    // Calculate team handicap total
    const playersWithHandicap = round.roundPlayers.filter((rp) =>
      teamPlayers.some((tp) => tp.id === rp.id)
    );
    const avgHandicap = calculateAverageHandicap(
      playersWithHandicap.map((rp) => rp.player.handicapIndex)
    );

    const handicapTotal = teamPlayers.reduce((sum, tp) => {
      const player = round.roundPlayers.find((rp) => rp.id === tp.id);
      const hcp = player?.player.handicapIndex ?? avgHandicap;
      return sum.add(hcp ?? new Decimal(0));
    }, new Decimal(0));

    const team = await prisma.team.create({
      data: {
        roundId,
        teamNumber: i + 1,
        handicapTotal, // Always store handicap total regardless of mode
      },
    });

    // Assign players to team
    await prisma.roundPlayer.updateMany({
      where: {
        id: { in: teamPlayers.map((p) => p.id) },
      },
      data: { teamId: team.id },
    });
  }

  // Update round with team settings
  await prisma.round.update({
    where: { id: roundId },
    data: {
      teamSize,
      teamMode: mode,
    },
  });

  revalidatePath(`/rounds/${roundId}`);
}

function calculateAverageHandicap(
  handicaps: (Decimal | null)[]
): Decimal | null {
  const validHandicaps = handicaps.filter((h): h is Decimal => h !== null);
  if (validHandicaps.length === 0) return null;

  return validHandicaps
    .reduce((sum, h) => sum.add(h), new Decimal(0))
    .div(validHandicaps.length);
}

export async function swapTeamMembers(
  roundId: string,
  player1Id: string,
  player2Id: string
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundPlayers: {
        where: {
          playerId: { in: [player1Id, player2Id] },
        },
        include: { team: true, player: true },
      },
      teams: {
        include: {
          roundPlayers: {
            include: { player: true },
          },
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only swap team members while in DRAFT status");
  }

  const rp1 = round.roundPlayers.find((rp) => rp.playerId === player1Id);
  const rp2 = round.roundPlayers.find((rp) => rp.playerId === player2Id);

  if (!rp1 || !rp2) throw new Error("Players not found in round");
  if (!rp1.teamId || !rp2.teamId) throw new Error("Players must be on teams");
  if (rp1.teamId === rp2.teamId) {
    throw new Error("Players are already on the same team");
  }

  // Swap team assignments
  await prisma.$transaction([
    prisma.roundPlayer.update({
      where: { id: rp1.id },
      data: { teamId: rp2.teamId },
    }),
    prisma.roundPlayer.update({
      where: { id: rp2.id },
      data: { teamId: rp1.teamId },
    }),
  ]);

  // Always recalculate team handicap totals after swap
  for (const team of round.teams) {
    const teamPlayers = round.roundPlayers.filter(
      (rp) => rp.teamId === team.id
    );
    // Adjust for the swap
    const adjustedPlayers = teamPlayers.map((rp) => {
      if (rp.playerId === player1Id) {
        return round.roundPlayers.find((r) => r.playerId === player2Id)!;
      }
      if (rp.playerId === player2Id) {
        return round.roundPlayers.find((r) => r.playerId === player1Id)!;
      }
      return rp;
    });

    const avgHandicap = calculateAverageHandicap(
      round.roundPlayers.map((rp) => rp.player.handicapIndex)
    );

    const handicapTotal = adjustedPlayers.reduce((sum, rp) => {
      const hcp = rp.player.handicapIndex ?? avgHandicap;
      return sum.add(hcp ?? new Decimal(0));
    }, new Decimal(0));

    await prisma.team.update({
      where: { id: team.id },
      data: { handicapTotal },
    });
  }

  revalidatePath(`/rounds/${roundId}`);
}

export async function getTeamsWithMissingHandicaps(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundPlayers: {
        include: { player: true },
      },
    },
  });

  if (!round) return [];

  return round.roundPlayers
    .filter((rp) => rp.player.handicapIndex === null)
    .map((rp) => ({
      ...rp.player,
      handicapIndex: null,
    }));
}
