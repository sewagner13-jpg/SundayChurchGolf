import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveRoundResults } from '@/lib/game-logic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: {
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
            },
          },
        },
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
        holeScores: {
          include: {
            hole: true,
          },
          orderBy: {
            hole: {
              holeNumber: 'asc',
            },
          },
        },
      },
    })

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    return NextResponse.json(round)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { isLocked } = body

    const round = await prisma.round.update({
      where: { id: params.id },
      data: {
        ...(isLocked !== undefined && { isLocked }),
      },
      include: {
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
            },
          },
        },
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
    })

    // If locking the round, compute and save final results
    if (isLocked) {
      await saveRoundResults(params.id)
    }

    return NextResponse.json(round)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update round' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.round.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete round' },
      { status: 500 }
    )
  }
}
