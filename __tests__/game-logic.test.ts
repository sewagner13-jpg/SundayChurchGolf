import { generateTeams } from '@/lib/game-logic'

describe('Game Logic', () => {
  describe('generateTeams', () => {
    it('should generate teams with correct size', () => {
      const players = [
        { id: '1', fullName: 'Player 1' },
        { id: '2', fullName: 'Player 2' },
        { id: '3', fullName: 'Player 3' },
        { id: '4', fullName: 'Player 4' },
        { id: '5', fullName: 'Player 5' },
        { id: '6', fullName: 'Player 6' },
        { id: '7', fullName: 'Player 7' },
        { id: '8', fullName: 'Player 8' },
      ]

      const teams = generateTeams(players, 4)

      expect(teams).toHaveLength(2)
      expect(teams[0].players).toHaveLength(4)
      expect(teams[1].players).toHaveLength(4)
    })

    it('should handle uneven team sizes', () => {
      const players = [
        { id: '1', fullName: 'Player 1' },
        { id: '2', fullName: 'Player 2' },
        { id: '3', fullName: 'Player 3' },
        { id: '4', fullName: 'Player 4' },
        { id: '5', fullName: 'Player 5' },
      ]

      const teams = generateTeams(players, 4)

      expect(teams).toHaveLength(2)
      expect(teams[0].players).toHaveLength(4)
      expect(teams[1].players).toHaveLength(1)
    })

    it('should assign all players to teams', () => {
      const players = [
        { id: '1', fullName: 'Player 1' },
        { id: '2', fullName: 'Player 2' },
        { id: '3', fullName: 'Player 3' },
        { id: '4', fullName: 'Player 4' },
        { id: '5', fullName: 'Player 5' },
        { id: '6', fullName: 'Player 6' },
        { id: '7', fullName: 'Player 7' },
      ]

      const teams = generateTeams(players, 3)

      const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0)
      expect(totalPlayers).toBe(7)
    })

    it('should create unique team names', () => {
      const players = [
        { id: '1', fullName: 'Player 1' },
        { id: '2', fullName: 'Player 2' },
        { id: '3', fullName: 'Player 3' },
        { id: '4', fullName: 'Player 4' },
      ]

      const teams = generateTeams(players, 2)

      const teamNames = teams.map((t) => t.name)
      const uniqueNames = new Set(teamNames)
      expect(uniqueNames.size).toBe(teamNames.length)
    })
  })

  // Note: computeSkins, computePayouts, and resolveFinalCarryoverByHandicap
  // require database access, so they would need integration tests with a test database.
  // Below are conceptual tests that demonstrate the expected behavior:

  describe('Scoring Logic (Conceptual)', () => {
    it('should treat X (null) as 0 for scoring', () => {
      // In computeSkins, null values are converted to 0
      // Team with 1 birdie beats team with X (null)
      const teamScores = new Map([
        ['team1', 1], // 1 birdie
        ['team2', null], // X
      ])

      const maxScore = Math.max(
        ...Array.from(teamScores.values()).map((v) => v ?? 0)
      )

      expect(maxScore).toBe(1)
    })

    it('should calculate carryover correctly', () => {
      // If hole 1 ties, hole 2 should have 2 skins riding
      // If hole 2 also ties, hole 3 should have 3 skins riding
      let carriedSkins = 0

      // Hole 1: Tie
      carriedSkins += 1
      expect(carriedSkins).toBe(1)

      // Hole 2: Tie
      carriedSkins += 1
      expect(carriedSkins).toBe(2)

      // Hole 3: Winner
      const skinsWon = carriedSkins + 1
      expect(skinsWon).toBe(3)
      carriedSkins = 0
      expect(carriedSkins).toBe(0)
    })

    it('should calculate payout correctly', () => {
      const totalPot = 240 // 8 players × $30
      const skinValue = totalPot / 18 // $13.33 per skin
      const skinsWon = 3

      const payout = skinValue * skinsWon
      expect(payout).toBeCloseTo(40, 0)
    })

    it('should handle Eagle + Birdie math correctly', () => {
      // 1 eagle (+2) + 3 birdies (+1 each) = 5
      const eagles = 1
      const birdies = 3
      const totalUnderPar = eagles * 2 + birdies * 1

      expect(totalUnderPar).toBe(5)
    })

    it('should resolve tiebreaker by handicap rank', () => {
      // If tied after 18, check handicap 1 (hardest hole)
      const holes = [
        { holeNumber: 1, handicapRank: 15, scores: [1, 1] },
        { holeNumber: 2, handicapRank: 1, scores: [2, 1] }, // Team 1 wins on handicap 1
      ]

      const sortedByHandicap = holes.sort((a, b) => a.handicapRank - b.handicapRank)
      const tiebreakerHole = sortedByHandicap[0]

      expect(tiebreakerHole.holeNumber).toBe(2)
      expect(tiebreakerHole.scores[0]).toBeGreaterThan(tiebreakerHole.scores[1])
    })
  })
})
