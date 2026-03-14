/**
 * Pure Scoring Engine — all format scoring logic lives here.
 * No database access. All functions take plain data and return results.
 */

// ─── Input / Output Types ───────────────────────────────────────────────────

export interface PlayerInput {
  playerId: string
  playerName: string
  grossScore: number | null   // null = pick up / no score recorded
  driveSelected?: boolean     // for scramble/shamble: was this player's drive chosen?
}

export interface ScoringResult {
  teamGrossScore: number | null
  teamDisplayScore?: string        // override display (e.g. "344" for Train Game)
  countedPlayerIds: string[]
  extraData: Record<string, unknown>
}

export interface MoneyBallResult extends ScoringResult {
  moneyBallRawScore: number | null     // MB player's raw completed hole score
  moneyBallPenalty: number             // 0 unless ball was lost
  moneyBallAdjustedScore: number | null // raw + penalty
}

export interface VegasHoleResult {
  team1Number: number | null
  team2Number: number | null
  holePoints: number                   // absolute difference
  winner: 'team1' | 'team2' | 'tie'
}

export interface ChicagoHoleResult {
  totalPoints: number
  playerPoints: Record<string, number> // playerId → points
}

export interface DriveMinimumStatus {
  driveCounts: Record<string, number>  // playerId → drives used
  shortfalls: Record<string, number>   // playerId → how many more needed
  remainingHoles: number
  warnings: string[]
}

export interface Par3Standing {
  playerId: string
  playerName: string
  total: number | null
  holesCompleted: number
}

// ─── Rotation Helper ────────────────────────────────────────────────────────

/** Returns 0-based index of the designated player for a given hole (1-based holeNumber). */
export function getRotatingPlayerIndex(holeNumber: number, teamSize: number): number {
  return (holeNumber - 1) % teamSize
}

/** Returns the playerId of the rotating designated player for a given hole. */
export function getRotatingDesignatedPlayerId(
  players: PlayerInput[],
  holeNumber: number
): string {
  const idx = getRotatingPlayerIndex(holeNumber, players.length)
  return players[idx]?.playerId ?? ''
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Filter + sort players by grossScore ascending, skipping nulls. */
function rankedValidScores(
  players: PlayerInput[]
): Array<{ score: number; playerId: string }> {
  return players
    .filter((p) => p.grossScore !== null)
    .map((p) => ({ score: p.grossScore as number, playerId: p.playerId }))
    .sort((a, b) => a.score - b.score)
}

// ─── Format Scoring Functions ───────────────────────────────────────────────

/** 2 Best Balls of 4: sum of 2 lowest gross scores. */
export function compute2BestBalls(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players)
  const counted = ranked.slice(0, 2)
  const teamScore = counted.length === 2 ? counted.reduce((s, p) => s + p.score, 0) : null
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {},
  }
}

/** 3 Best Balls of 4: sum of 3 lowest gross scores. */
export function compute3BestBalls(players: PlayerInput[]): ScoringResult {
  const ranked = rankedValidScores(players)
  const counted = ranked.slice(0, 3)
  const teamScore = counted.length === 3 ? counted.reduce((s, p) => s + p.score, 0) : null
  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: {},
  }
}

/**
 * Lone Ranger / Yellow Ball:
 * Designated player's score MUST count + best of the remaining players.
 */
export function computeLoneRanger(
  players: PlayerInput[],
  loneRangerPlayerId: string
): ScoringResult {
  const loneRanger = players.find((p) => p.playerId === loneRangerPlayerId)
  const rest = players.filter((p) => p.playerId !== loneRangerPlayerId)
  const bestOfRest = rankedValidScores(rest)[0]

  if (!loneRanger || loneRanger.grossScore === null || !bestOfRest) {
    return {
      teamGrossScore: null,
      countedPlayerIds: loneRanger ? [loneRangerPlayerId] : [],
      extraData: { loneRangerId: loneRangerPlayerId },
    }
  }

  return {
    teamGrossScore: loneRanger.grossScore + bestOfRest.score,
    countedPlayerIds: [loneRangerPlayerId, bestOfRest.playerId],
    extraData: { loneRangerId: loneRangerPlayerId },
  }
}

/**
 * Money Ball:
 * - Team competition score = MB player's score + best of remaining (normal; no penalty)
 * - Separate Money Ball adjusted score = MB raw score + penalty if ball was lost
 */
