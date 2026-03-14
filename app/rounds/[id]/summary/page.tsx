'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  compute2BestBalls,
  compute3BestBalls,
  computeLoneRanger,
  computeMoneyBall,
  computeChaChaCha,
  computeShamble,
  computeChicagoTeamPoints,
  computeTrainGame,
  getRotatingDesignatedPlayerId,
  type PlayerInput,
} from '@/lib/scoring-engine'

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Hole {
  id: string
  holeNumber: number
  par: number
  handicapRank: number
}

interface TeamPlayer {
  player: {
    id: string
    fullName: string
    nickname?: string | null
  }
}

interface Team {
  id: string
  name: string
  players: TeamPlayer[]
}

interface HoleScore {
  teamId: string
  holeId: string
  underParStrokes: number | null
  skinValue: number
  carriedSkins: number
}

interface RoundFormat {
  id: string
  name: string
  shortLabel?: string
  formatCategory: 'skins' | 'stroke' | 'points' | 'match'
  requiresIndividualScores: boolean
  requiresDesignatedPlayer: boolean
}

interface Round {
  id: string
  date: string
  buyInPerPlayer: number
  isLocked: boolean
  formatConfig: Record<string, unknown> | null
  course: {
    name: string
    holeCount: number
    holes: Hole[]
  }
  format: RoundFormat
  teams: Team[]
  holeScores: HoleScore[]
}

interface PlayerScore {
  teamId: string
  playerId: string
  holeId: string
  grossScore: number | null
  extraData: Record<string, unknown> | null
}

interface TeamHoleResult {
  formatScore: number | null
  displayScore: string
  mbScore: number | null
  mbPenalty: number
}

