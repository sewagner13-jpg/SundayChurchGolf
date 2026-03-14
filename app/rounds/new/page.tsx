'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS } from '@/lib/format-definitions'

interface Player {
  id: string
  fullName: string
  nickname?: string | null
  isActive: boolean
}

interface Course {
  id: string
  name: string
}

interface ConfigOption {
  key: string
  label: string
  type: 'boolean' | 'number' | 'select'
  options?: Array<{ value: string; label: string }>
  defaultValue?: string | number | boolean
  description?: string
}

interface Format {
  id: string
  name: string
  defaultTeamSize: number
  gameDescription: string
  formatCategory: string
  supportedTeamSizes: number[]
  configOptions: ConfigOption[]
  requiresIndividualScores: boolean
}

interface GeneratedTeam {
  name: string
  players: Player[]
}

export default function NewRoundPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form data
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('')
  const [buyIn, setBuyIn] = useState('30')
  const [teamSize, setTeamSize] = useState('4')
  const [formatConfig, setFormatConfig] = useState<Record<string, unknown>>({})
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [teams, setTeams] = useState<GeneratedTeam[]>([])

  // Options
  const [players, setPlayers] = useState<Player[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [formats, setFormats] = useState<Format[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const activeFormat = formats.find((f) => f.id === selectedFormat)

  // Formats eligible for Irish Golf segments (exclude container + match formats)
  const irishGolfEligibleFormats = formats.filter((f) =>
    IRISH_GOLF_ELIGIBLE_SEGMENT_FORMATS.includes(f.id)
  )

  async function loadData() {
    try {
      const [playersRes, coursesRes, formatsRes] = await Promise.all([
        fetch('/api/players'),
        fetch('/api/courses'),
        fetch('/api/formats'),
      ])

      const [playersData, coursesData, formatsData] = await Promise.all([
        playersRes.json(),
        coursesRes.json(),
        formatsRes.json(),
      ])

      setPlayers(playersData.filter((p: Player) => p.isActive))
      setCourses(coursesData)
      setFormats(formatsData)

      if (coursesData.length > 0) setSelectedCourse(coursesData[0].id)
      if (formatsData.length > 0) {
        const firstFormat: Format = formatsData[0]
        setSelectedFormat(firstFormat.id)
        setTeamSize(firstFormat.defaultTeamSize.toString())
        setFormatConfig(buildDefaultConfig(firstFormat))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  function buildDefaultConfig(fmt: Format): Record<string, unknown> {
    const config: Record<string, unknown> = {}
    for (const opt of fmt.configOptions ?? []) {
      if (opt.defaultValue !== undefined) {
        config[opt.key] = opt.defaultValue
      }
    }
    return config
  }

  function handleFormatChange(formatId: string) {
    setSelectedFormat(formatId)
    const fmt = formats.find((f) => f.id === formatId)
    if (!fmt) return

    // Enforce Vegas = 2-player teams
    const newTeamSize = fmt.id === 'vegas' ? '2' : fmt.defaultTeamSize.toString()
    setTeamSize(newTeamSize)
    setFormatConfig(buildDefaultConfig(fmt))
  }

  function setConfigValue(key: string, value: unknown) {
    setFormatConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function generateTeams() {
    try {
      const response = await fetch('/api/teams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds: selectedPlayers,
          teamSize: parseInt(teamSize),
        }),
      })

      if (response.ok) {
        const generatedTeams = await response.json()
        setTeams(generatedTeams)
      }
    } catch (error) {
      console.error('Failed to generate teams:', error)
    }
  }

  async function createRound() {
    setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const seasonResponse = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: currentYear }),
      })

      let seasonId
      if (seasonResponse.ok) {
        const season = await seasonResponse.json()
        seasonId = season.id
      }

      const roundData = {
        seasonId: seasonId || currentYear.toString(),
        courseId: selectedCourse,
        formatId: selectedFormat,
        date: selectedDate,
        buyInPerPlayer: parseFloat(buyIn),
        formatConfig: Object.keys(formatConfig).length > 0 ? formatConfig : null,
        teams: teams.map((team) => ({
          name: team.name,
          playerIds: team.players.map((p) => p.id),
        })),
      }

      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roundData),
      })

      if (response.ok) {
        const round = await response.json()
        router.push(`/rounds/${round.id}/score`)
      }
    } catch (error) {
      console.error('Failed to create round:', error)
    } finally {
      setLoading(false)
    }
  }

  // Validation for Irish Golf: all 3 segments must be configured
  const irishGolfValid =
    activeFormat?.id !== 'irish_golf_6_6_6' ||
    (!!formatConfig.segment1FormatId &&
      !!formatConfig.segment2FormatId &&
      !!formatConfig.segment3FormatId)

  const canProceedStep1 = selectedCourse && selectedFormat && selectedDate && irishGolfValid
  const canProceedStep2 = selectedPlayers.length >= parseInt(teamSize)
  const canProceedStep3 = teams.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/" className="text-primary-100 hover:text-white mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">New Round</h1>
          <p className="text-primary-100 mt-1">Step {step} of 4</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Round Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {formats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.name}
                    </option>
                  ))}
                </select>

                {/* Game description */}
                {activeFormat?.gameDescription && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    {activeFormat.gameDescription}
                  </div>
                )}
              </div>

              {/* Format-specific config options */}
              {activeFormat && activeFormat.configOptions.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-800">Format Options</h3>

                  {/* Irish Golf segment selectors */}
                  {activeFormat.id === 'irish_golf_6_6_6' && (
                    <>
                      {(['segment1FormatId', 'segment2FormatId', 'segment3FormatId'] as const).map(
                        (key, i) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Holes {i * 6 + 1}–{(i + 1) * 6} Format
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <select
                              value={(formatConfig[key] as string) ?? ''}
                              onChange={(e) => setConfigValue(key, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                              <option value="">— Select a format —</option>
                              {irishGolfEligibleFormats.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      )}
                    </>
                  )}

                  {/* Generic config options (skip Irish Golf segment keys handled above) */}
                  {activeFormat.configOptions
                    .filter(
                      (opt) =>
                        !['segment1FormatId', 'segment2FormatId', 'segment3FormatId'].includes(
                          opt.key
                        )
                    )
                    .map((opt) => (
                      <div key={opt.key}>
                        {opt.type === 'boolean' && (
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!formatConfig[opt.key]}
                              onChange={(e) => setConfigValue(opt.key, e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">
                                {opt.label}
                              </span>
                              {opt.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                              )}
                            </div>
                          </label>
                        )}

                        {opt.type === 'number' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {opt.label}
                            </label>
                            {opt.description && (
                              <p className="text-xs text-gray-500 mb-1">{opt.description}</p>
                            )}
                            <input
                              type="number"
                              value={(formatConfig[opt.key] as number) ?? (opt.defaultValue as number) ?? 1}
                              onChange={(e) => setConfigValue(opt.key, parseInt(e.target.value))}
                              min="1"
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        )}

                        {opt.type === 'select' && opt.options && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {opt.label}
                            </label>
                            {opt.description && (
                              <p className="text-xs text-gray-500 mb-1">{opt.description}</p>
                            )}
                            <select
                              value={(formatConfig[opt.key] as string) ?? (opt.defaultValue as string) ?? ''}
                              onChange={(e) => setConfigValue(opt.key, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                              {opt.options.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buy-in per Player ($)
                  </label>
                  <input
                    type="number"
                    value={buyIn}
                    onChange={(e) => setBuyIn(e.target.value)}
                    min="0"
                    step="5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Size
                  </label>
                  <input
                    type="number"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    min="1"
                    disabled={activeFormat?.id === 'vegas'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {activeFormat?.id === 'vegas' && (
                    <p className="text-xs text-gray-500 mt-1">Vegas requires 2-player teams.</p>
                  )}
                </div>
              </div>
            </div>

            {!irishGolfValid && (
              <p className="mt-3 text-sm text-red-600">
                Irish Golf / 6-6-6 requires all three segment formats to be selected.
              </p>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full mt-6 px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next: Select Players
            </button>
          </div>
        )}

        {/* Step 2: Player Selection */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-2">
              Select Players ({selectedPlayers.length} selected)
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Need at least {teamSize} players. Each team will have {teamSize} players.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {players.map((player) => {
                const isSelected = selectedPlayers.includes(player.id)
                return (
                  <button
                    key={player.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPlayers(selectedPlayers.filter((id) => id !== player.id))
                      } else {
                        setSelectedPlayers([...selectedPlayers, player.id])
                      }
                    }}
                    className={`px-4 py-3 rounded-lg font-medium transition text-left ${
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {player.fullName}
                    {player.nickname && ` (${player.nickname})`}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  generateTeams()
                  setStep(3)
                }}
                disabled={!canProceedStep2}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Generate Teams
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Team Review */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Review Teams</h2>
              <button
                onClick={generateTeams}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
              >
                Reroll
              </button>
            </div>
            <div className="space-y-4 mb-6">
              {teams.map((team, teamIdx) => (
                <div key={teamIdx} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">{team.name}</h3>
                  <div className="space-y-1">
                    {team.players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center bg-gray-50 px-3 py-2 rounded text-sm"
                      >
                        {player.fullName}
                        {player.nickname && ` (${player.nickname})`}
                      </div>
                    ))}
                  </div>
                  {team.players.length < parseInt(teamSize) && (
                    <p className="text-sm text-yellow-600 mt-2">
                      This team has fewer players than the team size
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!canProceedStep3}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Confirm Round</h2>
            <div className="space-y-3 mb-6 text-gray-700">
              <p>
                <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}
              </p>
              <p>
                <strong>Course:</strong> {courses.find((c) => c.id === selectedCourse)?.name}
              </p>
              <p>
                <strong>Format:</strong> {activeFormat?.name}
              </p>
              <p>
                <strong>Buy-in:</strong> ${buyIn} per player
              </p>
              <p>
                <strong>Total Pot:</strong> ${parseFloat(buyIn) * selectedPlayers.length}
              </p>
              <p>
                <strong>Teams:</strong> {teams.length}
              </p>
              <p>
                <strong>Players:</strong> {selectedPlayers.length}
              </p>

              {/* Irish Golf segment summary */}
              {activeFormat?.id === 'irish_golf_6_6_6' && (
                <div className="mt-2 text-sm bg-gray-50 rounded p-3 space-y-1">
                  <p className="font-semibold">Segments:</p>
                  {(['segment1FormatId', 'segment2FormatId', 'segment3FormatId'] as const).map(
                    (key, i) => {
                      const segFmt = formats.find((f) => f.id === formatConfig[key])
                      return (
                        <p key={key}>
                          Holes {i * 6 + 1}–{(i + 1) * 6}: {segFmt?.name ?? 'Not set'}
                        </p>
                      )
                    }
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                onClick={createRound}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Round'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