export function computeMoneyBall(
  players: PlayerInput[],
  moneyBallPlayerId: string,
  moneyBallLost: boolean,
  penaltyStrokes: number = 4
): MoneyBallResult {
  const mbPlayer = players.find((p) => p.playerId === moneyBallPlayerId)
  const rest = players.filter((p) => p.playerId !== moneyBallPlayerId)
  const bestOfRest = rankedValidScores(rest)[0]

  const mbRawScore = mbPlayer?.grossScore ?? null
  const mbPenalty = moneyBallLost ? penaltyStrokes : 0
  const mbAdjustedScore = mbRawScore !== null ? mbRawScore + mbPenalty : null

  // Team competition score: MB player + best of rest (no penalty added here)
  let teamScore: number | null = null
  const counted: string[] = []
  if (mbRawScore !== null && bestOfRest) {
    teamScore = mbRawScore + bestOfRest.score
    counted.push(moneyBallPlayerId, bestOfRest.playerId)
  }

  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted,
    moneyBallRawScore: mbRawScore,
    moneyBallPenalty: mbPenalty,
    moneyBallAdjustedScore: mbAdjustedScore,
    extraData: { moneyBallLost, moneyBallPlayerId },
  }
}

/**
 * Cha Cha Cha: rotating count of best scores.
 * Pattern: hole 1 → 1 best, hole 2 → 2 best, hole 3 → 3 best, then repeat.
 */
export function computeChaChaCha(players: PlayerInput[], holeNumber: number): ScoringResult {
  const countMode = ((holeNumber - 1) % 3) + 1 // 1, 2, or 3
  const ranked = rankedValidScores(players)
  const counted = ranked.slice(0, countMode)
  const teamScore =
    counted.length === countMode ? counted.reduce((s, p) => s + p.score, 0) : null

  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: { countMode, holeNumber },
  }
}

/**
 * Shamble: best drive selected (tracked via driveSelected flag), then count N best scores.
 */
export function computeShamble(
  players: PlayerInput[],
  countMode: 'count_best_1' | 'count_best_2' | 'count_best_3' | 'count_all'
): ScoringResult {
  const drivePlayer = players.find((p) => p.driveSelected)
  const ranked = rankedValidScores(players)
  const countN =
    countMode === 'count_best_1'
      ? 1
      : countMode === 'count_best_2'
      ? 2
      : countMode === 'count_best_3'
      ? 3
      : players.length

  const counted = ranked.slice(0, countN)
  const teamScore = counted.length === countN ? counted.reduce((s, p) => s + p.score, 0) : null

  return {
    teamGrossScore: teamScore,
    countedPlayerIds: counted.map((p) => p.playerId),
    extraData: { selectedDrivePlayerId: drivePlayer?.playerId ?? null, countMode },
  }
}

/** Chicago Points: points earned based on gross score vs par. */
export function computeChicagoPoints(grossScore: number, par: number): number {
  const diff = grossScore - par
  if (diff <= -3) return 8 // double eagle or better
  if (diff === -2) return 4 // eagle
  if (diff === -1) return 2 // birdie
  if (diff === 0) return 1  // par
  return 0                  // bogey or worse
}

/** Chicago Points Team: total points for all players on the hole. */
export function computeChicagoTeamPoints(
  players: PlayerInput[],
  par: number
): ChicagoHoleResult {
  let totalPoints = 0
  const playerPoints: Record<string, number> = {}

  for (const p of players) {
    if (p.grossScore !== null) {
      const pts = computeChicagoPoints(p.grossScore, par)
      playerPoints[p.playerId] = pts
      totalPoints += pts
    } else {
      playerPoints[p.playerId] = 0
    }
  }

  return { totalPoints, playerPoints }
}

/**
 * Train Game: sort 3 lowest scores, concatenate to form a number.
 * E.g. 3, 4, 4, 5 → train = 344.
 */
export function computeTrainGame(
  players: PlayerInput[]
): ScoringResult & { trainNumber: number | null } {
  const ranked = rankedValidScores(players)
  const best3 = ranked.slice(0, 3)

  if (best3.length < 3) {
    return {
      teamGrossScore: null,
      trainNumber: null,
      countedPlayerIds: [],
      extraData: { trainDigits: [] },
    }
  }

  const digits = best3.map((p) => p.score)
  // Concatenate digits: [3, 4, 4] → 344
  const trainNumber = digits.reduce((acc, d) => acc * 10 + d, 0)

  return {
    teamGrossScore: trainNumber,
    teamDisplayScore: digits.join(''),
    trainNumber,
    countedPlayerIds: best3.map((p) => p.playerId),
    extraData: { trainDigits: digits },
  }
}

