import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveRoundResults } from '@/lib/game-logic'
import { FORMAT_MAP } from '@/lib/format-definitions'

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

    // Enrich the format with code-defined metadata
    const def = FORMAT_MAP.get(round.format.id)
    const enrichedRound = {
      ...round,
      format: {
        ...round.format,
        shortLabel: def?.shortLabel ?? round.format.name,
        gameDescription: def?.gameDescription ?? round.format.description,
        formatCategory: def?.formatCategory ?? 'skins',
        requiresIndividualScores: def?.requiresIndividualScores ?? false,
        requiresDesignatedPlayer: def?.requiresDesignatedPlayer ?? false,
        requiresDriveTracking: def?.requiresDriveTracking ?? false,
        configOptions: def?.configOptions ?? [],
      },
    }

    return NextResponse.json(enrichedRound)
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
