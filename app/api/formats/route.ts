import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { FORMAT_MAP, FORMAT_DEFINITIONS } from '@/lib/format-definitions'

export async function GET() {
  try {
    const dbFormats = await prisma.format.findMany({
      orderBy: { name: 'asc' },
    })

    // Merge DB records with code-defined metadata
    const enriched = dbFormats.map((dbFmt) => {
      const def = FORMAT_MAP.get(dbFmt.id)
      return {
        ...dbFmt,
        shortLabel: def?.shortLabel ?? dbFmt.name.slice(0, 8),
        gameDescription: def?.gameDescription ?? dbFmt.description,
        formatCategory: def?.formatCategory ?? 'stroke',
        supportedTeamSizes: def?.supportedTeamSizes ?? [dbFmt.defaultTeamSize],
        configOptions: def?.configOptions ?? [],
        requiresIndividualScores: def?.requiresIndividualScores ?? false,
        requiresDesignatedPlayer: def?.requiresDesignatedPlayer ?? false,
        requiresDriveTracking: def?.requiresDriveTracking ?? false,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

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
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message?.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    )
  }
}
