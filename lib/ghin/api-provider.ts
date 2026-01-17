import { GhinProvider, GhinHandicapData } from './types'
import { prisma } from '../prisma'

export class GhinApiProvider implements GhinProvider {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.GHIN_API_KEY || ''
    this.baseUrl = process.env.GHIN_API_URL || 'https://api.ghin.com/api/v1'
  }

  async fetchHandicap(ghinNumber: string): Promise<GhinHandicapData | null> {
    if (!this.apiKey) {
      throw new Error('GHIN_API_KEY not configured')
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/golfers/${ghinNumber}/handicap`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`GHIN API error: ${response.status}`)
        return null
      }

      const data = await response.json()

      return {
        ghinNumber,
        handicapIndex: parseFloat(data.handicap_index),
        lastUpdated: new Date(data.revision_date),
      }
    } catch (error) {
      console.error('GHIN fetch error:', error)
      return null
    }
  }

  async syncPlayer(playerId: string): Promise<boolean> {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    })

    if (!player || !player.ghinNumber) {
      return false
    }

    const handicapData = await this.fetchHandicap(player.ghinNumber)

    if (!handicapData) {
      return false
    }

    await prisma.player.update({
      where: { id: playerId },
      data: {
        handicapIndex: handicapData.handicapIndex,
        handicapLastUpdatedAt: handicapData.lastUpdated,
        handicapSource: 'GHIN',
      },
    })

    return true
  }

  async syncAllPlayers(): Promise<{ success: number; failed: number }> {
    const players = await prisma.player.findMany({
      where: {
        ghinNumber: { not: null },
        isActive: true,
      },
    })

    let success = 0
    let failed = 0

    for (const player of players) {
      const synced = await this.syncPlayer(player.id)
      if (synced) {
        success++
      } else {
        failed++
      }

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { success, failed }
  }
}
