import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getGhinProvider } from '@/lib/ghin'

export async function POST() {
  try {
    await requireAdmin()

    const provider = getGhinProvider()
    const result = await provider.syncAllPlayers()

    return NextResponse.json({
      success: true,
      playersUpdated: result.success,
      playersFailed: result.failed,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message?.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to sync handicaps' },
      { status: 500 }
    )
  }
}
