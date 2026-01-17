import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    return NextResponse.json(
      { error: 'Failed to create player' },
      { status: 500 }
    )
  }
}
