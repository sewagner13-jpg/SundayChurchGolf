'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

interface Round {
  id: string
  isLocked: boolean
  buyInPerPlayer: number
  course: {
    name: string
    holes: Hole[]
  }
  teams: Team[]
  holeScores: HoleScore[]
}

export default function LiveScoringPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.id as string

  const [round, setRound] = useState<Round | null>(null)
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0)
  const [scores, setScores] = useState<Map<string, number | null>>(new Map())
  const [saving, setSaving] = useState(false)
  const [showHolePicker, setShowHolePicker] = useState(false)

  useEffect(() => {
    loadRound()
  }, [roundId])

  useEffect(() => {
    // Load cached scores from localStorage
    const cached = localStorage.getItem(`round-${roundId}-scores`)
    if (cached) {
      const parsedScores = JSON.parse(cached)
      setScores(new Map(Object.entries(parsedScores)))
    }
  }, [roundId])

  useEffect(() => {
    // Save scores to localStorage whenever they change
    if (scores.size > 0) {
      const scoresObj = Object.fromEntries(scores)
      localStorage.setItem(`round-${roundId}-scores`, JSON.stringify(scoresObj))
    }
  }, [scores, roundId])

  async function loadRound() {
    try {
      const response = await fetch(`/api/rounds/${roundId}`)
      if (response.ok) {
        const data = await response.json()
        setRound(data)

        // Initialize scores from existing hole scores
        const initialScores = new Map<string, number | null>()
        data.holeScores.forEach((hs: HoleScore) => {
          const key = `${hs.teamId}-${hs.holeId}`
          initialScores.set(key, hs.underParStrokes)
        })
        setScores(initialScores)
      }
    } catch (error) {
      console.error('Failed to load round:', error)
    }
  }

  async function updateScore(teamId: string, holeId: string, value: number | null) {
    const key = `${teamId}-${holeId}`
    const newScores = new Map(scores)
    newScores.set(key, value)
    setScores(newScores)

    // Save to server
    setSaving(true)
    try {
      await fetch(`/api/rounds/${roundId}/scores`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, holeId, underParStrokes: value }),
      })
    } catch (error) {
      console.error('Failed to save score:', error)
    } finally {
      setSaving(false)
    }
  }

  async function lockRound() {
    if (!confirm('Are you sure you want to lock this round? This will finalize all scores.')) {
      return
    }

    try {
      await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: true }),
      })

      // Clear localStorage
      localStorage.removeItem(`round-${roundId}-scores`)
      router.push(`/rounds/${roundId}/summary`)
    } catch (error) {
      console.error('Failed to lock round:', error)
    }
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  const currentHole = round.course.holes[currentHoleIdx]
  if (!currentHole) return null

  const totalPlayers = round.teams.reduce((sum, t) => sum + t.players.length, 0)
  const totalPot = totalPlayers * round.buyInPerPlayer
  const skinValue = totalPot / 18

  // Calculate carryover for display
  let carryover = 0
  for (let i = 0; i <= currentHoleIdx; i++) {
    const hole = round.course.holes[i]
    const holeScores = round.teams.map((team) => {
      const key = `${team.id}-${hole.id}`
      return scores.get(key) ?? 0
    })
    const maxScore = Math.max(...holeScores)
    const winners = holeScores.filter((s) => s === maxScore && s > 0)

    if (winners.length === 1) {
      carryover = 0
    } else {
      carryover += 1
    }
  }

  // Determine current hole winner
  const currentHoleScores = round.teams.map((team) => {
    const key = `${team.id}-${currentHole.id}`
    return { teamId: team.id, score: scores.get(key) ?? 0 }
  })
  const maxCurrentScore = Math.max(...currentHoleScores.map((s) => s.score))
  const currentWinners = currentHoleScores.filter((s) => s.score === maxCurrentScore && s.score > 0)

  let winnerMessage = ''
  if (currentWinners.length === 0 || maxCurrentScore === 0) {
    winnerMessage = 'Tied - skin carries'
  } else if (currentWinners.length === 1) {
    const winningTeam = round.teams.find((t) => t.id === currentWinners[0].teamId)
    winnerMessage = `${winningTeam?.name} wins!`
  } else {
    winnerMessage = 'Tied - skin carries'
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Sticky Header */}
      <header className="bg-primary-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Link href="/" className="text-2xl">
              ←
            </Link>
            <button
              onClick={() => setShowHolePicker(!showHolePicker)}
              className="font-bold text-lg"
            >
              Hole {currentHole.holeNumber} • Par {currentHole.par} • HCP{' '}
              {currentHole.handicapRank}
            </button>
            <button className="text-2xl opacity-0">→</button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-primary-100">
              {carryover > 1 ? `${carryover} skins` : `${carryover} skin`} • $
              {(skinValue * carryover).toFixed(0)}
            </div>
            {saving && <div className="text-primary-100">Saving...</div>}
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
                  onClick={() => {
                    setCurrentHoleIdx(idx)
                    setShowHolePicker(false)
                  }}
                  className={`px-3 py-2 rounded font-semibold ${
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
          {round.teams.map((team) => {
            const key = `${team.id}-${currentHole.id}`
            const currentScore = scores.get(key)
            const displayScore = currentScore === null ? 'X' : currentScore

            return (
              <div key={team.id} className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-lg mb-1">{team.name}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {team.players.map((p) => p.player.fullName).join(', ')}
                </p>

                {/* Score Display */}
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-primary-600 mb-2">
                    {displayScore}
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentScore && currentScore > 0
                      ? `${currentScore} under par ${currentScore === 1 ? 'make' : 'makes'}`
                      : 'No under-par scores'}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() =>
                      updateScore(team.id, currentHole.id, (currentScore || 0) + 1)
                    }
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 active:bg-blue-800"
                  >
                    +1
                  </button>
                  <button
                    onClick={() =>
                      updateScore(team.id, currentHole.id, (currentScore || 0) + 2)
                    }
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg font-bold text-lg hover:bg-purple-700 active:bg-purple-800"
                  >
                    +2
                  </button>
                  <button
                    onClick={() => updateScore(team.id, currentHole.id, null)}
                    className="px-4 py-3 bg-gray-600 text-white rounded-lg font-bold text-lg hover:bg-gray-700 active:bg-gray-800"
                  >
                    X
                  </button>
                  <button
                    onClick={() => updateScore(team.id, currentHole.id, null)}
                    className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 active:bg-red-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Winner Message */}
        <div className="max-w-2xl mx-auto mt-6 bg-primary-50 border-2 border-primary-600 rounded-lg p-4 text-center">
          <p className="font-bold text-lg text-primary-900">{winnerMessage}</p>
        </div>
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
              {currentHoleIdx + 1} / 18
            </div>
            <button
              onClick={() =>
                setCurrentHoleIdx(Math.min(17, currentHoleIdx + 1))
              }
              disabled={currentHoleIdx === 17}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
          {currentHoleIdx === 17 && (
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
