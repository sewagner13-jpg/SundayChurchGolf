import { prisma } from './prisma'

export interface Player {
  id: string
  fullName: string
  nickname?: string | null
}

export interface GeneratedTeam {
  name: string
  players: Player[]
}

/**
 * Generates random teams from a list of players
 * @param players - Array of players to divide into teams
 * @param teamSize - Desired team size (default 4)
 * @returns Array of teams with assigned players
 */
export function generateTeams(
  players: Player[],
  teamSize: number = 4
): GeneratedTeam[] {
  // Shuffle players using Fisher-Yates algorithm
  const shuffled = [...players]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Split into teams
  const teams: GeneratedTeam[] = []
  const numTeams = Math.ceil(shuffled.length / teamSize)

  for (let i = 0; i < numTeams; i++) {
    const teamPlayers = shuffled.slice(i * teamSize, (i + 1) * teamSize)
    const teamName = `Team ${i + 1}`
    teams.push({ name: teamName, players: teamPlayers })
  }

  return teams
}

interface HoleScoreData {
  teamId: string
  holeId: string
  underParStrokes: number | null
  handicapRank: number
}

interface HoleResult {
  holeId: string
  holeNumber: number
  handicapRank: number
  winningTeamIds: string[]
  carriedSkins: number
  skinValue: number
  scores: Map<string, number | null>
}

/**
 * Computes skins for a round, including carryovers and tiebreaker
 * @param roundId - The round to compute skins for
 * @returns Array of hole results with winners and payouts
 */
export async function computeSkins(roundId: string): Promise<HoleResult[]> {
  // Fetch round data
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      teams: {
        include: {
          players: {
            include: {
              player: true,
            },
          },
        },
      },
      holeScores: {
        include: {
          hole: true,
        },
        orderBy: {
          hole: {
            holeNumber: 'asc',
          },
        },
      },
      course: {
        include: {
          holes: {
            orderBy: {
              holeNumber: 'asc',
            },
          },
        },
      },
    },
  })

  if (!round) {
    throw new Error('Round not found')
  }

  const totalPlayers = round.teams.reduce(
    (sum, team) => sum + team.players.length,
    0
  )
  const totalPot = totalPlayers * round.buyInPerPlayer
  const skinValue = totalPot / 18

  // Group scores by hole
  const scoresByHole = new Map<string, HoleScoreData[]>()
  for (const holeScore of round.holeScores) {
    const holeId = holeScore.holeId
    if (!scoresByHole.has(holeId)) {
      scoresByHole.set(holeId, [])
    }
    scoresByHole.get(holeId)!.push({
      teamId: holeScore.teamId,
      holeId: holeScore.holeId,
      underParStrokes: holeScore.underParStrokes,
      handicapRank: holeScore.hole.handicapRank,
    })
  }

  // Process each hole in order
  const holeResults: HoleResult[] = []
  let carriedSkins = 0

  for (const hole of round.course.holes) {
    const holeScores = scoresByHole.get(hole.id) || []
    carriedSkins += 1 // Each hole adds one skin

    // Convert null (X) to 0 for comparison
    const teamScores = new Map<string, number>()
    for (const score of holeScores) {
      teamScores.set(score.teamId, score.underParStrokes ?? 0)
    }

    // Find the highest score
    const maxScore = Math.max(...Array.from(teamScores.values()))

    // Find all teams with the max score
    const winners = Array.from(teamScores.entries())
      .filter(([_, score]) => score === maxScore)
      .map(([teamId]) => teamId)

    // Determine if there's a tie
    const isTie = winners.length > 1 || maxScore === 0

    holeResults.push({
      holeId: hole.id,
      holeNumber: hole.holeNumber,
      handicapRank: hole.handicapRank,
      winningTeamIds: isTie ? [] : winners,
      carriedSkins,
      skinValue: isTie ? 0 : skinValue * carriedSkins,
      scores: teamScores,
    })

    // Reset carryover if there's a winner
    if (!isTie) {
      carriedSkins = 0
    }
  }

  // If there are still carried skins after hole 18, resolve by handicap
  if (carriedSkins > 0) {
    resolveFinalCarryoverByHandicap(holeResults, carriedSkins, skinValue)
  }

  return holeResults
}

/**
 * Resolves final carryover using handicap tiebreaker
 * @param holeResults - Array of hole results
 * @param carriedSkins - Number of skins being carried
 * @param skinValue - Value per skin
 */
function resolveFinalCarryoverByHandicap(
  holeResults: HoleResult[],
  carriedSkins: number,
  skinValue: number
): void {
  // Sort holes by handicap rank (1 = hardest)
  const sortedByHandicap = [...holeResults].sort(
    (a, b) => a.handicapRank - b.handicapRank
  )

  // Find the first hole with a clear winner
  for (const hole of sortedByHandicap) {
    const maxScore = Math.max(...Array.from(hole.scores.values()))
    const winners = Array.from(hole.scores.entries())
      .filter(([_, score]) => score === maxScore)
      .map(([teamId]) => teamId)

    if (winners.length === 1 && maxScore > 0) {
      // Found a tiebreaker winner
      hole.winningTeamIds = winners
      hole.skinValue = skinValue * carriedSkins
      hole.carriedSkins = carriedSkins
      return
    }
  }

  // If still tied after all holes, split evenly (edge case)
  // Find all teams and split the remaining pot
  const lastHole = holeResults[holeResults.length - 1]
  const allTeams = Array.from(lastHole.scores.keys())
  if (allTeams.length > 0) {
    lastHole.winningTeamIds = allTeams
    lastHole.skinValue = (skinValue * carriedSkins) / allTeams.length
  }
}

/**
 * Computes payouts for all teams in a round
 * @param roundId - The round to compute payouts for
 * @returns Map of teamId to total payout
 */
export async function computePayouts(
  roundId: string
): Promise<Map<string, number>> {
  const holeResults = await computeSkins(roundId)
  const payouts = new Map<string, number>()

  for (const hole of holeResults) {
    if (hole.winningTeamIds.length === 0) continue

    const payoutPerTeam = hole.skinValue / hole.winningTeamIds.length
    for (const teamId of hole.winningTeamIds) {
      payouts.set(teamId, (payouts.get(teamId) || 0) + payoutPerTeam)
    }
  }

  return payouts
}

/**
 * Saves computed skins and payouts to the database
 * @param roundId - The round to save results for
 */
export async function saveRoundResults(roundId: string): Promise<void> {
  const holeResults = await computeSkins(roundId)

  // Update each hole score with computed values
  for (const hole of holeResults) {
    for (const [teamId, _score] of hole.scores) {
      const isWinner = hole.winningTeamIds.includes(teamId)
      const payoutShare = isWinner
        ? hole.skinValue / hole.winningTeamIds.length
        : 0

      await prisma.holeScore.updateMany({
        where: {
          roundId,
          teamId,
          holeId: hole.holeId,
        },
        data: {
          carriedSkins: hole.carriedSkins,
          skinValue: payoutShare,
        },
      })
    }
  }
}

/**
 * Updates season statistics for all players
 * @param seasonId - The season to update stats for
 */
export async function updateSeasonStats(seasonId: string): Promise<void> {
  // This would compute aggregate stats like:
  // - Total winnings per player
  // - Win percentage
  // - Average score
  // - etc.
  // For now, this is a placeholder for future implementation
  console.log(`Season stats updated for season: ${seasonId}`)
}
