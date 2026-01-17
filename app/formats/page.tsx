'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Format {
  id: string
  name: string
  description: string
  defaultTeamSize: number
}

export default function FormatsPage() {
  const [formats, setFormats] = useState<Format[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultTeamSize: '4',
  })

  useEffect(() => {
    loadFormats()
  }, [])

  async function loadFormats() {
    try {
      const response = await fetch('/api/formats')
      if (response.ok) {
        const data = await response.json()
        setFormats(data)
      }
    } catch (error) {
      console.error('Failed to load formats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const response = await fetch('/api/formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setFormData({ name: '', description: '', defaultTeamSize: '4' })
        setShowForm(false)
        loadFormats()
      }
    } catch (error) {
      console.error('Failed to create format:', error)
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
            <h1 className="text-3xl font-bold">Formats</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50"
          >
            {showForm ? 'Cancel' : '+ Add Format'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Add New Format</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Team Size *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.defaultTeamSize}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTeamSize: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
              >
                Create Format
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              Loading formats...
            </div>
          ) : formats.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              No formats yet. Run the seed script to add the default Sunday Church format.
            </div>
          ) : (
            formats.map((format) => (
              <div key={format.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-2">{format.name}</h3>
                <p className="text-gray-600 mb-4">{format.description}</p>
                <div className="text-sm text-gray-500">
                  Default team size: {format.defaultTeamSize} players
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
