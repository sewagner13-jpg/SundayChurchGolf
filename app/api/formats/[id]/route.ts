import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const format = await prisma.format.findUnique({
      where: { id: params.id },
    })

    if (!format) {
      return NextResponse.json({ error: 'Format not found' }, { status: 404 })
    }

    return NextResponse.json(format)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch format' },
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
    const { name, description, defaultTeamSize } = body

    const format = await prisma.format.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(defaultTeamSize && { defaultTeamSize: parseInt(defaultTeamSize) }),
      },
    })

    return NextResponse.json(format)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update format' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.format.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete format' },
      { status: 500 }
    )
  }
}
