import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { fullName: 'asc' },
    })
    return NextResponse.json(players)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { fullName, nickname, handicapIndex, isActive } = body

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      )
    }

    const player = await prisma.player.create({
      data: {
        fullName,
        nickname: nickname || null,
        handicapIndex: handicapIndex ? parseFloat(handicapIndex) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message?.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to create player' },
      { status: 500 }
    )
  }
}