interface TeamTotals {
  total: number | null
  mbTotal: number | null
  mbLosses: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSegmentFormatId(
  holeNumber: number,
  formatConfig: Record<string, unknown> | null
): string | null {
  if (!formatConfig) return null
  if (holeNumber <= 6) return (formatConfig.segment1FormatId as string) ?? null
  if (holeNumber <= 12) return (formatConfig.segment2FormatId as string) ?? null
  return (formatConfig.segment3FormatId as string) ?? null
}

function computeHoleTeamResult(
  formatId: string,
  holeNumber: number,
  par: number,
  team: Team,
  teamPlayerScores: PlayerScore[],
  formatConfig: Record<string, unknown> | null
): TeamHoleResult {
  const base: TeamHoleResult = { formatScore: null, displayScore: '-', mbScore: null, mbPenalty: 0 }

  const effectiveFormatId =
    formatId === 'irish_golf_6_6_6'
      ? (getSegmentFormatId(holeNumber, formatConfig) ?? formatId)
      : formatId

  const players: PlayerInput[] = team.players.map((tp) => {
    const ps = teamPlayerScores.find((s) => s.playerId === tp.player.id)
    return {
      playerId: tp.player.id,
      playerName: tp.player.fullName,
      grossScore: ps?.grossScore ?? null,
      driveSelected: (ps?.extraData?.driveSelected as boolean) ?? false,
    }
  })

  switch (effectiveFormatId) {
    case 'two_best_balls_of_four': {
      const r = compute2BestBalls(players)
      return { ...base, formatScore: r.teamGrossScore, displayScore: r.teamGrossScore?.toString() ?? '-' }
    }
    case 'three_best_balls_of_four': {
      const r = compute3BestBalls(players)
      return { ...base, formatScore: r.teamGrossScore, displayScore: r.teamGrossScore?.toString() ?? '-' }
    }
    case 'lone_ranger': {
      const designatedId = getRotatingDesignatedPlayerId(players, holeNumber)
      const r = computeLoneRanger(players, designatedId)
      return { ...base, formatScore: r.teamGrossScore, displayScore: r.teamGrossScore?.toString() ?? '-' }
    }
    case 'money_ball': {
      const designatedId = getRotatingDesignatedPlayerId(players, holeNumber)
      const mbPs = teamPlayerScores.find((ps) => ps.playerId === designatedId)
      const moneyBallLost = (mbPs?.extraData?.moneyBallLost as boolean) ?? false
      const penalty = (formatConfig?.moneyBallPenaltyStrokes as number) ?? 4
      const r = computeMoneyBall(players, designatedId, moneyBallLost, penalty)
      return {
        formatScore: r.teamGrossScore,
        displayScore: r.teamGrossScore?.toString() ?? '-',
        mbScore: r.moneyBallAdjustedScore,
        mbPenalty: r.moneyBallPenalty,
      }
    }
    case 'cha_cha_cha': {
      const r = computeChaChaCha(players, holeNumber)
      return { ...base, formatScore: r.teamGrossScore, displayScore: r.teamGrossScore?.toString() ?? '-' }
    }
    case 'shamble_team': {
      const countMode = (formatConfig?.shambleCountMode as string) ?? 'count_best_2'
      const r = computeShamble(
        players,
        countMode as 'count_best_1' | 'count_best_2' | 'count_best_3' | 'count_all'
      )
      return { ...base, formatScore: r.teamGrossScore, displayScore: r.teamGrossScore?.toString() ?? '-' }
    }
    case 'chicago_points_team': {
      const r = computeChicagoTeamPoints(players, par)
      return { ...base, formatScore: r.totalPoints, displayScore: r.totalPoints.toString() }
    }
    case 'train_game': {
      const r = computeTrainGame(players)
      return {
        ...base,
        formatScore: r.teamGrossScore,
        displayScore: r.teamDisplayScore ?? r.teamGrossScore?.toString() ?? '-',
      }
    }
    default:
      return base
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function RoundSummaryPage() {
  const params = useParams()
  const roundId = params.id as string

  const [round, setRound] = useState<Round | null>(null)
  const [payouts, setPayouts] = useState<Record<string, number>>({})
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [roundId])

  async function loadAll() {
    try {
      const roundRes = await fetch(`/api/rounds/${roundId}`)
      if (!roundRes.ok) return
      const roundData: Round = await roundRes.json()
      setRound(roundData)

      // Fetch payouts from server-side endpoint (fixes Prisma-in-client bug)
      if (roundData.format.formatCategory === 'skins') {
        const payoutsRes = await fetch(`/api/rounds/${roundId}/payouts`)
        if (payoutsRes.ok) {
          setPayouts(await payoutsRes.json())
        }
      }

      // Fetch individual player scores for non-skins formats
      if (roundData.format.requiresIndividualScores) {
        const psRes = await fetch(`/api/rounds/${roundId}/player-scores`)
        if (psRes.ok) {
          setPlayerScores(await psRes.json())
        }
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

  const isSkins = round.format.formatCategory === 'skins'
  const isPoints = round.format.formatCategory === 'points'
  const isMoneyBallFormat = round.format.id === 'money_ball'
  const totalPlayers = round.teams.reduce((sum, t) => sum + t.players.length, 0)
  const totalPot = totalPlayers * round.buyInPerPlayer
  const holeCount = round.course.holeCount || round.course.holes.length
  const skinValue = totalPot / holeCount

  // ── Skins: compute per-player winnings ────────────────────────────────────
  const playerWinnings = new Map<string, number>()
  if (isSkins) {
    round.teams.forEach((team) => {
      const teamPayout = payouts[team.id] || 0
      const perPlayer = teamPayout / team.players.length
      team.players.forEach((tp) => {
        const name = tp.player.fullName
        playerWinnings.set(name, (playerWinnings.get(name) || 0) + perPlayer)
      })
    })
  }
  const sortedPlayers = Array.from(playerWinnings.entries())
    .map(([name, winnings]) => ({ name, winnings }))
    .sort((a, b) => b.winnings - a.winnings)

  // ── Non-skins: compute team hole results and totals ───────────────────────
  const teamTotals = new Map<string, TeamTotals>()
  round.teams.forEach((t) => teamTotals.set(t.id, { total: null, mbTotal: null, mbLosses: 0 }))

  // Map<holeId, Map<teamId, TeamHoleResult>>
  const holeTeamResults = new Map<string, Map<string, TeamHoleResult>>()

  if (!isSkins) {
    round.course.holes.forEach((hole) => {
      const holeResults = new Map<string, TeamHoleResult>()
      round.teams.forEach((team) => {
        const teamPlayerScores = playerScores.filter(
          (ps) => ps.teamId === team.id && ps.holeId === hole.id
        )
        const result = computeHoleTeamResult(
          round.format.id,
          hole.holeNumber,
          hole.par,
          team,
          teamPlayerScores,
          round.formatConfig
        )
        holeResults.set(team.id, result)

        const current = teamTotals.get(team.id)!
        if (result.formatScore !== null) {
          current.total = (current.total ?? 0) + result.formatScore
        }
        if (isMoneyBallFormat && result.mbScore !== null) {
          current.mbTotal = (current.mbTotal ?? 0) + result.mbScore
          if (result.mbPenalty > 0) current.mbLosses++
        }
      })
      holeTeamResults.set(hole.id, holeResults)
    })
  }

  // Sort teams: ascending for stroke/match, descending for points
  const sortedTeams = [...round.teams].sort((a, b) => {
    const aTotal = teamTotals.get(a.id)?.total ?? (isPoints ? -Infinity : Infinity)
    const bTotal = teamTotals.get(b.id)?.total ?? (isPoints ? -Infinity : Infinity)
    return isPoints ? bTotal - aTotal : aTotal - bTotal
  })

  // Skins: group holeScores by holeId for hole-by-hole table
  const holeScoresByHole = new Map<string, HoleScore[]>()
  round.holeScores.forEach((hs) => {
    if (!holeScoresByHole.has(hs.holeId)) holeScoresByHole.set(hs.holeId, [])
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
            {format(new Date(round.date), 'MMMM d, yyyy')} • {round.course.name} •{' '}
            {round.format.shortLabel ?? round.format.name}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Round Stats */}
        <div className="bg-white rounded-lg shadow p-6">
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
              <div className="text-2xl font-bold text-primary-600">
                ${skinValue.toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">
                Per {isSkins ? 'Skin' : 'Hole'}
              </div>
            </div>
          </div>
        </div>

        {/* Skins: Player Winnings */}
        {isSkins && (
          <div className="bg-white rounded-lg shadow">
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
                          Won ${player.winnings.toFixed(2)} • Buy-in ${round.buyInPerPlayer.toFixed(2)}
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
        )}

        {/* Non-skins: Team Leaderboard */}
        {!isSkins && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold">Leaderboard</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {sortedTeams.map((team, idx) => {
                const totals = teamTotals.get(team.id)
                return (
                  <div key={team.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-gray-400 w-8">#{idx + 1}</span>
                      <div>
                        <h3 className="font-semibold text-lg">{team.name}</h3>
                        <p className="text-sm text-gray-600">
                          {team.players
                            .map((tp) => tp.player.nickname ?? tp.player.fullName)
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-600">
                        {totals?.total !== null && totals?.total !== undefined
                          ? totals.total
                          : '-'}
                      </div>
                      <div className="text-xs text-gray-500">{isPoints ? 'pts' : 'strokes'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Money Ball: dual score table */}
        {isMoneyBallFormat && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold">Money Ball Scores</h2>
              <p className="text-sm text-gray-500 mt-1">
                Competition score is independent from the Money Ball score
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-center">Competition</th>
                    <th className="px-4 py-3 text-center">MB Total</th>
                    <th className="px-4 py-3 text-center">MB Lost</th>
                    <th className="px-4 py-3 text-center">Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {round.teams.map((team) => {
                    const totals = teamTotals.get(team.id)
                    const penaltyStrokes =
                      (round.formatConfig?.moneyBallPenaltyStrokes as number) ?? 4
                    return (
                      <tr key={team.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{team.name}</td>
                        <td className="px-4 py-3 text-center">{totals?.total ?? '-'}</td>
                        <td className="px-4 py-3 text-center">{totals?.mbTotal ?? '-'}</td>
                        <td className="px-4 py-3 text-center">{totals?.mbLosses ?? 0}</td>
                        <td className="px-4 py-3 text-center text-red-600">
                          {totals?.mbLosses
                            ? `+${totals.mbLosses * penaltyStrokes}`
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hole-by-Hole Results */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Hole-by-Hole</h2>
          </div>
          <div className="overflow-x-auto">
            {isSkins ? (
              // ── Skins hole-by-hole ──────────────────────────────────────────
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

                    const maxScore = Math.max(...scores.map((s) => s.value ?? -Infinity))
                    const winners = scores.filter((s) => s.value === maxScore && maxScore > 0)
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
                            winningTeam?.id === team.id && (teamScore?.value ?? 0) > 0
                          return (
                            <td
                              key={team.id}
                              className={`px-4 py-3 text-center font-semibold ${
                                isWinner ? 'bg-green-100 text-green-800' : ''
                              }`}
                            >
                              {teamScore?.value === null || teamScore?.value === 0
                                ? 'X'
                                : teamScore?.value}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center text-sm">
                          {winningTeam
                            ? winningTeam.name
                            : winners.length > 1
                            ? 'Tie'
                            : 'Push'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {payout > 0 ? `$${payout.toFixed(0)}` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              // ── Non-skins hole-by-hole ──────────────────────────────────────
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {round.course.holes.map((hole) => (
                    <tr key={hole.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{hole.holeNumber}</td>
                      <td className="px-4 py-3 text-center">{hole.par}</td>
                      {round.teams.map((team) => {
                        const result = holeTeamResults.get(hole.id)?.get(team.id)
                        return (
                          <td key={team.id} className="px-4 py-3 text-center font-semibold">
                            {result?.displayScore ?? '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    {round.teams.map((team) => (
                      <td key={team.id} className="px-4 py-3 text-center">
                        {teamTotals.get(team.id)?.total ?? '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
