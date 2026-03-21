import { Decimal } from "@prisma/client/runtime/library";
import { HoleEntryType } from "@prisma/client";
import { getScoringOrder } from "@/lib/scoring-order";

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

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT SCORING ENGINE — pure functions for all 14 golf formats
// No database access. Appended to existing skins engine above.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerInput {
  playerId: string;
  playerName: string;
  grossScore: number | null; // null = pick up / no score recorded
  driveSelected?: boolean; // for scramble/shamble: was this player's drive chosen?
}

export interface ScoringResult {
  teamGrossScore: number | null;
  teamDisplayScore?: string; // override display (e.g. "344" for Train Game)
  countedPlayerIds: string[];
  extraData: Record<string, unknown>;
}

export interface MoneyBallResult extends ScoringResult {
  moneyBallRawScore: number | null;
  moneyBallPenalty: number;
  moneyBallAdjustedScore: number | null;
}

export interface VegasHoleResult {
  team1Number: number | null;
  team2Number: number | null;
  holePoints: number;
  winner: "team1" | "team2" | "tie";
}

export interface WolfHoleResult extends ScoringResult {
  wolfPlayerId: string;
  partnerPlayerId: string | null;
  wolfSideBestBall: number | null;
  fieldSideBestBall: number | null;
  holePoints: number | null;
  result: "wolf" | "field" | "tie" | "incomplete";
}

export interface ChicagoHoleResult {
  totalPoints: number;
  playerPoints: Record<string, number>;
}

export interface DriveMinimumStatus {
  driveCounts: Record<string, number>;
  shortfalls: Record<string, number>;
  remainingHoles: number;
  warnings: string[];
}

export interface Par3Standing {
  playerId: string;
  playerName: string;
  total: number | null;
  holesCompleted: number;
}

export interface MoneyBallRoundTotals {
  teamCompetitionTotal: number | null;
  moneyBallTotalScore: number | null;
  moneyBallLossCount: number;
  moneyBallPenaltyTotal: number;
}

/** Returns 0-based index of the designated player for a given hole (1-based). */
export function getRotatingPlayerIndex(
  holeNumber: number,
  teamSize: number
): number {
  return (holeNumber - 1) % teamSize;
}

/** Returns the playerId of the rotating designated player for a given hole. */
export function getRotatingDesignatedPlayerId(
  players: PlayerInput[],
  holeNumber: number
): string {
  const idx = getRotatingPlayerIndex(holeNumber, players.length);
  return players[idx]?.playerId ?? "";
}

function rankedValidScores(
  players: PlayerInput[]
): Array<{ score: number; playerId: string }> {
  return players
    .filter((p) => p.grossScore !== null)
    .map((p) => ({ score: p.grossScore as number, playerId: p.playerId }))
    .sort((a, b) => a.score - b.score);
}

export function compute2BestBalls(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players);
  const counted = ranked.slice(0, 2);
  const teamScore =
    counted.length === 2 ? counted.reduce((s, p) => s + p.score, 0) : null;
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {},
  };
}

export function compute1BestBall(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players);
  const counted = ranked.slice(0, 1);
  const teamScore =
    counted.length === 1 ? counted.reduce((s, p) => s + p.score, 0) : null;
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {},
  };
}

export function compute3BestBalls(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players);
  const counted = ranked.slice(0, 3);
  const teamScore =
    counted.length === 3 ? counted.reduce((s, p) => s + p.score, 0) : null;
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {},
  };
}

export function computeLoneRanger(
  players: PlayerInput[],
  loneRangerPlayerId: string
): ScoringResult {
  const loneRanger = players.find((p) => p.playerId === loneRangerPlayerId);
  const rest = players.filter((p) => p.playerId !== loneRangerPlayerId);
  const bestOfRest = rankedValidScores(rest)[0];
  if (!loneRanger || loneRanger.grossScore === null || !bestOfRest) {
    return {
      teamGrossScore: null,
      countedPlayerIds: loneRanger ? [loneRangerPlayerId] : [],
      extraData: { loneRangerId: loneRangerPlayerId },
    };
  }
  return {
    teamGrossScore: loneRanger.grossScore + bestOfRest.score,
    countedPlayerIds: [loneRangerPlayerId, bestOfRest.playerId],
    extraData: { loneRangerId: loneRangerPlayerId },
  };
}

