'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  computeFormatScore,
  computeChicagoTeamPoints,
  getRotatingDesignatedPlayerId,
  type PlayerInput,
} from '@/lib/scoring-engine'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TeamPlayer {
  id: string
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

interface Hole {
  id: string
  holeNumber: number
  par: number
  handicapRank: number
}

interface HoleScore {
  teamId: string
  holeId: string
  underParStrokes: number | null
}

interface RoundFormat {
  id: string
  name: string
  formatCategory: string
  requiresIndividualScores: boolean
  requiresDesignatedPlayer: boolean
  requiresDriveTracking: boolean
}

interface Round {
  id: string
  isLocked: boolean
  buyInPerPlayer: number
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

// Key helpers
const skinsKey = (teamId: string, holeId: string) => `${teamId}-${holeId}`
const playerKey = (playerId: string, holeId: string) => `${playerId}-${holeId}`
const mbLostKey = (teamId: string, holeId: string) => `mb-${teamId}-${holeId}`
const driveKey = (teamId: string, holeId: string) => `drive-${teamId}-${holeId}`

// ─── Component ─────────────────────────────────────────────────────────────

export default function LiveScoringPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.id as string

  const [round, setRound] = useState<Round | null>(null)
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showHolePicker, setShowHolePicker] = useState(false)

  // Skins format: team-level under-par scores
  const [skinsScores, setSkinsScores] = useState<Map<string, number | null>>(new Map())

  // Individual-score formats: player gross scores
  const [playerScores, setPlayerScores] = useState<Map<string, number | null>>(new Map())

  // Money Ball: lost-ball toggle per team per hole
  const [moneyBallLost, setMoneyBallLost] = useState<Map<string, boolean>>(new Map())

  // Drive tracking: selected driver per team per hole
  const [driveSelected, setDriveSelected] = useState<Map<string, string>>(new Map())

  useEffect(() => { loadRound() }, [roundId])

  // Load cached state from localStorage
  useEffect(() => {
    const cachedSkins = localStorage.getItem(`round-${roundId}-scores`)
    if (cachedSkins) {
      setSkinsScores(new Map(Object.entries(JSON.parse(cachedSkins))))
    }
    const cachedPlayer = localStorage.getItem(`round-${roundId}-player-scores`)
    if (cachedPlayer) {
      setPlayerScores(new Map(Object.entries(JSON.parse(cachedPlayer)).map(([k, v]) => [k, v as number | null])))
    }
  }, [roundId])

  // Persist skins scores to localStorage
  useEffect(() => {
    if (skinsScores.size > 0) {
      localStorage.setItem(`round-${roundId}-scores`, JSON.stringify(Object.fromEntries(skinsScores)))
    }
  }, [skinsScores, roundId])

  // Persist player scores to localStorage
  useEffect(() => {
    if (playerScores.size > 0) {
      localStorage.setItem(`round-${roundId}-player-scores`, JSON.stringify(Object.fromEntries(playerScores)))
    }
  }, [playerScores, roundId])

  async function loadRound() {
    try {
      const response = await fetch(`/api/rounds/${roundId}`)
      if (!response.ok) return
      const data: Round = await response.json()
      setRound(data)

      // Init skins scores from DB
      const initSkins = new Map<string, number | null>()
      data.holeScores.forEach((hs) => {
        initSkins.set(skinsKey(hs.teamId, hs.holeId), hs.underParStrokes)
      })
      setSkinsScores(initSkins)

      // Load player scores from API
      if (data.format.requiresIndividualScores) {
        const psRes = await fetch(`/api/rounds/${roundId}/player-scores`)
        if (psRes.ok) {
          const psData = await psRes.json()
          const initPlayer = new Map<string, number | null>()
          psData.forEach((ps: { playerId: string; holeId: string; grossScore: number | null; extraData?: Record<string, unknown> }) => {
            initPlayer.set(playerKey(ps.playerId, ps.holeId), ps.grossScore)
            if (ps.extraData?.driveSelected) {
              setDriveSelected((prev) => {
                const next = new Map(prev)
                const teamPlayer = data.teams
                  .flatMap((t) => t.players.map((p) => ({ teamId: t.id, playerId: p.player.id })))
                  .find((tp) => tp.playerId === ps.playerId)
                if (teamPlayer) {
                  next.set(driveKey(teamPlayer.teamId, ps.holeId), ps.playerId)
                }
                return next
              })
            }
          })
          setPlayerScores(initPlayer)
        }
      }
    } catch (error) {
      console.error('Failed to load round:', error)
    }
  }

  // ── Skins score update ────────────────────────────────────────────────────

  async function updateSkinsScore(teamId: string, holeId: string, value: number | null) {
    const key = skinsKey(teamId, holeId)
    setSkinsScores((prev) => new Map(prev).set(key, value))

    setSaving(true)
    try {
      await fetch(`/api/rounds/${roundId}/scores`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, holeId, underParStrokes: value }),
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Player score update ───────────────────────────────────────────────────

  const savePlayerScoresBatch = useCallback(
    async (
      batch: Array<{ teamId: string; playerId: string; holeId: string; grossScore: number | null; extraData?: Record<string, unknown> }>
    ) => {
      setSaving(true)
      try {
        await fetch(`/api/rounds/${roundId}/player-scores`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: batch }),
        })
      } finally {
        setSaving(false)
      }
    },
    [roundId]
  )

  function updatePlayerScore(teamId: string, playerId: string, holeId: string, value: number | null) {
    const key = playerKey(playerId, holeId)
    setPlayerScores((prev) => new Map(prev).set(key, value))
    savePlayerScoresBatch([{ teamId, playerId, holeId, grossScore: value }])
  }

  function updateDriveSelected(teamId: string, holeId: string, playerId: string) {
    setDriveSelected((prev) => new Map(prev).set(driveKey(teamId, holeId), playerId))
    // Save all player scores for this team/hole with updated driveSelected
    if (!round) return
    const team = round.teams.find((t) => t.id === teamId)
    if (!team) return
    const batch = team.players.map((tp) => ({
      teamId,
      playerId: tp.player.id,
      holeId,
      grossScore: playerScores.get(playerKey(tp.player.id, holeId)) ?? null,
      extraData: { driveSelected: tp.player.id === playerId },
    }))
    savePlayerScoresBatch(batch)
  }

  function toggleMoneyBallLost(teamId: string, holeId: string) {
    const key = mbLostKey(teamId, holeId)
    setMoneyBallLost((prev) => {
      const next = new Map(prev)
      next.set(key, !prev.get(key))
      return next
    })
  }

  // ── Lock round ────────────────────────────────────────────────────────────

  async function lockRound() {
    if (!confirm('Lock this round? This will finalize all scores.')) return
    try {
      await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: true }),
      })
      localStorage.removeItem(`round-${roundId}-scores`)
      localStorage.removeItem(`round-${roundId}-player-scores`)
      router.push(`/rounds/${roundId}/summary`)
    } catch (error) {
      console.error('Failed to lock round:', error)
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!round) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  const holeCount = round.course.holeCount || round.course.holes.length
  const currentHole = round.course.holes[currentHoleIdx]
  if (!currentHole) return null

  const isSkins = round.format.formatCategory === 'skins'
  const formatConfig = round.formatConfig ?? {}

  // ── Skins: carryover and winner display ───────────────────────────────────

  const totalPlayers = round.teams.reduce((sum, t) => sum + t.players.length, 0)
  const totalPot = totalPlayers * round.buyInPerPlayer
  const skinValue = totalPot / holeCount

  let carryover = 0
  if (isSkins) {
    for (let i = 0; i <= currentHoleIdx; i++) {
      const hole = round.course.holes[i]
      const holeScores = round.teams.map((team) => skinsScores.get(skinsKey(team.id, hole.id)) ?? 0)
      const maxScore = Math.max(...holeScores)
      const winners = holeScores.filter((s) => s === maxScore && s > 0)
      if (winners.length === 1) carryover = 0
      else carryover += 1
    }
  }

  const currentHoleSkinsScores = round.teams.map((team) => ({
    teamId: team.id,
    score: skinsScores.get(skinsKey(team.id, currentHole.id)) ?? 0,
  }))
  const maxCurrentScore = Math.max(...currentHoleSkinsScores.map((s) => s.score))
  const currentWinners = currentHoleSkinsScores.filter((s) => s.score === maxCurrentScore && s.score > 0)

  let winnerMessage = 'Tied - skin carries'
  if (isSkins) {
    if (currentWinners.length === 1) {
      const winningTeam = round.teams.find((t) => t.id === currentWinners[0].teamId)
      winnerMessage = `${winningTeam?.name} wins!`
    }
  }

  // ── Individual: build player inputs for current hole ─────────────────────

  function getTeamPlayerInputs(team: Team): PlayerInput[] {
    const driverPlayerId = driveSelected.get(driveKey(team.id, currentHole.id))
    return team.players.map((tp) => ({
      playerId: tp.player.id,
      playerName: tp.player.fullName,
      grossScore: playerScores.get(playerKey(tp.player.id, currentHole.id)) ?? null,
      driveSelected: tp.player.id === driverPlayerId,
    }))
  }

  function getDesignatedPlayerName(team: Team): string {
    const inputs = getTeamPlayerInputs(team)
    const playerId = getRotatingDesignatedPlayerId(inputs, currentHole.holeNumber)
    const tp = team.players.find((p) => p.player.id === playerId)
    return tp?.player.fullName ?? ''
  }

  function getDesignatedLabel(): string {
    switch (round!.format.id) {
      case 'lone_ranger': return 'Lone Ranger'
      case 'money_ball': return 'Money Ball'
      case 'scramble_rotating_drives': return 'Required Driver'
      case 'wolf_team': return 'Wolf'
      default: return 'Designated Player'
    }
  }

  function computeTeamPreview(team: Team): string {
    const inputs = getTeamPlayerInputs(team)
    const allNull = inputs.every((p) => p.grossScore === null)
    if (allNull) return '—'

    const mbLost = moneyBallLost.get(mbLostKey(team.id, currentHole.id)) ?? false
    const result = computeFormatScore(
      round!.format.id,
      inputs,
      currentHole.holeNumber,
      currentHole.par,
      { moneyBallLost: mbLost },
      formatConfig
    )

    if (!result) {
      // Chicago Points
      if (round!.format.id === 'chicago_points_team') {
        const { totalPoints } = computeChicagoTeamPoints(inputs, currentHole.par)
        return `${totalPoints} pts`
      }
      return '—'
    }

    if (result.teamDisplayScore) return result.teamDisplayScore
    if (result.teamGrossScore !== null) {
      const label = round!.format.formatCategory === 'points' ? ' pts' : ''
      return `${result.teamGrossScore}${label}`
    }
    return '—'
  }

  // ── Irish Golf segment label ───────────────────────────────────────────────

  function getIrishSegmentLabel(): string | null {
    if (round!.format.id !== 'irish_golf_6_6_6') return null
    const h = currentHole.holeNumber
    if (h <= 6) return `Seg 1 (${formatConfig.segment1FormatId ?? '?'})`
    if (h <= 12) return `Seg 2 (${formatConfig.segment2FormatId ?? '?'})`
    return `Seg 3 (${formatConfig.segment3FormatId ?? '?'})`
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Sticky Header */}
      <header className="bg-primary-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <Link href="/" className="text-2xl">←</Link>
            <button
              onClick={() => setShowHolePicker(!showHolePicker)}
              className="font-bold text-lg"
            >
              Hole {currentHole.holeNumber} • Par {currentHole.par} • HCP {currentHole.handicapRank}
            </button>
            <button className="text-2xl opacity-0">→</button>
          </div>
          <div className="flex items-center justify-between text-sm text-primary-100">
            {isSkins ? (
              <span>
                {carryover > 1 ? `${carryover} skins` : `${carryover} skin`} • $
                {(skinValue * carryover).toFixed(0)}
              </span>
            ) : (
              <span>{round.format.name}{getIrishSegmentLabel() ? ` · ${getIrishSegmentLabel()}` : ''}</span>
            )}
            {saving && <span>Saving…</span>}
          </div>
        </div>
      </header>

      {/* Hole Picker Modal */}
      {showHolePicker && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 flex items-center justify-center p-4"
          onClick={() => setShowHolePicker(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">Select Hole</h3>
            <div className="grid grid-cols-6 gap-2">
              {round.course.holes.map((hole, idx) => (
                <button
                  key={hole.id}
                  onClick={() => { setCurrentHoleIdx(idx); setShowHolePicker(false) }}
                  className={`px-3 py-2 rounded font-semibold text-sm ${
                    idx === currentHoleIdx
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {hole.holeNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Scoring Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ── SKINS FORMAT ── */}
          {isSkins && round.teams.map((team) => {
            const currentScore = skinsScores.get(skinsKey(team.id, currentHole.id))
            return (
              <div key={team.id} className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-lg mb-1">{team.name}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {team.players.map((p) => p.player.fullName).join(', ')}
                </p>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-primary-600 mb-1">
                    {currentScore === null || currentScore === undefined ? 'X' : currentScore}
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentScore && currentScore > 0
                      ? `${currentScore} under par ${currentScore === 1 ? 'make' : 'makes'}`
                      : 'No under-par scores'}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => updateSkinsScore(team.id, currentHole.id, (currentScore || 0) + 1)}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 active:bg-blue-800"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => updateSkinsScore(team.id, currentHole.id, (currentScore || 0) + 2)}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg font-bold text-lg hover:bg-purple-700 active:bg-purple-800"
                  >
                    +2
                  </button>
                  <button
                    onClick={() => updateSkinsScore(team.id, currentHole.id, null)}
                    className="px-4 py-3 bg-gray-600 text-white rounded-lg font-bold text-lg hover:bg-gray-700"
                  >
                    X
                  </button>
                  <button
                    onClick={() => updateSkinsScore(team.id, currentHole.id, null)}
                    className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )
          })}

          {/* ── INDIVIDUAL SCORE FORMATS ── */}
          {!isSkins && round.teams.map((team) => {
            const inputs = getTeamPlayerInputs(team)
            const isDesignated = round.format.requiresDesignatedPlayer
            const isMB = round.format.id === 'money_ball'
            const isDriveTracking = round.format.requiresDriveTracking
            const mbLostForHole = moneyBallLost.get(mbLostKey(team.id, currentHole.id)) ?? false
            const designatedLabel = getDesignatedLabel()
            const designatedName = isDesignated ? getDesignatedPlayerName(team) : ''
            const driverPlayerId = driveSelected.get(driveKey(team.id, currentHole.id))

            return (
              <div key={team.id} className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-lg mb-1">{team.name}</h3>

                {/* Designated player banner */}
                {isDesignated && designatedName && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm font-medium text-amber-800">
                    {designatedLabel}: {designatedName}
                  </div>
                )}

                {/* Money Ball lost toggle */}
                {isMB && (
                  <div className="mb-3">
                    <button
                      onClick={() => toggleMoneyBallLost(team.id, currentHole.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                        mbLostForHole
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {mbLostForHole ? 'Money Ball Lost (+4 MB penalty)' : 'Money Ball: In Play'}
                    </button>
                  </div>
                )}

                {/* Per-player score entry */}
                <div className="space-y-3">
                  {team.players.map((tp) => {
                    const score = playerScores.get(playerKey(tp.player.id, currentHole.id)) ?? null
                    const isDesignatedPlayer =
                      isDesignated &&
                      getRotatingDesignatedPlayerId(inputs, currentHole.holeNumber) === tp.player.id

                    return (
                      <div
                        key={tp.player.id}
                        className={`rounded-lg p-3 ${
                          isDesignatedPlayer
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {tp.player.fullName}
                            {isDesignatedPlayer && (
                              <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                                {designatedLabel}
                              </span>
                            )}
                          </span>

                          {/* Drive selector */}
                          {isDriveTracking && (
                            <button
                              onClick={() => updateDriveSelected(team.id, currentHole.id, tp.player.id)}
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                driverPlayerId === tp.player.id
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {driverPlayerId === tp.player.id ? 'Drive used' : 'Use drive'}
                            </button>
                          )}
                        </div>

                        {/* Score stepper */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const newVal = score !== null ? Math.max(1, score - 1) : null
                              updatePlayerScore(team.id, tp.player.id, currentHole.id, newVal)
                            }}
                            disabled={score === null || score <= 1}
                            className="w-10 h-10 bg-gray-200 rounded-lg font-bold text-lg hover:bg-gray-300 disabled:opacity-40"
                          >
                            −
                          </button>
                          <div className="flex-1 text-center">
                            <span className={`text-3xl font-bold ${
                              score === null ? 'text-gray-400' : 'text-primary-600'
                            }`}>
                              {score === null ? '—' : score}
                            </span>
                            {score !== null && (
                              <span className="block text-xs text-gray-500">
                                {score - currentHole.par > 0
                                  ? `+${score - currentHole.par}`
                                  : score - currentHole.par < 0
                                  ? `${score - currentHole.par}`
                                  : 'E'}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              updatePlayerScore(team.id, tp.player.id, currentHole.id, (score ?? currentHole.par) + 1)
                            }
                            className="w-10 h-10 bg-gray-200 rounded-lg font-bold text-lg hover:bg-gray-300"
                          >
                            +
                          </button>
                          <button
                            onClick={() =>
                              updatePlayerScore(team.id, tp.player.id, currentHole.id, score === null ? currentHole.par : null)
                            }
                            className={`w-10 h-10 rounded-lg font-bold text-sm ${
                              score === null
                                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                          >
                            {score === null ? 'Set' : 'X'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Team score preview */}
                <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                  <span className="text-sm text-gray-600">Team score: </span>
                  <span className="font-bold text-primary-600">{computeTeamPreview(team)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Winner message (skins) */}
        {isSkins && (
          <div className="max-w-2xl mx-auto mt-4 bg-primary-50 border-2 border-primary-600 rounded-lg p-4 text-center">
            <p className="font-bold text-lg text-primary-900">{winnerMessage}</p>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="bg-white border-t border-gray-300 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCurrentHoleIdx(Math.max(0, currentHoleIdx - 1))}
              disabled={currentHoleIdx === 0}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <div className="text-sm font-medium text-gray-600">
              {currentHoleIdx + 1} / {holeCount}
            </div>
            <button
              onClick={() => setCurrentHoleIdx(Math.min(holeCount - 1, currentHoleIdx + 1))}
              disabled={currentHoleIdx === holeCount - 1}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
          {currentHoleIdx === holeCount - 1 && (
            <button
              onClick={lockRound}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
            >
              Lock Round & View Results
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
