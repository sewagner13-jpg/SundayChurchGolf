import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { teamId, holeId, underParStrokes } = body

    if (!teamId || !holeId) {
      return NextResponse.json(
        { error: 'teamId and holeId are required' },
        { status: 400 }
      )
    }

    const holeScore = await prisma.holeScore.updateMany({
      where: {
        roundId: params.id,
        teamId,
        holeId,
      },
      data: {
        underParStrokes:
          underParStrokes === null ? null : parseInt(underParStrokes),
      },
    })

    return NextResponse.json({ success: true, updated: holeScore.count })
  } catch (error) {
    console.error('Error updating score:', error)
    return NextResponse.json(
      { error: 'Failed to update score' },
      { status: 500 }
    )
  }
}
