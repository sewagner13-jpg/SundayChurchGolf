import { Decimal } from "@prisma/client/runtime/library";
import { HoleEntryType } from "@prisma/client";

// Types for scoring calculations
export interface TeamScore {
  teamId: string;
  holeNumber: number;
  entryType: HoleEntryType;
  value: number | null;
}

export interface HoleResultData {
  holeNumber: number;
  winnerTeamId: string | null;
  isTie: boolean;
  carrySkinsUsed: number;
  holePayout: Decimal;
}

export interface CourseHoleInfo {
  holeNumber: number;
  par: number;
  handicapRank: number;
}

/**
 * Get comparison value for a score entry
 * X = 0 (par or worse, cannot win)
 * BLANK = 0 (no entry yet)
 * VALUE = the actual positive integer (strokes under par)
 */
export function getComparisonValue(
  entryType: HoleEntryType,
  value: number | null
): number {
  if (entryType === "X" || entryType === "BLANK") {
    return 0;
  }
  return value ?? 0;
}

/**
 * Determine the hole result for a single hole
 * Returns winner team ID if exactly one team has max > 0
 * Returns null (tie) if:
 *   - max = 0 (all X or BLANK)
 *   - 2+ teams share the max
 *
 * SPECIAL RULE: if 3 teams and 2 tie for best, ALL teams tie
 */
export function determineHoleWinner(
  scores: TeamScore[]
): { winnerTeamId: string | null; isTie: boolean } {
  if (scores.length === 0) {
    return { winnerTeamId: null, isTie: true };
  }

  // Calculate comparison values
  const teamValues = scores.map((s) => ({
    teamId: s.teamId,
    value: getComparisonValue(s.entryType, s.value),
  }));

  const maxValue = Math.max(...teamValues.map((tv) => tv.value));

  // If max is 0, no one can win (all X or BLANK)
  if (maxValue === 0) {
    return { winnerTeamId: null, isTie: true };
  }

  // Count how many teams have the max value
  const teamsWithMax = teamValues.filter((tv) => tv.value === maxValue);

  // If exactly one team has max > 0, they win
  if (teamsWithMax.length === 1) {
    return { winnerTeamId: teamsWithMax[0].teamId, isTie: false };
  }

  // If 2+ teams tie for max, it's a tie (no skin awarded)
  return { winnerTeamId: null, isTie: true };
}

/**
 * Get the scoring order based on starting hole
 * startingHole = 1: 1,2,3...18
 * startingHole = 10: 10,11...18,1,2...9
 */
