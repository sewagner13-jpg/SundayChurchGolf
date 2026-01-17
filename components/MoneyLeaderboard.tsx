'use client'

import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  playerId: string
  fullName: string
  nickname?: string | null
  totalWinnings: number
}

interface MoneyLeaderboardProps {
  seasonId: string
}

export default function MoneyLeaderboard({ seasonId }: MoneyLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [seasonId])

  async function loadLeaderboard() {
    try {
      const response = await fetch(`/api/leaderboard?seasonId=${seasonId}`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading leaderboard...</div>
  }

  if (leaderboard.length === 0) {
    return <div className="text-center py-8 text-gray-500">No winnings yet for this season.</div>
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold">Money Leaderboard</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.playerId}
            className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-400 w-8">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {entry.fullName}
                  {entry.nickname && (
                    <span className="text-gray-500 font-normal ml-2">
                      "{entry.nickname}"
                    </span>
                  )}
                </h3>
              </div>
            </div>
            <div className="text-xl font-bold text-green-600">
              ${entry.totalWinnings.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
