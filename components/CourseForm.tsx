'use client'

import { useState } from 'react'

interface HoleData {
  holeNumber: number
  par: number
  handicapRank: number
}

interface CourseFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function CourseForm({ onSuccess, onCancel }: CourseFormProps) {
  const [name, setName] = useState('')
  const [holeCount, setHoleCount] = useState(18)
  const [holes, setHoles] = useState<HoleData[]>([])
  const [error, setError] = useState('')

  // Initialize holes when count changes
  const handleHoleCountChange = (count: number) => {
    setHoleCount(count)
    const newHoles: HoleData[] = Array.from({ length: count }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      handicapRank: i + 1,
    }))
    setHoles(newHoles)
  }

  const updateHole = (index: number, field: keyof HoleData, value: number) => {
    const updated = [...holes]
    updated[index][field] = value
    setHoles(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, holes }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create course')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Course Name *
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Number of Holes *
        </label>
        <select
          value={holeCount}
          onChange={(e) => handleHoleCountChange(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value={9}>9 Holes</option>
          <option value={18}>18 Holes</option>
        </select>
      </div>

      {holes.length > 0 && (
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Hole</th>
                <th className="px-3 py-2 text-center">Par</th>
                <th className="px-3 py-2 text-center">Handicap Rank</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((hole, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2 font-medium">{hole.holeNumber}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="3"
                      max="6"
                      value={hole.par}
                      onChange={(e) => updateHole(idx, 'par', Number(e.target.value))}
                      className="w-16 px-2 py-1 border rounded text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      max={holeCount}
                      value={hole.handicapRank}
                      onChange={(e) => updateHole(idx, 'handicapRank', Number(e.target.value))}
                      className="w-16 px-2 py-1 border rounded text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
        >
          Create Course
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