export function computeMoneyBall(
  players: PlayerInput[],
  moneyBallPlayerId: string,
  moneyBallLost: boolean,
  penaltyStrokes: number = 4
): MoneyBallResult {
  const mbPlayer = players.find((p) => p.playerId === moneyBallPlayerId);
  const rest = players.filter((p) => p.playerId !== moneyBallPlayerId);
  const bestOfRest = rankedValidScores(rest)[0];
  const mbRawScore = mbPlayer?.grossScore ?? null;
  const mbPenalty = moneyBallLost ? penaltyStrokes : 0;
  const mbAdjustedScore = mbRawScore !== null ? mbRawScore + mbPenalty : null;
  let teamScore: number | null = null;
  const counted: string[] = [];
  if (mbRawScore !== null && bestOfRest) {
    teamScore = mbRawScore + bestOfRest.score;
    counted.push(moneyBallPlayerId, bestOfRest.playerId);
  }
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted,
    moneyBallRawScore: mbRawScore,
    moneyBallPenalty: mbPenalty,
    moneyBallAdjustedScore: mbAdjustedScore,
    extraData: { moneyBallLost, moneyBallPlayerId },
  };
}

export function computeChaChaCha(
  players: PlayerInput[],
  holeNumber: number
): ScoringResult {
  const countMode = ((holeNumber - 1) % 3) + 1;
  const ranked = rankedValidScores(players);
  const counted = ranked.slice(0, countMode);
  const teamScore =
    counted.length === countMode
      ? counted.reduce((s, p) => s + p.score, 0)
      : null;
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: { countMode, holeNumber },
  };
}

export function computeShamble(
  players: PlayerInput[],
  countMode: "count_best_1" | "count_best_2" | "count_best_3" | "count_all"
): ScoringResult {
  const drivePlayer = players.find((p) => p.driveSelected);
  const ranked = rankedValidScores(players);
  const countN =
    countMode === "count_best_1"
      ? 1
      : countMode === "count_best_2"
      ? 2
      : countMode === "count_best_3"
      ? 3
      : players.length;
  const counted = ranked.slice(0, countN);
  const teamScore =
    counted.length === countN ? counted.reduce((s, p) => s + p.score, 0) : null;
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {
      selectedDrivePlayerId: drivePlayer?.playerId ?? null,
      countMode,
    },
  };
}

export function computeWolfTeam(
  players: PlayerInput[],
  wolfPlayerId: string,
  partnerPlayerId: string | null
): WolfHoleResult {
  const wolfPlayer = players.find((p) => p.playerId === wolfPlayerId);
  if (!wolfPlayer || wolfPlayer.grossScore === null) {
    return {
      teamGrossScore: null,
      countedPlayerIds: [],
      extraData: { wolfPlayerId, partnerPlayerId, holePoints: null, result: "incomplete" },
      wolfPlayerId,
      partnerPlayerId,
      wolfSideBestBall: null,
      fieldSideBestBall: null,
      holePoints: null,
      result: "incomplete",
    };
  }

  const partnerPlayer = partnerPlayerId
    ? players.find((p) => p.playerId === partnerPlayerId)
    : null;
  const wolfSide = [wolfPlayer, partnerPlayer].filter(Boolean) as PlayerInput[];
  const fieldSide = players.filter(
    (p) => p.playerId !== wolfPlayerId && p.playerId !== partnerPlayerId
  );

  const wolfBestBall = rankedValidScores(wolfSide)[0]?.score ?? null;
  const fieldBestBall = rankedValidScores(fieldSide)[0]?.score ?? null;

  if (wolfBestBall === null || fieldBestBall === null) {
    return {
      teamGrossScore: null,
      countedPlayerIds: wolfSide.map((p) => p.playerId),
      extraData: { wolfPlayerId, partnerPlayerId, holePoints: null, result: "incomplete" },
      wolfPlayerId,
      partnerPlayerId,
      wolfSideBestBall: wolfBestBall,
      fieldSideBestBall: fieldBestBall,
      holePoints: null,
      result: "incomplete",
    };
  }

  const isLoneWolf = !partnerPlayerId;
  const winValue = isLoneWolf ? 2 : 1;
  const loseValue = isLoneWolf ? -2 : -1;
  const result =
    wolfBestBall < fieldBestBall ? "wolf" : fieldBestBall < wolfBestBall ? "field" : "tie";
  const holePoints = result === "wolf" ? winValue : result === "field" ? loseValue : 0;

  return {
    teamGrossScore: holePoints,
    teamDisplayScore: holePoints > 0 ? `+${holePoints}` : `${holePoints}`,
    countedPlayerIds: players.map((p) => p.playerId),
    extraData: {
      wolfPlayerId,
      partnerPlayerId,
      holePoints,
      result,
      wolfSideBestBall: wolfBestBall,
      fieldSideBestBall: fieldBestBall,
    },
    wolfPlayerId,
    partnerPlayerId,
    wolfSideBestBall: wolfBestBall,
    fieldSideBestBall: fieldBestBall,
    holePoints,
    result,
  };
}

