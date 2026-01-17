import { NextRequest, NextResponse } from 'next/server'
import { getGhinProvider } from '@/lib/ghin'

export async function POST(request: NextRequest) {
  try {
    // Bearer token authentication
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    if (token !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 403 }
      )
    }

    // Sync all players
    const provider = getGhinProvider()
    const result = await provider.syncAllPlayers()

    return NextResponse.json({
      success: true,
      playersUpdated: result.success,
      playersFailed: result.failed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync handicaps' },
      { status: 500 }
    )
  }
}
