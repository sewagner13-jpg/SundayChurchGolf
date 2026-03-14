import { NextRequest, NextResponse } from 'next/server'
import { computePayouts } from '@/lib/game-logic'

/** GET /api/rounds/[id]/payouts
 * Server-side skins payout computation.
 * Returns { [teamId]: dollarAmount }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payoutMap = await computePayouts(params.id)
    return NextResponse.json(Object.fromEntries(payoutMap))
  } catch (error) {
    console.error('Error computing payouts:', error)
    return NextResponse.json(
      { error: 'Failed to compute payouts' },
      { status: 500 }
    )
  }
}
