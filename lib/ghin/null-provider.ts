import { GhinProvider, GhinHandicapData } from './types'

export class NullGhinProvider implements GhinProvider {
  async fetchHandicap(ghinNumber: string): Promise<GhinHandicapData | null> {
    console.log(`NullGhinProvider: Would fetch handicap for ${ghinNumber}`)
    return null
  }

  async syncPlayer(playerId: string): Promise<boolean> {
    console.log(`NullGhinProvider: Would sync player ${playerId}`)
    return false
  }

  async syncAllPlayers(): Promise<{ success: number; failed: number }> {
    console.log('NullGhinProvider: Would sync all players')
    return { success: 0, failed: 0 }
  }
}