export function computeChicagoPoints(grossScore: number, par: number): number {
  const diff = grossScore - par;
  if (diff <= -3) return 8;
  if (diff === -2) return 4;
  if (diff === -1) return 2;
  if (diff === 0) return 1;
  return 0;
}

export function computeChicagoTeamPoints(
  players: PlayerInput[],
  par: number
): ChicagoHoleResult {
  let totalPoints = 0;
  const playerPoints: Record<string, number> = {};
  for (const p of players) {
    if (p.grossScore !== null) {
      const pts = computeChicagoPoints(p.grossScore, par);
      playerPoints[p.playerId] = pts;
      totalPoints += pts;
    } else {
      playerPoints[p.playerId] = 0;
    }
  }
  return { totalPoints, playerPoints };
}

export function computeTrainGame(
  players: PlayerInput[]
): ScoringResult & { trainNumber: number | null } {
  const ranked = rankedValidScores(players);
  const best3 = ranked.slice(0, 3);
  if (best3.length < 3) {
    return {
      teamGrossScore: null,
      trainNumber: null,
      countedPlayerIds: [],
      extraData: { trainDigits: [] },
    };
  }
  const digits = best3.map((p) => p.score);
  const trainNumber = digits.reduce((acc, d) => acc * 10 + d, 0);
  return {
    teamGrossScore: trainNumber,
    teamDisplayScore: digits.join(""),
    trainNumber,
    countedPlayerIds: best3.map((p) => p.playerId),
    extraData: { trainDigits: digits },
  };
}

export function computeVegas(
  team1Scores: [number | null, number | null],
  team2Scores: [number | null, number | null],
  par: number,
  options: { enableBirdieFlip?: boolean } = {}
): VegasHoleResult {
  const t1Valid = (team1Scores.filter((s) => s !== null) as number[]).sort(
    (a, b) => a - b
  );
  const t2Valid = (team2Scores.filter((s) => s !== null) as number[]).sort(
    (a, b) => a - b
  );
  if (t1Valid.length < 2 || t2Valid.length < 2) {
    return { team1Number: null, team2Number: null, holePoints: 0, winner: "tie" };
  }
  let t1Num = t1Valid[0] * 10 + t1Valid[1];
  let t2Num = t2Valid[0] * 10 + t2Valid[1];
  if (options.enableBirdieFlip) {
    if (t1Valid.some((s) => s < par)) t2Num = t2Valid[1] * 10 + t2Valid[0];
    if (t2Valid.some((s) => s < par)) t1Num = t1Valid[1] * 10 + t1Valid[0];
  }
  const diff = Math.abs(t1Num - t2Num);
  const winner: "team1" | "team2" | "tie" =
    t1Num < t2Num ? "team1" : t2Num < t1Num ? "team2" : "tie";
  return { team1Number: t1Num, team2Number: t2Num, holePoints: diff, winner };
}

