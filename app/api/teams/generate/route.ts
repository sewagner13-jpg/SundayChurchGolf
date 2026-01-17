import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTeams } from '@/lib/game-logic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerIds, teamSize } = body

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json(
        { error: 'playerIds array is required' },
        { status: 400 }
      )
    }

    // Fetch player details
    const players = await prisma.player.findMany({
      where: {
        id: { in: playerIds },
      },
      select: {
        id: true,
        fullName: true,
        nickname: true,
      },
    })

    if (players.length !== playerIds.length) {
      return NextResponse.json(
        { error: 'Some players not found' },
        { status: 404 }
      )
    }

    // Generate teams
    const teams = generateTeams(players, teamSize || 4)

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Error generating teams:', error)
    return NextResponse.json(
      { error: 'Failed to generate teams' },
      { status: 500 }
    )
  }
}
