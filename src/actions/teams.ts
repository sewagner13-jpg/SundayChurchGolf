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

// Map of "playerId1|playerId2" -> count of times they've been on same team recently
type TeammateHistory = Map<string, number>;

// Get recent teammate pairings from last N finished rounds
async function getRecentTeammateHistory(
  playerIds: string[],
  lookbackRounds: number = 4
): Promise<TeammateHistory> {
  const history: TeammateHistory = new Map();

  // Get the last N finished rounds
  const recentRounds = await prisma.round.findMany({
    where: {
      status: "FINISHED",
    },
    orderBy: { date: "desc" },
    take: lookbackRounds,
    include: {
      teams: {
        include: {
          roundPlayers: true,
        },
      },
    },
  });

  // Build pair counts from each round
  for (const round of recentRounds) {
    for (const team of round.teams) {
      const teamPlayerIds = team.roundPlayers
        .map((rp) => rp.playerId)
        .filter((id) => playerIds.includes(id)); // Only count players in current round

      // Generate all pairs from this team
      for (let i = 0; i < teamPlayerIds.length; i++) {
        for (let j = i + 1; j < teamPlayerIds.length; j++) {
          // Sort IDs to ensure consistent key
          const sorted = [teamPlayerIds[i], teamPlayerIds[j]].sort();
          const key = `${sorted[0]}|${sorted[1]}`;
          history.set(key, (history.get(key) ?? 0) + 1);
        }
      }
    }
  }

  return history;
}

// Get pair key for two player IDs
function getPairKey(id1: string, id2: string): string {
  const sorted = [id1, id2].sort();
  return `${sorted[0]}|${sorted[1]}`;
}