export function computeVegasTeamNumber(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players).slice(0, 2);
  if (ranked.length < 2) {
    return {
      teamGrossScore: null,
      countedPlayerIds: [],
      extraData: { vegasDigits: [] },
    };
  }

  const digits = ranked.map((entry) => entry.score);
  const teamNumber = digits[0] * 10 + digits[1];

  return {
    teamGrossScore: teamNumber,
    teamDisplayScore: digits.join(""),
    countedPlayerIds: ranked.map((entry) => entry.playerId),
    extraData: { vegasDigits: digits },
  };
}

export function computeDriveMinimumStatus(
  driveLog: Array<{ holeNumber: number; drivingPlayerId: string }>,
  teamPlayerIds: string[],
  requiredDrives: number,
  totalHoles: number
): DriveMinimumStatus {
  const driveCounts: Record<string, number> = {};
  teamPlayerIds.forEach((id) => (driveCounts[id] = 0));
  for (const entry of driveLog) {
    if (driveCounts[entry.drivingPlayerId] !== undefined)
      driveCounts[entry.drivingPlayerId]++;
  }
  const holesPlayed = driveLog.length;
  const remainingHoles = totalHoles - holesPlayed;
  const warnings: string[] = [];
  const shortfalls: Record<string, number> = {};
  for (const [playerId, count] of Object.entries(driveCounts)) {
    if (count < requiredDrives) {
      const needed = requiredDrives - count;
      shortfalls[playerId] = needed;
      if (needed > remainingHoles)
        warnings.push(
          `Player ${playerId} cannot meet drive minimum (needs ${needed} more, only ${remainingHoles} holes remain)`
        );
    }
  }
  return { driveCounts, shortfalls, remainingHoles, warnings };
}

export function computePar3ContestStandings(
  playerScores: Array<{
    playerId: string;
    playerName: string;
    par3GrossScores: (number | null)[];
  }>
): Par3Standing[] {
  return playerScores
    .map((p) => {
      const valid = p.par3GrossScores.filter((s): s is number => s !== null);
      return {
        playerId: p.playerId,
        playerName: p.playerName,
        total: valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null,
        holesCompleted: valid.length,
      };
    })
    .sort((a, b) => {
      if (a.total === null && b.total === null) return 0;
      if (a.total === null) return 1;
      if (b.total === null) return -1;
      return a.total - b.total;
    });
}

export function getIrishGolfSegmentFormatId(
  holeNumber: number,
  formatConfig: Record<string, unknown>
): string | null {
  if (holeNumber >= 1 && holeNumber <= 6)
    return (formatConfig.segment1FormatId as string) ?? null;
  if (holeNumber >= 7 && holeNumber <= 12)
    return (formatConfig.segment2FormatId as string) ?? null;
  if (holeNumber >= 13 && holeNumber <= 18)
    return (formatConfig.segment3FormatId as string) ?? null;
  return null;
}

