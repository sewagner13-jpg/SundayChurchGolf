export interface GhinHandicapData {
  ghinNumber: string
  handicapIndex: number
  lastUpdated: Date
}

export interface GhinProvider {
  fetchHandicap(ghinNumber: string): Promise<GhinHandicapData | null>
  syncPlayer(playerId: string): Promise<boolean>
  syncAllPlayers(): Promise<{ success: number; failed: number }>
}
