import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const formats = await prisma.format.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(formats)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, defaultTeamSize } = body

    if (!name || !description || !defaultTeamSize) {
      return NextResponse.json(
        { error: 'Name, description, and defaultTeamSize are required' },
        { status: 400 }
      )
    }

    const format = await prisma.format.create({
      data: {
        name,
        description,
        defaultTeamSize: parseInt(defaultTeamSize),
      },
    })

    return NextResponse.json(format, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    )
  }
}
