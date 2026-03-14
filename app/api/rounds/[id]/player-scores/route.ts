import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** GET /api/rounds/[id]/player-scores
 * Returns all individual player scores for a round.
 * Optional query params: holeId, teamId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const holeId = searchParams.get('holeId')
    const teamId = searchParams.get('teamId')

    const where: Record<string, string> = { roundId: params.id }
    if (holeId) where.holeId = holeId
    if (teamId) where.teamId = teamId

    const playerScores = await prisma.playerScore.findMany({
      where,
      include: {
        player: { select: { fullName: true, nickname: true } },
        hole: { select: { holeNumber: true, par: true } },
      },
      orderBy: [
        { hole: { holeNumber: 'asc' } },
        { player: { fullName: 'asc' } },
      ],
    })

    return NextResponse.json(playerScores)
  } catch (error) {
    console.error('Error fetching player scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player scores' },
      { status: 500 }
    )
  }
}

/** PATCH /api/rounds/[id]/player-scores
 * Upsert one or more individual player scores for a round.
 *
 * Body: { scores: Array<{ teamId, playerId, holeId, grossScore, extraData? }> }
 *   OR single: { teamId, playerId, holeId, grossScore, extraData? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const roundId = params.id

    // Accept either a single score object or a batch array
    const scoreEntries: Array<{
      teamId: string
      playerId: string
      holeId: string
      grossScore: number | null
      extraData?: Record<string, unknown>
    }> = Array.isArray(body.scores) ? body.scores : [body]

    if (scoreEntries.length === 0) {
      return NextResponse.json({ error: 'No scores provided' }, { status: 400 })
    }

    for (const entry of scoreEntries) {
      if (!entry.teamId || !entry.playerId || !entry.holeId) {
        return NextResponse.json(
          { error: 'teamId, playerId, and holeId are required for each score' },
          { status: 400 }
        )
      }
    }

    const upserts = scoreEntries.map((entry) =>
      prisma.playerScore.upsert({
        where: {
          roundId_teamId_playerId_holeId: {
            roundId,
            teamId: entry.teamId,
            playerId: entry.playerId,
            holeId: entry.holeId,
          },
        },
        update: {
          grossScore: entry.grossScore ?? null,
          extraData: entry.extraData ?? undefined,
        },
        create: {
          roundId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          holeId: entry.holeId,
          grossScore: entry.grossScore ?? null,
          extraData: entry.extraData ?? undefined,
        },
      })
    )

    const results = await prisma.$transaction(upserts)

    return NextResponse.json({ success: true, updated: results.length })
  } catch (error) {
    console.error('Error upserting player scores:', error)
    return NextResponse.json(
      { error: 'Failed to save player scores' },
      { status: 500 }
    )
  }
}
