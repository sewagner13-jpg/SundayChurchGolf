'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

interface Round {
  id: string
  date: string
  isLocked: boolean
  course: {
    name: string
  }
  format: {
    name: string
  }
  teams: any[]
}

export default function Dashboard() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRounds()
  }, [currentYear])

  async function loadRounds() {
    try {
      setLoading(true)
      const response = await fetch(`/api/rounds?seasonId=${currentYear}`)
      if (response.ok) {
        const data = await response.json()
        setRounds(data)
      }
    } catch (error) {
      console.error('Failed to load rounds:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Sunday Church Golf</h1>
          <p className="text-primary-100 mt-1">Track your skins game</p>
        </div>
      </header>

      {/* Season Selector */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentYear(currentYear - 1)}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                ← {currentYear - 1}
              </button>
              <h2 className="text-2xl font-bold">{currentYear} Season</h2>
              <button
                onClick={() => setCurrentYear(currentYear + 1)}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                {currentYear + 1} →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            href="/rounds/new"
            className="bg-primary-600 text-white p-6 rounded-lg shadow hover:bg-primary-700 transition"
          >
            <h3 className="text-xl font-semibold mb-2">New Round</h3>
            <p className="text-primary-100">Start a new game</p>
          </Link>
          <Link
            href="/players"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
          >
            <h3 className="text-xl font-semibold mb-2">Players</h3>
            <p className="text-gray-600">Manage players</p>
          </Link>
          <Link
            href="/courses"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
          >
            <h3 className="text-xl font-semibold mb-2">Courses</h3>
            <p className="text-gray-600">Manage courses</p>
          </Link>
          <Link
            href="/stats"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
          >
            <h3 className="text-xl font-semibold mb-2">Stats</h3>
            <p className="text-gray-600">Season leaderboard</p>
          </Link>
        </div>

        {/* Rounds List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Recent Rounds</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Loading rounds...
              </div>
            ) : rounds.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No rounds yet for {currentYear}
              </div>
            ) : (
              rounds.map((round) => (
                <Link
                  key={round.id}
                  href={
                    round.isLocked
                      ? `/rounds/${round.id}/summary`
                      : `/rounds/${round.id}/score`
                  }
                  className="block px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {format(new Date(round.date), 'MMMM d, yyyy')}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {round.course.name} • {round.format.name}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {round.teams.length} teams
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {round.isLocked && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          Complete
                        </span>
                      )}
                      <svg
                        className="w-6 h-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
