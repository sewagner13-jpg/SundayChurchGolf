import { rebuildSeasonStats } from "@/actions/season-stats";
import { NextResponse } from "next/server";

// POST /api/rebuild-stats?year=2026
// Rebuilds season stats for the given year (recalculates buy-ins)
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year parameter" },
      { status: 400 }
    );
  }

  try {
    await rebuildSeasonStats(year);
    return NextResponse.json({
      success: true,
      message: `Season stats rebuilt for ${year}`
    });
  } catch (error) {
    console.error("Failed to rebuild stats:", error);
    return NextResponse.json(
      { error: "Failed to rebuild stats" },
      { status: 500 }
    );
  }
}