/**
 * Vegas (2v2):
 * Each team's 2 scores form a two-digit number (low score first).
 * Hole points = absolute difference between team numbers.
 * Optional birdie flip: if a team birdies, reverse the OPPOSING team's number.
 */
export function computeVegas(
  team1Scores: [number | null, number | null],
  team2Scores: [number | null, number | null],
  par: number,
  options: { enableBirdieFlip?: boolean } = {}
): VegasHoleResult {
  const t1Valid = (team1Scores.filter((s) => s !== null) as number[]).sort((a, b) => a - b)
  const t2Valid = (team2Scores.filter((s) => s !== null) as number[]).sort((a, b) => a - b)

  if (t1Valid.length < 2 || t2Valid.length < 2) {
    return { team1Number: null, team2Number: null, holePoints: 0, winner: 'tie' }
  }

  let t1Num = t1Valid[0] * 10 + t1Valid[1]
  let t2Num = t2Valid[0] * 10 + t2Valid[1]

  if (options.enableBirdieFlip) {
    const t1HasBirdie = t1Valid.some((s) => s < par)
    const t2HasBirdie = t2Valid.some((s) => s < par)
    // If team 1 birdies, flip team 2's number
    if (t1HasBirdie) t2Num = t2Valid[1] * 10 + t2Valid[0]
    // If team 2 birdies, flip team 1's number
    if (t2HasBirdie) t1Num = t1Valid[1] * 10 + t1Valid[0]
  }

  const diff = Math.abs(t1Num - t2Num)
  const winner: 'team1' | 'team2' | 'tie' =
    t1Num < t2Num ? 'team1' : t2Num < t1Num ? 'team2' : 'tie'

  return { team1Number: t1Num, team2Number: t2Num, holePoints: diff, winner }
}

/**
 * Drive Minimum Tracker:
 * Given a log of which player drove on each hole, compute counts and warn if behind pace.
 */
export function computeDriveMinimumStatus(
  driveLog: Array<{ holeNumber: number; drivingPlayerId: string }>,
  teamPlayerIds: string[],
  requiredDrives: number,
  totalHoles: number
): DriveMinimumStatus {
  const driveCounts: Record<string, number> = {}
  teamPlayerIds.forEach((id) => (driveCounts[id] = 0))

  for (const entry of driveLog) {
    if (driveCounts[entry.drivingPlayerId] !== undefined) {
      driveCounts[entry.drivingPlayerId]++
    }
  }

  const holesPlayed = driveLog.length
  const remainingHoles = totalHoles - holesPlayed
  const warnings: string[] = []
  const shortfalls: Record<string, number> = {}

  for (const [playerId, count] of Object.entries(driveCounts)) {
    if (count < requiredDrives) {
      const needed = requiredDrives - count
      shortfalls[playerId] = needed
      if (needed > remainingHoles) {
        warnings.push(
          `Player ${playerId} cannot meet drive minimum (needs ${needed} more, only ${remainingHoles} holes remain)`
        )
      }
    }
  }

  return { driveCounts, shortfalls, remainingHoles, warnings }
}

/**
 * Par 3 Contest Standings:
 * Rank players by total gross strokes on par-3 holes (low score wins).
 */
export function computePar3ContestStandings(
  playerScores: Array<{
    playerId: string
    playerName: string
    par3GrossScores: (number | null)[]
  }>
): Par3Standing[] {
  return playerScores
    .map((p) => {
      const valid = p.par3GrossScores.filter((s): s is number => s !== null)
      return {
        playerId: p.playerId,
        playerName: p.playerName,
        total: valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null,
        holesCompleted: valid.length,
      }
    })
    .sort((a, b) => {
      if (a.total === null && b.total === null) return 0
      if (a.total === null) return 1
      if (b.total === null) return -1
      return a.total - b.total
    })
}

/**
 * Irish Golf / 6-6-6 segment dispatcher:
 * Returns the format ID to use for a given hole number.
 */
