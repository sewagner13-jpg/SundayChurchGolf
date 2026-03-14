import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Player name → GHIN profile URL mapping
// One-time update for existing players in the database
const GHIN_PROFILE_URLS: Record<string, string> = {
  "Trevor Barrett":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5ff0d5c78ecdae0265cabc7b874c6acbd8c1a86ca98555bfbd/club/29070",
  "Al Samudio":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fae4dec7f520c41bcac36eb42f7f22fa59dde5ec194b94295/club/29070",
  "Albert Bueno":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fe34332b73ce4549d97fc4253925e993a/club/29070",
  "Dave Hamilton":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f860ac35768a4e8f89c6fff8be6c2354661a5aeec89f54fc4/club/29070",
  "Eddie Dennis":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f1d0497074dcde7c585ee4efe2a485a2d/club/29070",
  "Gary Whitworth":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f0713e606cd80ab5fc47e216e018a220bdad29fdb03b8861f/club/29070",
  "Griff Hamilton":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f3be646b9f1ebeacca791494b3e49981c/club/29070",
  "Hunter Morrison":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f0f4f3f8669bb9e00a14c8f4ad0ee97f6/club/29070",
  "Jay Medlin":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fff48ca38d5257bf5c14c646fab70b688247733b22e8e0cde/club/29070",
  "Jim Medlin":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fa18914dcddaba13db68cb5c81d207a80/club/29070",
  "Julien Jenkins":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f48a41a74f27e847d010ec510b9367315/club/29070",
  "Matt Roe":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f52866f020c2c84023d9ff23e45d42449/club/29070",
  "Mike Walsh":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fb7a053e7b381700d3f137bd6e2c708dae5d761e040a07332/club/29070",
  "Ross Hetlinger":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f32c766eb54837a0c484ee4923f55c4e7c5c276a760611121/club/29070",
  "Ryan Gibson":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f80c6cbafdab3bee7b23447d6146b29b3/club/29070",
  "Scott Mathias":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fc5a1e3acc8ee8177cc4c11c3b00e5f8089c28b841c9da5b1/club/29070",
  "Scott Walker":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f15e602956fe0dd6cfda2089a8dcf5a65f52853867b8e2821/club/29070",
  "Sean Wagner":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f67329788d983a6baa583ab397a2c9004/club/29070",
  "Steve Zeady":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5ffdf47efc23290ce1a940af33e7c02d72/club/29070",
  "Tony Weist":
    "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fb8c516880b7fe46173c32e83b0e781bd2a39c1172e447574/club/29070",
};

// POST /api/update-ghin-urls - Bulk-update GHIN profile URLs for existing players
export async function POST() {
  try {
    const players = await prisma.player.findMany({
      where: { fullName: { in: Object.keys(GHIN_PROFILE_URLS) } },
      select: { id: true, fullName: true },
    });

    const playerByName = new Map(players.map((p) => [p.fullName, p.id]));

    const results: { name: string; status: string }[] = [];
    const updates = [];

    for (const [fullName, ghinProfileUrl] of Object.entries(GHIN_PROFILE_URLS)) {
      const playerId = playerByName.get(fullName);
      if (!playerId) {
        results.push({ name: fullName, status: "not_found" });
        continue;
      }
      updates.push(
        prisma.player.update({
          where: { id: playerId },
          data: { ghinProfileUrl },
        })
      );
      results.push({ name: fullName, status: "updated" });
    }

    await prisma.$transaction(updates);

    const updated = results.filter((r) => r.status === "updated");
    const notFound = results.filter((r) => r.status === "not_found");

    return NextResponse.json({
      success: true,
      message: `Updated ${updated.length} players, ${notFound.length} not found`,
      results,
    });
  } catch (error) {
    console.error("Error updating GHIN URLs:", error);
    return NextResponse.json(
      { error: "Failed to update GHIN URLs" },
      { status: 500 }
    );
  }
}