// Calculate total recent pairing count for a team
function getTeamRecentPairingScore(
  teamPlayerIds: string[],
  history: TeammateHistory
): number {
  let score = 0;
  for (let i = 0; i < teamPlayerIds.length; i++) {
    for (let j = i + 1; j < teamPlayerIds.length; j++) {
      const key = getPairKey(teamPlayerIds[i], teamPlayerIds[j]);
      score += history.get(key) ?? 0;
    }
  }
  return score;
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
  teamSize: number,
  history: TeammateHistory
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

  // Group players into tiers by handicap (within 3 strokes = same tier)
  // Then shuffle within each tier before sorting
  const tierSize = 3;
  const tiers: (typeof playersWithEffective)[] = [];

  // Sort first, then group into tiers
  playersWithEffective.sort((a, b) =>
    b.effectiveHandicap.sub(a.effectiveHandicap).toNumber()
  );

  let currentTier: typeof playersWithEffective = [];
  let tierBaseline: Decimal | null = null;

  for (const player of playersWithEffective) {
    if (tierBaseline === null) {
      tierBaseline = player.effectiveHandicap;
      currentTier.push(player);
    } else if (tierBaseline.sub(player.effectiveHandicap).toNumber() <= tierSize) {
      currentTier.push(player);
    } else {
      tiers.push(currentTier);
      currentTier = [player];
      tierBaseline = player.effectiveHandicap;
    }
  }
  if (currentTier.length > 0) {
    tiers.push(currentTier);
  }

  // Shuffle within each tier, then flatten
  const shuffledPlayers = tiers.flatMap((tier) => shuffleArray(tier));

  const teamCount = Math.floor(players.length / teamSize);
  const teams: PlayerWithHandicap[][] = Array.from(
    { length: teamCount },
    () => []
  );
  const teamTotals: Decimal[] = Array.from(
    { length: teamCount },
    () => new Decimal(0)
  );

  // Greedy assignment considering both handicap balance AND recent teammate history
  // But ensure all teams end up with exactly teamSize players
  for (const player of shuffledPlayers) {
    // First, filter to only teams that aren't full yet
    const notFullIndices: number[] = [];
    for (let i = 0; i < teamCount; i++) {
      if (teams[i].length < teamSize) {
        notFullIndices.push(i);
      }
    }

    // If only one team has room, put the player there
    if (notFullIndices.length === 1) {
      const idx = notFullIndices[0];
      teams[idx].push(player);
      teamTotals[idx] = teamTotals[idx].add(player.effectiveHandicap);
      continue;
    }

    // Find minimum total among teams that aren't full
    let minTotal = teamTotals[notFullIndices[0]];
    for (const idx of notFullIndices) {
      if (teamTotals[idx].lt(minTotal)) {
        minTotal = teamTotals[idx];
      }
    }

    const threshold = 2;
    const eligibleIndices: number[] = [];
    for (const idx of notFullIndices) {
      if (teamTotals[idx].sub(minTotal).toNumber() <= threshold) {
        eligibleIndices.push(idx);
      }
    }

    // For each eligible team, calculate how many recent pairings adding this player would create
    const teamScores = eligibleIndices.map((idx) => {
      const currentTeamPlayerIds = teams[idx].map((p) => p.playerId);
      let recentPairings = 0;
      for (const existingPlayerId of currentTeamPlayerIds) {
        const key = getPairKey(player.playerId, existingPlayerId);
        recentPairings += history.get(key) ?? 0;
      }
      return { idx, recentPairings };
    });

    // Find minimum recent pairings
    const minPairings = Math.min(...teamScores.map((s) => s.recentPairings));

    // Filter to teams with minimum recent pairings
    const bestTeams = teamScores.filter((s) => s.recentPairings === minPairings);

    // Pick randomly from best teams (fewest recent pairings)
    const selectedIdx = bestTeams[Math.floor(Math.random() * bestTeams.length)].idx;

    teams[selectedIdx].push(player);
    teamTotals[selectedIdx] = teamTotals[selectedIdx].add(player.effectiveHandicap);
  }

  // Final shuffle of teams order for variety
  return shuffleArray(teams);
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
  if (round.lockCode) {
    throw new Error("Teams are locked. Unlock them first to make changes.");
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

  // Get recent teammate history to avoid putting same players together too often
  const playerIds = players.map((p) => p.playerId);
  const history = await getRecentTeammateHistory(playerIds, 4);
  console.log("[generateTeams] Recent teammate history entries:", history.size);

  let teamAssignments: PlayerWithHandicap[][];

  if (mode === "RANDOM") {
    // For random mode, try multiple shuffles and pick the one with fewest recent pairings
    const teamCount = Math.floor(playerCount / teamSize);
    const maxAttempts = 10;
    let bestAssignment: PlayerWithHandicap[][] = [];
    let bestScore = Infinity;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const shuffled = shuffleArray(players);
      const candidateTeams: PlayerWithHandicap[][] = [];

      for (let i = 0; i < teamCount; i++) {
        candidateTeams.push(shuffled.slice(i * teamSize, (i + 1) * teamSize));
      }

      // Calculate total recent pairing score for this assignment
      let totalScore = 0;
      for (const team of candidateTeams) {
        const teamPlayerIds = team.map((p) => p.playerId);
        totalScore += getTeamRecentPairingScore(teamPlayerIds, history);
      }

      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestAssignment = candidateTeams;
      }

      // If we found a perfect assignment (no recent pairings), stop early
      if (totalScore === 0) break;
    }

    console.log("[generateTeams] Random mode - best pairing score:", bestScore);
    teamAssignments = bestAssignment;
  } else {
    teamAssignments = balanceTeams(players, teamSize, history);
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
  // Fetch ALL round players (not just the two being swapped) for handicap recalculation
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundPlayers: {
        include: { team: true, player: true },
      },
      teams: true,
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only swap team members while in DRAFT status");
  }
  if (round.lockCode) {
    throw new Error("Teams are locked. Unlock them first to make changes.");
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

  // Recalculate team handicap totals after swap
  // Build new team assignments after the swap
  const newTeamAssignments = new Map<string, typeof round.roundPlayers>();

  for (const rp of round.roundPlayers) {
    let teamId = rp.teamId!;
    // Apply the swap
    if (rp.playerId === player1Id) {
      teamId = rp2.teamId;
    } else if (rp.playerId === player2Id) {
      teamId = rp1.teamId;
    }

    if (!newTeamAssignments.has(teamId)) {
      newTeamAssignments.set(teamId, []);
    }
    newTeamAssignments.get(teamId)!.push(rp);
  }

  // Calculate average handicap for missing values
  const avgHandicap = calculateAverageHandicap(
    round.roundPlayers.map((rp) => rp.player.handicapIndex)
  );

  // Update each team's handicap total
  for (const team of round.teams) {
    const teamPlayers = newTeamAssignments.get(team.id) ?? [];

    const handicapTotal = teamPlayers.reduce((sum, rp) => {
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

// Lock teams with a 4-digit code
export async function lockTeams(roundId: string, code: string) {
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Lock code must be exactly 4 digits");
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
  });

  if (!round) throw new Error("Round not found");
  if (round.lockCode) {
    throw new Error("Teams are already locked");
  }

  await prisma.round.update({
    where: { id: roundId },
    data: { lockCode: code },
  });

  revalidatePath(`/rounds/${roundId}`);
  revalidatePath(`/rounds/${roundId}/setup`);
}

// Unlock teams with the correct code
export async function unlockTeams(roundId: string, code: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
  });

  if (!round) throw new Error("Round not found");
  if (!round.lockCode) {
    throw new Error("Teams are not locked");
  }
  if (round.lockCode !== code) {
    throw new Error("Incorrect unlock code");
  }

  await prisma.round.update({
    where: { id: roundId },
    data: { lockCode: null },
  });

  revalidatePath(`/rounds/${roundId}`);
  revalidatePath(`/rounds/${roundId}/setup`);
}

// Check if teams are locked
export async function getTeamLockStatus(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { lockCode: true },
  });

  return {
    isLocked: !!round?.lockCode,
  };
}