export function getIrishGolfSegmentFormatId(
  holeNumber: number,
  formatConfig: Record<string, unknown>
): string | null {
  if (holeNumber >= 1 && holeNumber <= 6) return (formatConfig.segment1FormatId as string) ?? null
  if (holeNumber >= 7 && holeNumber <= 12) return (formatConfig.segment2FormatId as string) ?? null
  if (holeNumber >= 13 && holeNumber <= 18) return (formatConfig.segment3FormatId as string) ?? null
  return null
}

/**
 * Central dispatch: compute team gross score for a given format on a given hole.
 * Returns null for formats that need special handling (Vegas, Wolf, Irish Golf as container).
 *
 * holeMetadata: per-hole data (e.g. designatedPlayerId, moneyBallPlayerId, moneyBallLost)
 * formatConfig:  round-level config (e.g. shambleCountMode, moneyBallPenaltyStrokes)
 */
export function computeFormatScore(
  formatId: string,
  players: PlayerInput[],
  holeNumber: number,
  par: number,
  holeMetadata: Record<string, unknown> = {},
  formatConfig: Record<string, unknown> = {}
): ScoringResult | MoneyBallResult | null {
  switch (formatId) {
    case 'two_best_balls_of_four':
      return compute2BestBalls(players)

    case 'three_best_balls_of_four':
      return compute3BestBalls(players)

    case 'lone_ranger': {
      const designatedId =
        (holeMetadata.designatedPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber)
      return computeLoneRanger(players, designatedId)
    }

    case 'money_ball': {
      const mbPlayerId =
        (holeMetadata.moneyBallPlayerId as string) ||
        getRotatingDesignatedPlayerId(players, holeNumber)
      const mbLost = (holeMetadata.moneyBallLost as boolean) ?? false
      const penalty = (formatConfig.moneyBallPenaltyStrokes as number) ?? 4
      return computeMoneyBall(players, mbPlayerId, mbLost, penalty)
    }

    case 'cha_cha_cha':
      return computeChaChaCha(players, holeNumber)

    case 'shamble_team': {
      const countMode =
        ((formatConfig.shambleCountMode as string) as
          | 'count_best_1'
          | 'count_best_2'
          | 'count_best_3'
          | 'count_all') ?? 'count_best_2'
      return computeShamble(players, countMode)
    }

    case 'train_game':
      return computeTrainGame(players)

    case 'scramble_rotating_drives':
    case 'step_aside_scramble':
      // These are scramble formats — team score is entered directly (no individual gross)
      return null

    case 'irish_golf_6_6_6': {
      const segmentId = getIrishGolfSegmentFormatId(holeNumber, formatConfig)
      if (segmentId) {
        return computeFormatScore(segmentId, players, holeNumber, par, holeMetadata, formatConfig)
      }
      return null
    }

    case 'wolf_team':
    case 'vegas':
    case 'chicago_points_team':
    case 'default-sunday-church':
      // Handled separately (match/points/skins)
      return null

    default:
      return null
  }
}

/**
 * Compute Money Ball round totals across all holes.
 */
export interface MoneyBallRoundTotals {
  teamCompetitionTotal: number | null
  moneyBallTotalScore: number | null
  moneyBallLossCount: number
  moneyBallPenaltyTotal: number
}

export function computeMoneyBallRoundTotals(
  holeResults: Array<{
    teamGrossScore: number | null
    moneyBallAdjustedScore: number | null
    moneyBallPenalty: number
    moneyBallLost: boolean
  }>
): MoneyBallRoundTotals {
  let teamCompetitionTotal: number | null = null
  let moneyBallTotalScore: number | null = null
  let moneyBallLossCount = 0
  let moneyBallPenaltyTotal = 0

  for (const hole of holeResults) {
    if (hole.teamGrossScore !== null) {
      teamCompetitionTotal = (teamCompetitionTotal ?? 0) + hole.teamGrossScore
    }
    if (hole.moneyBallAdjustedScore !== null) {
      moneyBallTotalScore = (moneyBallTotalScore ?? 0) + hole.moneyBallAdjustedScore
    }
    if (hole.moneyBallLost) {
      moneyBallLossCount++
      moneyBallPenaltyTotal += hole.moneyBallPenalty
    }
  }

  return {
    teamCompetitionTotal,
    moneyBallTotalScore,
    moneyBallLossCount,
    moneyBallPenaltyTotal,
  }
}
