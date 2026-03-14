export interface PlayerInput {
  playerId: string;
  playerName: string;
  grossScore: number | null;
  driveSelected?: boolean;
}

export interface ScoringResult {
  teamGrossScore: number | null;
  teamDisplayScore?: string;
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

export function getRotatingPlayerIndex(
  holeNumber: number,
  teamSize: number
): number {
  return (holeNumber - 1) % teamSize;
}

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
    .filter((player) => player.grossScore !== null)
    .map((player) => ({
      score: player.grossScore as number,
      playerId: player.playerId,
    }))
    .sort((a, b) => a.score - b.score);
}

export function compute2BestBalls(players: PlayerInput[]): ScoringResult {
  const counted = rankedValidScores(players).slice(0, 2);
  return {
    teamGrossScore:
      counted.length === 2 ? counted.reduce((sum, player) => sum + player.score, 0) : null,
    countedPlayerIds: counted.map((player) => player.playerId),
    extraData: {},
  };
}

export function compute3BestBalls(players: PlayerInput[]): ScoringResult {
  const counted = rankedValidScores(players).slice(0, 3);
  return {
    teamGrossScore:
      counted.length === 3 ? counted.reduce((sum, player) => sum + player.score, 0) : null,
    countedPlayerIds: counted.map((player) => player.playerId),
    extraData: {},
  };
}

export function computeLoneRanger(
  players: PlayerInput[],
  loneRangerPlayerId: string
): ScoringResult {
  const loneRanger = players.find((player) => player.playerId === loneRangerPlayerId);
  const bestOfRest = rankedValidScores(
    players.filter((player) => player.playerId !== loneRangerPlayerId)
  )[0];

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
  const moneyBallPlayer = players.find((player) => player.playerId === moneyBallPlayerId);
  const bestOfRest = rankedValidScores(
    players.filter((player) => player.playerId !== moneyBallPlayerId)
  )[0];
  const moneyBallRawScore = moneyBallPlayer?.grossScore ?? null;
  const moneyBallPenalty = moneyBallLost ? penaltyStrokes : 0;
  const moneyBallAdjustedScore =
    moneyBallRawScore !== null ? moneyBallRawScore + moneyBallPenalty : null;

  if (moneyBallRawScore === null || !bestOfRest) {
    return {
      teamGrossScore: null,
      countedPlayerIds: moneyBallPlayer ? [moneyBallPlayerId] : [],
      moneyBallRawScore,
      moneyBallPenalty,
      moneyBallAdjustedScore,
      extraData: { moneyBallLost, moneyBallPlayerId },
    };
  }

  return {
    teamGrossScore: moneyBallRawScore + bestOfRest.score,
    countedPlayerIds: [moneyBallPlayerId, bestOfRest.playerId],
    moneyBallRawScore,
    moneyBallPenalty,
    moneyBallAdjustedScore,
    extraData: { moneyBallLost, moneyBallPlayerId },
  };
}

export function computeChaChaCha(
  players: PlayerInput[],
  holeNumber: number
): ScoringResult {
  const countMode = ((holeNumber - 1) % 3) + 1;
  const counted = rankedValidScores(players).slice(0, countMode);
  return {
    teamGrossScore:
      counted.length === countMode
        ? counted.reduce((sum, player) => sum + player.score, 0)
        : null,
    countedPlayerIds: counted.map((player) => player.playerId),
    extraData: { countMode, holeNumber },
  };
}

