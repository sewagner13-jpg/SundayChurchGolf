import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// POST /api/cancel-round - Delete the current active round (DRAFT or LIVE)
export async function POST() {
  try {
    // Find active round
    const activeRound = await prisma.round.findFirst({
      where: {
        status: { in: ["DRAFT", "LIVE"] },
      },
      include: {
        roundPlayers: true,
      },
    });

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round found" },
        { status: 404 }
      );
    }

    // Delete in order to respect foreign key constraints
    // 1. Delete hole scores for this round
    await prisma.holeScore.deleteMany({
      where: { roundId: activeRound.id },
    });

    // 2. Delete hole results for this round
    await prisma.holeResult.deleteMany({
      where: { roundId: activeRound.id },
    });

    // 3. Delete round players for this round
    await prisma.roundPlayer.deleteMany({
      where: { roundId: activeRound.id },
    });

    // 4. Delete teams for this round
    await prisma.team.deleteMany({
      where: { roundId: activeRound.id },
    });

    // 5. Delete the round itself
    await prisma.round.delete({
      where: { id: activeRound.id },
    });

    // Revalidate paths
    revalidatePath("/");
    revalidatePath("/leaderboard");

    return NextResponse.json({
      success: true,
      message: `Round ${activeRound.id} has been cancelled`,
      roundId: activeRound.id,
    });
  } catch (error) {
    console.error("Error cancelling round:", error);
    return NextResponse.json(
      { error: "Failed to cancel round", details: String(error) },
      { status: 500 }
    );
  }
}
