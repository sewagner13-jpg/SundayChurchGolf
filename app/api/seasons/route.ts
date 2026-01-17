import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year } = body

    if (!year) {
      return NextResponse.json({ error: 'Year is required' }, { status: 400 })
    }

    // Find or create season
    const season = await prisma.season.upsert({
      where: { year: parseInt(year) },
      update: {},
      create: { year: parseInt(year) },
    })

    return NextResponse.json(season)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create/find season' },
      { status: 500 }
    )
  }
}