export function computeShamble(
  players: PlayerInput[],
  countMode: "count_best_1" | "count_best_2" | "count_best_3" | "count_all"
): ScoringResult {
  const drivePlayer = players.find((player) => player.driveSelected);
  const count =
    countMode === "count_best_1"
      ? 1
      : countMode === "count_best_2"
      ? 2
      : countMode === "count_best_3"
      ? 3
      : players.length;
  const counted = rankedValidScores(players).slice(0, count);
  return {
    teamGrossScore:
      counted.length === count
        ? counted.reduce((sum, player) => sum + player.score, 0)
        : null,
    countedPlayerIds: counted.map((player) => player.playerId),
    extraData: {
      selectedDrivePlayerId: drivePlayer?.playerId ?? null,
      countMode,
    },
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

  for (const player of players) {
    if (player.grossScore === null) {
      playerPoints[player.playerId] = 0;
      continue;
    }

    const points = computeChicagoPoints(player.grossScore, par);
    playerPoints[player.playerId] = points;
    totalPoints += points;
  }

  return { totalPoints, playerPoints };
}

export function computeTrainGame(
  players: PlayerInput[]
): ScoringResult & { trainNumber: number | null } {
  const bestThree = rankedValidScores(players).slice(0, 3);
  if (bestThree.length < 3) {
    return {
      teamGrossScore: null,
      trainNumber: null,
      countedPlayerIds: [],
      extraData: { trainDigits: [] },
    };
  }

  const digits = bestThree.map((player) => player.score);
  const trainNumber = digits.reduce((accumulator, digit) => accumulator * 10 + digit, 0);

  return {
    teamGrossScore: trainNumber,
    teamDisplayScore: digits.join(""),
    trainNumber,
    countedPlayerIds: bestThree.map((player) => player.playerId),
    extraData: { trainDigits: digits },
  };
}

export function computeVegas(
  team1Scores: [number | null, number | null],
  team2Scores: [number | null, number | null],
  par: number,
  options: { enableBirdieFlip?: boolean } = {}
): VegasHoleResult {
  const team1 = (team1Scores.filter((score) => score !== null) as number[]).sort(
    (a, b) => a - b
  );
  const team2 = (team2Scores.filter((score) => score !== null) as number[]).sort(
    (a, b) => a - b
  );

  if (team1.length < 2 || team2.length < 2) {
    return { team1Number: null, team2Number: null, holePoints: 0, winner: "tie" };
  }

  let team1Number = team1[0] * 10 + team1[1];
  let team2Number = team2[0] * 10 + team2[1];

  if (options.enableBirdieFlip) {
    if (team1.some((score) => score < par)) {
      team2Number = team2[1] * 10 + team2[0];
    }
    if (team2.some((score) => score < par)) {
      team1Number = team1[1] * 10 + team1[0];
    }
  }

  return {
    team1Number,
    team2Number,
    holePoints: Math.abs(team1Number - team2Number),
    winner:
      team1Number < team2Number ? "team1" : team2Number < team1Number ? "team2" : "tie",
  };
}

export function computeVegasTeamNumber(players: PlayerInput[]): ScoringResult {
  const counted = rankedValidScores(players).slice(0, 2);
  if (counted.length < 2) {
    return {
      teamGrossScore: null,
      countedPlayerIds: [],
      extraData: { vegasDigits: [] },
    };
  }

  const digits = counted.map((player) => player.score);
  const teamNumber = digits[0] * 10 + digits[1];

  return {
    teamGrossScore: teamNumber,
    teamDisplayScore: digits.join(""),
    countedPlayerIds: counted.map((player) => player.playerId),
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
  teamPlayerIds.forEach((playerId) => {
    driveCounts[playerId] = 0;
  });

  for (const entry of driveLog) {
    if (driveCounts[entry.drivingPlayerId] !== undefined) {
      driveCounts[entry.drivingPlayerId]++;
    }
  }

  const holesPlayed = driveLog.length;
  const remainingHoles = totalHoles - holesPlayed;
  const warnings: string[] = [];
  const shortfalls: Record<string, number> = {};

  for (const [playerId, driveCount] of Object.entries(driveCounts)) {
    if (driveCount >= requiredDrives) continue;
    const needed = requiredDrives - driveCount;
    shortfalls[playerId] = needed;
    if (needed > remainingHoles) {
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
    par3GrossScores: Array<number | null>;
  }>
): Par3Standing[] {
  return playerScores
    .map((player) => {
      const validScores = player.par3GrossScores.filter(
        (score): score is number => score !== null
      );
      return {
        playerId: player.playerId,
        playerName: player.playerName,
        total:
          validScores.length > 0
            ? validScores.reduce((sum, score) => sum + score, 0)
            : null,
        holesCompleted: validScores.length,
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
  if (holeNumber >= 1 && holeNumber <= 6) {
    return (formatConfig.segment1FormatId as string) ?? null;
  }
  if (holeNumber >= 7 && holeNumber <= 12) {
    return (formatConfig.segment2FormatId as string) ?? null;
  }
  if (holeNumber >= 13 && holeNumber <= 18) {
    return (formatConfig.segment3FormatId as string) ?? null;
  }
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
      const designatedPlayerId =
        (holeMetadata.designatedPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      return computeLoneRanger(players, designatedPlayerId);
    }
    case "two_best_balls_of_four":
      return compute2BestBalls(players);
    case "three_best_balls_of_four":
      return compute3BestBalls(players);
    case "lone_ranger": {
      const designatedPlayerId =
        (holeMetadata.designatedPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      return computeLoneRanger(players, designatedPlayerId);
    }
    case "money_ball": {
      const moneyBallPlayerId =
        (holeMetadata.moneyBallPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber);
      const moneyBallLost = (holeMetadata.moneyBallLost as boolean) ?? false;
      const penalty = (formatConfig.moneyBallPenaltyStrokes as number) ?? 4;
      return computeMoneyBall(players, moneyBallPlayerId, moneyBallLost, penalty);
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
    case "irish_golf_6_6_6": {
      const segmentFormatId = getIrishGolfSegmentFormatId(holeNumber, formatConfig);
      if (!segmentFormatId) return null;
      return computeFormatScore(
        segmentFormatId,
        players,
        holeNumber,
        par,
        holeMetadata,
        formatConfig
      );
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

  for (const holeResult of holeResults) {
    if (holeResult.teamGrossScore !== null) {
      teamCompetitionTotal =
        (teamCompetitionTotal ?? 0) + holeResult.teamGrossScore;
    }
    if (holeResult.moneyBallAdjustedScore !== null) {
      moneyBallTotalScore =
        (moneyBallTotalScore ?? 0) + holeResult.moneyBallAdjustedScore;
    }
    if (holeResult.moneyBallLost) {
      moneyBallLossCount++;
      moneyBallPenaltyTotal += holeResult.moneyBallPenalty;
    }
  }

  return {
    teamCompetitionTotal,
    moneyBallTotalScore,
    moneyBallLossCount,
    moneyBallPenaltyTotal,
  };
}