export function getScoringOrder(startingHole: number): number[] {
  if (startingHole === 10) {
    return [10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
}

/**
 * Calculate all hole results, carryovers, and payouts for a round
 * This is the main scoring engine calculation
 */
export function calculateRoundResults(
  allScores: TeamScore[],
  teams: { id: string; teamNumber: number }[],
  startingHole: number,
  pot: Decimal,
  courseHoles: CourseHoleInfo[]
): {
  holeResults: HoleResultData[];
  teamPayouts: Map<string, Decimal>;
  unresolvedCarryover: number;
} {
  const baseSkinValue = pot.div(18);
  const scoringOrder = getScoringOrder(startingHole);
  const holeResults: HoleResultData[] = [];
  const teamPayouts = new Map<string, Decimal>();

  // Initialize team payouts
  teams.forEach((t) => teamPayouts.set(t.id, new Decimal(0)));

  let carrySkins = 0;

  for (const holeNumber of scoringOrder) {
    // Each hole adds 1 skin to the pot
    carrySkins += 1;

    const holeScores = allScores.filter((s) => s.holeNumber === holeNumber);

    // Check if hole is complete (all teams have non-BLANK entries)
    const allTeamsScored = teams.every((team) => {
      const score = holeScores.find((s) => s.teamId === team.id);
      return score && score.entryType !== "BLANK";
    });

    if (!allTeamsScored) {
      // Hole not complete - still record placeholder result
      // Don't count this hole's skin yet since it's not played
      carrySkins -= 1;
      holeResults.push({
        holeNumber,
        winnerTeamId: null,
        isTie: false,
        carrySkinsUsed: 0,
        holePayout: new Decimal(0),
      });
      continue;
    }

    const { winnerTeamId, isTie } = determineHoleWinner(holeScores);

    if (winnerTeamId) {
      // Winner gets the accumulated skins
      const holePayout = baseSkinValue.mul(carrySkins);
      holeResults.push({
        holeNumber,
        winnerTeamId,
        isTie: false,
        carrySkinsUsed: carrySkins,
        holePayout,
      });

      // Update team payout
      const currentPayout = teamPayouts.get(winnerTeamId) ?? new Decimal(0);
      teamPayouts.set(winnerTeamId, currentPayout.add(holePayout));

      // Reset carry
      carrySkins = 0;
    } else {
      // Tie - no skin awarded, skins carry to next hole
      holeResults.push({
        holeNumber,
        winnerTeamId: null,
        isTie: true,
        carrySkinsUsed: 0,
        holePayout: new Decimal(0),
      });
      // carrySkins already incremented at top of loop, keeps accumulating
    }
  }

  return {
    holeResults,
    teamPayouts,
    unresolvedCarryover: carrySkins,
  };
}

export interface TiebreakerResult {
  additionalPayouts: Map<string, Decimal>;
  winnerTeamId: string | null;  // null if split
  decidingHoleNumber: number | null;  // null if split
  skinsWon: number;
}

/**
 * Resolve end-of-round unresolved carryover using handicap rank tiebreaker
 *
 * Check holes by handicap rank 1→18:
 * - If exactly one team has highest value > 0 on that hole, they win the carryover
 * - Else continue to next rank
 *
 * Fallback: Split evenly among all teams that tied on any hole
 */
export function resolveCarryoverTiebreaker(
  allScores: TeamScore[],
  teams: { id: string }[],
  courseHoles: CourseHoleInfo[],
  unresolvedCarryover: number,
  baseSkinValue: Decimal
): TiebreakerResult {
  const additionalPayouts = new Map<string, Decimal>();
  teams.forEach((t) => additionalPayouts.set(t.id, new Decimal(0)));

  if (unresolvedCarryover <= 0) {
    return { additionalPayouts, winnerTeamId: null, decidingHoleNumber: null, skinsWon: 0 };
  }

  const carryoverPayout = baseSkinValue.mul(unresolvedCarryover);

  // Sort holes by handicap rank (1 = hardest)
  const sortedHoles = [...courseHoles].sort(
    (a, b) => a.handicapRank - b.handicapRank
  );

  for (const hole of sortedHoles) {
    const holeScores = allScores.filter(
      (s) => s.holeNumber === hole.holeNumber
    );

    const teamValues = teams.map((team) => {
      const score = holeScores.find((s) => s.teamId === team.id);
      const value = score
        ? getComparisonValue(score.entryType, score.value)
        : 0;
      return { teamId: team.id, value };
    });

    const maxValue = Math.max(...teamValues.map((tv) => tv.value));

    if (maxValue === 0) {
      continue; // No one eligible on this hole
    }

    const teamsWithMax = teamValues.filter((tv) => tv.value === maxValue);

    if (teamsWithMax.length === 1) {
      // Single winner on this handicap-ranked hole
      additionalPayouts.set(teamsWithMax[0].teamId, carryoverPayout);
      return {
        additionalPayouts,
        winnerTeamId: teamsWithMax[0].teamId,
        decidingHoleNumber: hole.holeNumber,
        skinsWon: unresolvedCarryover,
      };
    }
    // Tie on this hole, continue to next handicap rank
  }

  // Fallback: still tied after all ranks - split evenly
  const splitPayout = carryoverPayout.div(teams.length);
  teams.forEach((t) => additionalPayouts.set(t.id, splitPayout));

  return {
    additionalPayouts,
    winnerTeamId: null,
    decidingHoleNumber: null,
    skinsWon: unresolvedCarryover,
  };
}

/**
 * Calculate player payouts from team payouts
 */
export function calculatePlayerPayouts(
  teamPayouts: Map<string, Decimal>,
  teamMembers: Map<string, string[]> // teamId -> playerIds
): Map<string, Decimal> {
  const playerPayouts = new Map<string, Decimal>();

  teamPayouts.forEach((payout, teamId) => {
    const members = teamMembers.get(teamId) ?? [];
    if (members.length === 0) return;

    const playerPayout = payout.div(members.length);
    members.forEach((playerId) => {
      playerPayouts.set(playerId, playerPayout);
    });
  });

  return playerPayouts;
}

/**
 * Find top-paying team(s) - all teams with max total payout
 */
export function findTopPayingTeams(
  teamPayouts: Map<string, Decimal>
): string[] {
  let maxPayout = new Decimal(0);
  const topTeams: string[] = [];

  teamPayouts.forEach((payout, teamId) => {
    if (payout.gt(maxPayout)) {
      maxPayout = payout;
      topTeams.length = 0;
      topTeams.push(teamId);
    } else if (payout.eq(maxPayout) && payout.gt(0)) {
      topTeams.push(teamId);
    }
  });

  return topTeams;
}

/**
 * Validate that teams are even (player count divisible by team size)
 */
export function validateEvenTeams(
  playerCount: number,
  teamSize: number
): boolean {
  return playerCount % teamSize === 0;
}

/**
 * Check if all holes are complete in scoring order
 */
export function areAllHolesComplete(
  allScores: TeamScore[],
  teams: { id: string }[],
  startingHole: number
): boolean {
  const scoringOrder = getScoringOrder(startingHole);

  for (const holeNumber of scoringOrder) {
    const holeScores = allScores.filter((s) => s.holeNumber === holeNumber);

    const allTeamsScored = teams.every((team) => {
      const score = holeScores.find((s) => s.teamId === team.id);
      return score && score.entryType !== "BLANK";
    });

    if (!allTeamsScored) {
      return false;
    }
  }

  return true;
}

/**
 * Get the current hole index in scoring order (0-indexed)
 */
export function getCurrentHoleIndex(
  allScores: TeamScore[],
  teams: { id: string }[],
  startingHole: number
): number {
  const scoringOrder = getScoringOrder(startingHole);

  for (let i = 0; i < scoringOrder.length; i++) {
    const holeNumber = scoringOrder[i];
    const holeScores = allScores.filter((s) => s.holeNumber === holeNumber);

    const allTeamsScored = teams.every((team) => {
      const score = holeScores.find((s) => s.teamId === team.id);
      return score && score.entryType !== "BLANK";
    });

    if (!allTeamsScored) {
      return i;
    }
  }

  return 17; // All complete, return last index
}
