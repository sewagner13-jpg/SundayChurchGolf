'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { computeSkins, computePayouts } from '@/lib/game-logic'

interface Team {
  id: string
  name: string
  players: Array<{
    player: {
      fullName: string
      nickname?: string | null
    }
  }>
}

interface Round {
  id: string
  date: string
  buyInPerPlayer: number
  course: {
    name: string
    holes: Array<{
      id: string
      holeNumber: number
      par: number
      handicapRank: number
    }>
  }
  format: {
    name: string
  }
  teams: Team[]
  holeScores: Array<{
    teamId: string
    holeId: string
    underParStrokes: number | null
    skinValue: number
    carriedSkins: number
  }>
}

export default function RoundSummaryPage() {
  const params = useParams()
  const roundId = params.id as string

  const [round, setRound] = useState<Round | null>(null)
  const [payouts, setPayouts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRound()
  }, [roundId])

  async function loadRound() {
    try {
      const response = await fetch(`/api/rounds/${roundId}`)
      if (response.ok) {
        const data = await response.json()
        setRound(data)

        // Compute payouts
        const teamPayouts = await computePayouts(roundId)
        setPayouts(teamPayouts)
      }
    } catch (error) {
      console.error('Failed to load round:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !round) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading summary...</p>
      </div>
    )
  }

  const totalPlayers = round.teams.reduce((sum, t) => sum + t.players.length, 0)
  const totalPot = totalPlayers * round.buyInPerPlayer
  const skinValue = totalPot / 18

  // Calculate per-player winnings
  const playerWinnings = new Map<string, number>()
  round.teams.forEach((team) => {
    const teamPayout = payouts.get(team.id) || 0
    const perPlayer = teamPayout / team.players.length
    team.players.forEach((p) => {
      const current = playerWinnings.get(p.player.fullName) || 0
      playerWinnings.set(p.player.fullName, current + perPlayer)
    })
  })

  // Sort players by winnings
  const sortedPlayers = Array.from(playerWinnings.entries())
    .map(([name, winnings]) => ({ name, winnings }))
    .sort((a, b) => b.winnings - a.winnings)

  // Group hole scores by hole
  const holeScoresByHole = new Map<string, any[]>()
  round.holeScores.forEach((hs) => {
    if (!holeScoresByHole.has(hs.holeId)) {
      holeScoresByHole.set(hs.holeId, [])
    }
    holeScoresByHole.get(hs.holeId)!.push(hs)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/" className="text-primary-100 hover:text-white mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Round Summary</h1>
          <p className="text-primary-100 mt-1">
            {format(new Date(round.date), 'MMMM d, yyyy')} • {round.course.name}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Round Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary-600">{totalPlayers}</div>
              <div className="text-sm text-gray-600">Players</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">{round.teams.length}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">${totalPot}</div>
              <div className="text-sm text-gray-600">Total Pot</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">${skinValue.toFixed(0)}</div>
              <div className="text-sm text-gray-600">Per Skin</div>
            </div>
          </div>
        </div>

        {/* Player Winnings */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Player Winnings</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {sortedPlayers.map((player, idx) => {
              const netWinnings = player.winnings - round.buyInPerPlayer
              return (
                <div key={player.name} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {idx === 0 && <span className="text-2xl">🏆</span>}
                    {idx === 1 && <span className="text-2xl">🥈</span>}
                    {idx === 2 && <span className="text-2xl">🥉</span>}
                    <div>
                      <h3 className="font-semibold text-lg">{player.name}</h3>
                      <p className="text-sm text-gray-600">
                        Won ${player.winnings.toFixed(2)} • Buy-in $
                        {round.buyInPerPlayer.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      netWinnings > 0
                        ? 'text-green-600'
                        : netWinnings < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {netWinnings > 0 ? '+' : ''}${netWinnings.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Hole-by-Hole Results */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Hole-by-Hole</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Hole</th>
                  <th className="px-4 py-3 text-center">Par</th>
                  {round.teams.map((team) => (
                    <th key={team.id} className="px-4 py-3 text-center">
                      {team.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Winner</th>
                  <th className="px-4 py-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {round.course.holes.map((hole) => {
                  const holeScores = holeScoresByHole.get(hole.id) || []
                  const scores = round.teams.map((team) => {
                    const score = holeScores.find((hs) => hs.teamId === team.id)
                    return {
                      teamId: team.id,
                      value: score?.underParStrokes ?? null,
                      payout: score?.skinValue || 0,
                      carried: score?.carriedSkins || 1,
                    }
                  })

                  const maxScore = Math.max(...scores.map((s) => s.value ?? 0))
                  const winners = scores.filter((s) => s.value === maxScore && s.value! > 0)
                  const winningTeam =
                    winners.length === 1
                      ? round.teams.find((t) => t.id === winners[0].teamId)
                      : null
                  const payout = winners.length === 1 ? winners[0].payout : 0
                  const carried = scores[0]?.carried || 1

                  return (
                    <tr key={hole.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {hole.holeNumber}
                        {carried > 1 && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {carried}x
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{hole.par}</td>
                      {round.teams.map((team) => {
                        const teamScore = scores.find((s) => s.teamId === team.id)
                        const isWinner =
                          winningTeam?.id === team.id && teamScore && teamScore.value! > 0
                        return (
                          <td
                            key={team.id}
                            className={`px-4 py-3 text-center font-semibold ${
                              isWinner ? 'bg-green-100 text-green-800' : ''
                            }`}
                          >
                            {teamScore?.value === null ? 'X' : teamScore?.value || 'X'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center text-sm">
                        {winningTeam ? winningTeam.name : winners.length > 1 ? 'Tie' : 'Push'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {payout > 0 ? `$${payout.toFixed(0)}` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