export function computeFormatScore(
  formatId: string,
  players: PlayerInput[],
  holeNumber: number,
  par: number,
  holeMetadata: Record<string, unknown> = {},
  formatConfig: Record<string, unknown> = {}
): ScoringResult | MoneyBallResult | null {
  switch (formatId) {
    case "wolf_team": {
      const designatedId =
        (holeMetadata.designatedPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      const partnerId =
        (holeMetadata.partnerPlayerId as string | null | undefined) ?? null;
      return computeWolfTeam(players, designatedId, partnerId);
    }
    case "one_best_ball_of_four":
      return compute1BestBall(players);
    case "two_best_balls_of_four":
      return compute2BestBalls(players);
    case "three_best_balls_of_four":
      return compute3BestBalls(players);
    case "lone_ranger": {
      const designatedId =
        (holeMetadata.designatedPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      return computeLoneRanger(players, designatedId);
    }
    case "money_ball": {
      const mbPlayerId =
        (holeMetadata.moneyBallPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      const mbLost = (holeMetadata.moneyBallLost as boolean) ?? false;
      const penalty = (formatConfig.moneyBallPenaltyStrokes as number) ?? 4;
      return computeMoneyBall(players, mbPlayerId, mbLost, penalty);
    }
    case "cha_cha_cha":
      return computeChaChaCha(players, holeNumber);
    case "shamble_team": {
      const countMode =
        ((formatConfig.shambleCountMode as string) as
          | "count_best_1"
          | "count_best_2"
          | "count_best_3"
          | "count_all") ?? "count_best_2";
      return computeShamble(players, countMode);
    }
    case "train_game":
      return computeTrainGame(players);
    case "vegas":
      return computeVegasTeamNumber(players);
    case "chicago_points_team": {
      const result = computeChicagoTeamPoints(players, par);
      return {
        teamGrossScore: result.totalPoints,
        teamDisplayScore: result.totalPoints.toString(),
        countedPlayerIds: Object.keys(result.playerPoints),
        extraData: { playerPoints: result.playerPoints },
      };
    }
    // Captain's Choice and Match Play team score = team gross score (entered at HoleScore level)
    case "captains_choice":
    case "match_play":
      return null; // team gross score entered directly; no per-player computation needed
    case "irish_golf_6_6_6": {
      const segmentId = getIrishGolfSegmentFormatId(holeNumber, formatConfig);
      if (segmentId)
        return computeFormatScore(
          segmentId,
          players,
          holeNumber,
          par,
          holeMetadata,
          formatConfig
        );
      return null;
    }
    default:
      return null;
  }
}

export function computeMoneyBallRoundTotals(
  holeResults: Array<{
    teamGrossScore: number | null;
    moneyBallAdjustedScore: number | null;
    moneyBallPenalty: number;
    moneyBallLost: boolean;
  }>
): MoneyBallRoundTotals {
  let teamCompetitionTotal: number | null = null;
  let moneyBallTotalScore: number | null = null;
  let moneyBallLossCount = 0;
  let moneyBallPenaltyTotal = 0;
  for (const hole of holeResults) {
    if (hole.teamGrossScore !== null)
      teamCompetitionTotal = (teamCompetitionTotal ?? 0) + hole.teamGrossScore;
    if (hole.moneyBallAdjustedScore !== null)
      moneyBallTotalScore =
        (moneyBallTotalScore ?? 0) + hole.moneyBallAdjustedScore;
    if (hole.moneyBallLost) {
      moneyBallLossCount++;
      moneyBallPenaltyTotal += hole.moneyBallPenalty;
    }
  }
  return {
    teamCompetitionTotal,
    moneyBallTotalScore,
    moneyBallLossCount,
    moneyBallPenaltyTotal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH PLAY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchPlayHoleResult {
  winnerTeamId: string | null; // null = tied hole
  isTie: boolean;
  /** Points the winner earns on this hole (1 + any carryover). 0 on a tie. */
  pointsToWinner: number;
  /** Carryover that rolls into the NEXT hole (0 if resolved this hole). */
  newCarryover: number;
}

export interface MatchPlayStandings {
  /** Cumulative points per teamId (carryover mode: winner gets 1+carryover; standard: 1 per hole won) */
  points: Record<string, number>;
  holesWon: Record<string, number>;
  holesHalved: Record<string, number>;
  /** Unresolved carryover points remaining after the last hole (e.g., round ends on a tie) */
  unresolvedCarryover: number;
}

/**
 * Compute the result for a single match-play hole.
 *
 * @param teamScores   Each team's gross score for the hole (null = no score / pick up).
 * @param carryover    Carryover points accumulated from prior tied holes.
 * @param multiTeamTieRule  'if_two_tie_all_tie' (default) or 'split_tied_winners'.
 */
export function computeMatchPlayHole(
  teamScores: { teamId: string; grossScore: number | null }[],
  carryover: number,
  multiTeamTieRule: "if_two_tie_all_tie" | "split_tied_winners" = "if_two_tie_all_tie"
): MatchPlayHoleResult {
  const valid = teamScores.filter((t) => t.grossScore !== null) as {
    teamId: string;
    grossScore: number;
  }[];

  if (valid.length === 0) {
    // No scores recorded yet — treat as tie
    return { winnerTeamId: null, isTie: true, pointsToWinner: 0, newCarryover: carryover + 1 };
  }

  const minScore = Math.min(...valid.map((t) => t.grossScore));
  const tied = valid.filter((t) => t.grossScore === minScore);

  let isTie: boolean;
  if (multiTeamTieRule === "if_two_tie_all_tie") {
    // 2+ teams share lowest → all teams tie
    isTie = tied.length > 1;
  } else {
    // 'split_tied_winners': tied teams share the win (still a "tie" in terms of points distribution)
    isTie = tied.length > 1;
  }

  if (isTie) {
    return {
      winnerTeamId: null,
      isTie: true,
      pointsToWinner: 0,
      newCarryover: carryover + 1,
    };
  }

  return {
    winnerTeamId: tied[0].teamId,
    isTie: false,
    pointsToWinner: 1 + carryover,
    newCarryover: 0,
  };
}

/**
 * Compute match play standings across a sequence of holes.
 *
 * @param holeResults  Ordered array of holes with each team's gross score.
 * @param config       carryOver: whether tied holes accumulate; multiTeamTieRule.
 */
export function computeMatchPlayStandings(
  holeResults: Array<{
    holeNumber: number;
    teamScores: { teamId: string; grossScore: number | null }[];
  }>,
  config: {
    carryOver: boolean;
    multiTeamTieRule?: "if_two_tie_all_tie" | "split_tied_winners";
  }
): MatchPlayStandings {
  const rule = config.multiTeamTieRule ?? "if_two_tie_all_tie";

  // Collect all teamIds
  const allTeamIds = new Set<string>();
  for (const h of holeResults) h.teamScores.forEach((t) => allTeamIds.add(t.teamId));

  const points: Record<string, number> = {};
  const holesWon: Record<string, number> = {};
  const holesHalved: Record<string, number> = {};
  allTeamIds.forEach((id) => {
    points[id] = 0;
    holesWon[id] = 0;
    holesHalved[id] = 0;
  });

  let carryover = 0;

  for (const hole of holeResults) {
    const result = computeMatchPlayHole(
      hole.teamScores,
      config.carryOver ? carryover : 0,
      rule
    );

    if (!result.isTie && result.winnerTeamId) {
      points[result.winnerTeamId] = (points[result.winnerTeamId] ?? 0) + result.pointsToWinner;
      holesWon[result.winnerTeamId] = (holesWon[result.winnerTeamId] ?? 0) + 1;
      carryover = 0;
    } else {
      // Tie — if carryover disabled, award 0.5 points to each team and count as halved
      if (!config.carryOver) {
        allTeamIds.forEach((id) => {
          holesHalved[id] = (holesHalved[id] ?? 0) + 1;
        });
      }
      carryover = config.carryOver ? result.newCarryover : 0;
    }
  }

  return { points, holesWon, holesHalved, unresolvedCarryover: carryover };
}

/**
 * Convenience: compute match play standings for a single 6-hole Irish Golf segment.
 */
export function computeIrishGolfSegmentMatchPlay(
  segmentNum: 1 | 2 | 3,
  allHoleResults: Array<{
    holeNumber: number;
    teamScores: { teamId: string; grossScore: number | null }[];
  }>,
  formatConfig: Record<string, unknown>
): MatchPlayStandings {
  const startHole = segmentNum === 1 ? 1 : segmentNum === 2 ? 7 : 13;
  const endHole = segmentNum === 1 ? 6 : segmentNum === 2 ? 12 : 18;
  const segmentHoles = allHoleResults.filter(
    (h) => h.holeNumber >= startHole && h.holeNumber <= endHole
  );
  const mpKey = `segment${segmentNum}MatchPlay` as keyof typeof formatConfig;
  const coKey = `segment${segmentNum}CarryOver` as keyof typeof formatConfig;
  return computeMatchPlayStandings(segmentHoles, {
    carryOver: !!(formatConfig[coKey]),
    multiTeamTieRule: "if_two_tie_all_tie",
  });
}
