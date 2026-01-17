import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(courses)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { name, scorecardImage, holes } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!holes || holes.length < 1) {
      return NextResponse.json(
        { error: 'At least 1 hole is required' },
        { status: 400 }
      )
    }

    const holeCount = holes.length

    // Validate handicap ranks are unique 1-N
    const handicapRanks = holes.map((h: any) => h.handicapRank)
    const uniqueRanks = new Set(handicapRanks)
    if (uniqueRanks.size !== holeCount) {
      return NextResponse.json(
        { error: `Handicap ranks must be unique 1-${holeCount}` },
        { status: 400 }
      )
    }

    const course = await prisma.course.create({
      data: {
        name,
        holeCount,
        scorecardImage: scorecardImage || null,
        holes: {
          create: holes.map((hole: any) => ({
            holeNumber: hole.holeNumber,
            par: hole.par,
            handicapRank: hole.handicapRank,
          })),
        },
      },
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
        },
      },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message?.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    )
  }
}
