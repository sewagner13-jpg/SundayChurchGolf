import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const body = await request.json()
    const { name, scorecardImage, holes } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!holes || holes.length !== 18) {
      return NextResponse.json(
        { error: 'Exactly 18 holes are required' },
        { status: 400 }
      )
    }

    // Validate handicap ranks are unique 1-18
    const handicapRanks = holes.map((h: any) => h.handicapRank)
    const uniqueRanks = new Set(handicapRanks)
    if (uniqueRanks.size !== 18) {
      return NextResponse.json(
        { error: 'Handicap ranks must be unique 1-18' },
        { status: 400 }
      )
    }

    const course = await prisma.course.create({
      data: {
        name,
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
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    )
  }
}
