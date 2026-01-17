import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    if (!seasonId) {
      return NextResponse.json(
        { error: 'seasonId parameter is required' },
        { status: 400 }
      )
    }

    // Fetch all locked rounds for the season with hole scores
    const rounds = await prisma.round.findMany({
      where: {
        seasonId,
        isLocked: true, // Only count locked rounds
      },
      include: {
        holeScores: {
          include: {
            team: {
              include: {
                players: {
                  include: {
                    player: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Aggregate winnings by player
    const playerWinnings = new Map<string, { player: any; totalWinnings: number }>()

    for (const round of rounds) {
      for (const holeScore of round.holeScores) {
        const team = holeScore.team
        const numPlayers = team.players.length

        // Split skinValue evenly among team members
        const playerShare = holeScore.skinValue / numPlayers

        for (const teamPlayer of team.players) {
          const playerId = teamPlayer.player.id
          const existing = playerWinnings.get(playerId)

          if (existing) {
            existing.totalWinnings += playerShare
          } else {
            playerWinnings.set(playerId, {
              player: teamPlayer.player,
              totalWinnings: playerShare,
            })
          }
        }
      }
    }

    // Convert to array and sort by total winnings descending
    const leaderboard = Array.from(playerWinnings.values())
      .map(({ player, totalWinnings }) => ({
        playerId: player.id,
        fullName: player.fullName,
        nickname: player.nickname,
        totalWinnings: Math.round(totalWinnings * 100) / 100, // Round to 2 decimals
      }))
      .sort((a, b) => b.totalWinnings - a.totalWinnings)

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
