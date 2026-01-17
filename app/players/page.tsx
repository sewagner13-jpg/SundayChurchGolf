'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Player {
  id: string
  fullName: string
  nickname?: string | null
  handicapIndex?: number | null
  isActive: boolean
}

export default function PlayersPage() {
  const { data: session, status } = useSession()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    nickname: '',
    handicapIndex: '',
    ghinNumber: '',
    isActive: true,
  })

  const isAdmin = status === 'authenticated' && session?.user?.role === 'ADMIN'

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    try {
      const response = await fetch('/api/players')
      if (response.ok) {
        const data = await response.json()
        setPlayers(data)
      }
    } catch (error) {
      console.error('Failed to load players:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setFormData({ fullName: '', nickname: '', handicapIndex: '', ghinNumber: '', isActive: true })
        setShowForm(false)
        loadPlayers()
      }
    } catch (error) {
      console.error('Failed to create player:', error)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (response.ok) {
        loadPlayers()
      }
    } catch (error) {
      console.error('Failed to update player:', error)
    }
  }

  async function handleSyncHandicaps() {
    if (!confirm('Sync all player handicaps from GHIN?')) return

    setSyncing(true)
    try {
      const response = await fetch('/api/players/sync-handicaps', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Synced ${data.playersUpdated} players successfully`)
        loadPlayers()
      }
    } catch (error) {
      alert('Failed to sync handicaps')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-primary-100 hover:text-white mb-2 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Players</h1>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={handleSyncHandicaps}
                disabled={syncing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Handicaps'}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50"
              >
                {showForm ? 'Cancel' : '+ Add Player'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Add New Player</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nickname
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handicap Index
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.handicapIndex}
                  onChange={(e) =>
                    setFormData({ ...formData, handicapIndex: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GHIN Number
                </label>
                <input
                  type="text"
                  value={formData.ghinNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, ghinNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 1234567"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
              >
                Create Player
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Loading players...
              </div>
            ) : players.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No players yet. Add your first player to get started!
              </div>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className={player.isActive ? '' : 'opacity-50'}>
                    <h3 className="font-semibold text-lg">
                      {player.fullName}
                      {player.nickname && (
                        <span className="text-gray-500 font-normal ml-2">
                          "{player.nickname}"
                        </span>
                      )}
                    </h3>
                    {player.handicapIndex !== null && (
                      <p className="text-sm text-gray-600">
                        Handicap: {player.handicapIndex}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(player.id, player.isActive)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      player.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {player.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
