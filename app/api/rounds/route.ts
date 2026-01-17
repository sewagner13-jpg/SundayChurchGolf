import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const seasonId = searchParams.get('seasonId')

    const where = seasonId ? { seasonId } : {}

    const rounds = await prisma.round.findMany({
      where,
      include: {
        course: true,
        format: true,
        teams: {
          include: {
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(rounds)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seasonId, courseId, formatId, date, buyInPerPlayer, teams } = body

    if (!seasonId || !courseId || !formatId || !date || !teams) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get course holes for initialization
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { holes: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Create round with teams and initialize hole scores
    const round = await prisma.round.create({
      data: {
        seasonId,
        courseId,
        formatId,
        date: new Date(date),
        buyInPerPlayer: buyInPerPlayer || 30,
        teams: {
          create: teams.map((team: any) => ({
            name: team.name,
            players: {
              create: team.playerIds.map((playerId: string) => ({
                playerId,
              })),
            },
          })),
        },
      },
      include: {
        teams: {
          include: {
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        course: true,
        format: true,
      },
    })

    // Initialize hole scores for all teams
    const holeScorePromises = []
    for (const team of round.teams) {
      for (const hole of course.holes) {
        holeScorePromises.push(
          prisma.holeScore.create({
            data: {
              roundId: round.id,
              teamId: team.id,
              holeId: hole.id,
              underParStrokes: null, // Initialize as "X"
              carriedSkins: 1,
              skinValue: 0,
            },
          })
        )
      }
    }

    await Promise.all(holeScorePromises)

    return NextResponse.json(round, { status: 201 })
  } catch (error) {
    console.error('Error creating round:', error)
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    )
  }
}
