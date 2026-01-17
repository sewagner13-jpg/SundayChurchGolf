'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  scorecardImage?: string | null
  holes: Array<{
    holeNumber: number
    par: number
    handicapRank: number
  }>
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  useEffect(() => {
    loadCourses()
  }, [])

  async function loadCourses() {
    try {
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
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
          <h1 className="text-3xl font-bold">Courses</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Courses List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">Available Courses</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  Loading courses...
                </div>
              ) : courses.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  No courses yet. Run the seed script to add Timberlake Country Club.
                </div>
              ) : (
                courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition ${
                      selectedCourse?.id === course.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <h3 className="font-semibold text-lg">{course.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {course.holes.length} holes
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Course Details */}
          {selectedCourse && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold">{selectedCourse.name}</h2>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Hole</th>
                        <th className="text-center py-2 px-2">Par</th>
                        <th className="text-center py-2 px-2">HCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCourse.holes
                        .sort((a, b) => a.holeNumber - b.holeNumber)
                        .map((hole) => (
                          <tr key={hole.holeNumber} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2 font-medium">{hole.holeNumber}</td>
                            <td className="py-2 px-2 text-center">{hole.par}</td>
                            <td className="py-2 px-2 text-center">{hole.handicapRank}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="font-bold">
                      <tr className="border-t-2">
                        <td className="py-2 px-2">Total</td>
                        <td className="py-2 px-2 text-center">
                          {selectedCourse.holes.reduce((sum, h) => sum + h.par, 0)}
                        </td>
                        <td className="py-2 px-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
