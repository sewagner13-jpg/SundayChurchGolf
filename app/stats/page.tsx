'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PlayerStats {
  name: string
  roundsPlayed: number
  totalWinnings: number
  totalBuyIns: number
  netWinnings: number
}

export default function StatsPage() {
  const [currentYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [currentYear])

  async function loadStats() {
    try {
      // Fetch all rounds for the current season
      const response = await fetch(`/api/rounds?seasonId=${currentYear}`)
      if (!response.ok) {
        setLoading(false)
        return
      }

      const rounds = await response.json()

      // Calculate player stats
      const playerMap = new Map<string, PlayerStats>()

      for (const round of rounds) {
        if (!round.isLocked) continue

        const totalPlayers = round.teams.reduce(
          (sum: number, t: any) => sum + t.players.length,
          0
        )
        const totalPot = totalPlayers * round.buyInPerPlayer

        // Fetch detailed round with scores
        const roundResponse = await fetch(`/api/rounds/${round.id}`)
        const detailedRound = await roundResponse.json()

        // Calculate team payouts
        const teamPayouts = new Map<string, number>()
        const holeScoresByHole = new Map<string, any[]>()

        detailedRound.holeScores.forEach((hs: any) => {
          if (!holeScoresByHole.has(hs.holeId)) {
            holeScoresByHole.set(hs.holeId, [])
          }
          holeScoresByHole.get(hs.holeId)!.push(hs)
        })

        // Process each team's winnings
        detailedRound.teams.forEach((team: any) => {
          let teamWinnings = 0
          detailedRound.holeScores.forEach((hs: any) => {
            if (hs.teamId === team.id) {
              teamWinnings += hs.skinValue || 0
            }
          })
          teamPayouts.set(team.id, teamWinnings)
        })

        // Update player stats
        detailedRound.teams.forEach((team: any) => {
          const teamPayout = teamPayouts.get(team.id) || 0
          const perPlayer = teamPayout / team.players.length

          team.players.forEach((tp: any) => {
            const playerName = tp.player.fullName
            const existing = playerMap.get(playerName) || {
              name: playerName,
              roundsPlayed: 0,
              totalWinnings: 0,
              totalBuyIns: 0,
              netWinnings: 0,
            }

            existing.roundsPlayed += 1
            existing.totalWinnings += perPlayer
            existing.totalBuyIns += round.buyInPerPlayer
            existing.netWinnings = existing.totalWinnings - existing.totalBuyIns

            playerMap.set(playerName, existing)
          })
        })
      }

      const sortedStats = Array.from(playerMap.values()).sort(
        (a, b) => b.netWinnings - a.netWinnings
      )

      setStats(sortedStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/" className="text-primary-100 hover:text-white mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">{currentYear} Season Stats</h1>
          <p className="text-primary-100 mt-1">Leaderboard & Player Statistics</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Leaderboard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Player
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Rounds
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Won
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Buy-ins
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Loading stats...
                    </td>
                  </tr>
                ) : stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No completed rounds yet for {currentYear}
                    </td>
                  </tr>
                ) : (
                  stats.map((player, idx) => (
                    <tr key={player.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {idx === 0 && <span className="text-2xl mr-2">🏆</span>}
                          {idx === 1 && <span className="text-2xl mr-2">🥈</span>}
                          {idx === 2 && <span className="text-2xl mr-2">🥉</span>}
                          <span className="font-semibold text-gray-900">{idx + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{player.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {player.roundsPlayed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                        ${player.totalWinnings.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        ${player.totalBuyIns.toFixed(2)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-right text-lg font-bold ${
                          player.netWinnings > 0
                            ? 'text-green-600'
                            : player.netWinnings < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {player.netWinnings > 0 ? '+' : ''}$
                        {player.netWinnings.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
