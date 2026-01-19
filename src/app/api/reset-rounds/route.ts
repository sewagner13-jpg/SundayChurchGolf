import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/reset-rounds - Delete all rounds and reset season stats
export async function POST() {
  try {
    // Delete in order to respect foreign key constraints
    // 1. Delete hole scores
    const deletedScores = await prisma.holeScore.deleteMany({});

    // 2. Delete hole results
    const deletedResults = await prisma.holeResult.deleteMany({});

    // 3. Delete round players
    const deletedPlayers = await prisma.roundPlayer.deleteMany({});

    // 4. Delete teams
    const deletedTeams = await prisma.team.deleteMany({});

    // 5. Delete rounds
    const deletedRounds = await prisma.round.deleteMany({});

    // 6. Delete season stats (since they're based on rounds)
    const deletedStats = await prisma.seasonPlayerStat.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "All rounds and stats have been deleted",
      deleted: {
        rounds: deletedRounds.count,
        teams: deletedTeams.count,
        roundPlayers: deletedPlayers.count,
        holeScores: deletedScores.count,
        holeResults: deletedResults.count,
        seasonStats: deletedStats.count,
      },
    });
  } catch (error) {
    console.error("Error resetting rounds:", error);
    return NextResponse.json(
      { error: "Failed to reset rounds" },
      { status: 500 }
    );
  }
}
