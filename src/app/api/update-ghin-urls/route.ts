import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface GHINProfileEntry {
  primaryName: string;
  ghinProfileUrl: string;
  aliases?: string[];
}

const GHIN_PROFILE_URLS: GHINProfileEntry[] = [
  {
    primaryName: "Trevor Barrett",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5ff0d5c78ecdae0265cabc7b874c6acbd8c1a86ca98555bfbd/club/29070",
  },
  {
    primaryName: "Al Samudio",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fae4dec7f520c41bcac36eb42f7f22fa59dde5ec194b94295/club/29070",
  },
  {
    primaryName: "Albert Bueno",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fe34332b73ce4549d97fc4253925e993a/club/29070",
  },
  {
    primaryName: "David Hamilton",
    aliases: ["Dave Hamilton"],
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f860ac35768a4e8f89c6fff8be6c2354661a5aeec89f54fc4/club/29070",
  },
  {
    primaryName: "Eddie Dennis",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f1d0497074dcde7c585ee4efe2a485a2d/club/29070",
  },
  {
    primaryName: "Gary Whitworth",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f0713e606cd80ab5fc47e216e018a220bdad29fdb03b8861f/club/29070",
  },
  {
    primaryName: "Griff Hamilton",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f3be646b9f1ebeacca791494b3e49981c/club/29070",
  },
  {
    primaryName: "Hunter Morrison",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f0f4f3f8669bb9e00a14c8f4ad0ee97f6/club/29070",
  },
  {
    primaryName: "Jay Medlin",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fff48ca38d5257bf5c14c646fab70b688247733b22e8e0cde/club/29070",
  },
  {
    primaryName: "Jim Medlin",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fa18914dcddaba13db68cb5c81d207a80/club/29070",
  },
  {
    primaryName: "Julien Jenkins",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f48a41a74f27e847d010ec510b9367315/club/29070",
  },
  {
    primaryName: "Matt Roe",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f52866f020c2c84023d9ff23e45d42449/club/29070",
  },
  {
    primaryName: "Mike Walsh",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fb7a053e7b381700d3f137bd6e2c708dae5d761e040a07332/club/29070",
  },
  {
    primaryName: "Ross Hetlinger",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f32c766eb54837a0c484ee4923f55c4e7c5c276a760611121/club/29070",
  },
  {
    primaryName: "Ryan Gibson",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f80c6cbafdab3bee7b23447d6146b29b3/club/29070",
  },
  {
    primaryName: "Scott Mathias",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fc5a1e3acc8ee8177cc4c11c3b00e5f8089c28b841c9da5b1/club/29070",
  },
  {
    primaryName: "Scott Walker",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f15e602956fe0dd6cfda2089a8dcf5a65f52853867b8e2821/club/29070",
  },
  {
    primaryName: "Sean Wagner",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5f67329788d983a6baa583ab397a2c9004/club/29070",
  },
  {
    primaryName: "Steve Zeady",
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5ffdf47efc23290ce1a940af33e7c02d72/club/29070",
  },
  {
    primaryName: "Tony Wiest",
    aliases: ["Tony Weist"],
    ghinProfileUrl:
      "https://www.ghin.com/golfer-lookup/golfer/53616c7465645f5fb8c516880b7fe46173c32e83b0e781bd2a39c1172e447574/club/29070",
  },
];

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildNameCandidates(entry: GHINProfileEntry) {
  return [entry.primaryName, ...(entry.aliases ?? [])].map(normalizeName);
}

async function applyUpdates() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      fullName: true,
      nickname: true,
      ghinProfileUrl: true,
    },
  });

  const playersByName = new Map<string, (typeof players)[number]>();
  for (const player of players) {
    playersByName.set(normalizeName(player.fullName), player);
    if (player.nickname) {
      playersByName.set(normalizeName(player.nickname), player);
    }
  }

  const updates: Array<{ id: string; matchedName: string; ghinProfileUrl: string }> =
    [];
  const results: Array<{
    requestedName: string;
    matchedName?: string;
    status: "updated" | "unchanged" | "not_found";
  }> = [];

  for (const entry of GHIN_PROFILE_URLS) {
    const matchedPlayer = buildNameCandidates(entry)
      .map((candidate) => playersByName.get(candidate))
      .find(Boolean);

    if (!matchedPlayer) {
      results.push({
        requestedName: entry.primaryName,
        status: "not_found",
      });
      continue;
    }

    if (matchedPlayer.ghinProfileUrl === entry.ghinProfileUrl) {
      results.push({
        requestedName: entry.primaryName,
        matchedName: matchedPlayer.fullName,
        status: "unchanged",
      });
      continue;
    }

    updates.push({
      id: matchedPlayer.id,
      matchedName: matchedPlayer.fullName,
      ghinProfileUrl: entry.ghinProfileUrl,
    });
    results.push({
      requestedName: entry.primaryName,
      matchedName: matchedPlayer.fullName,
      status: "updated",
    });
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.player.update({
        where: { id: update.id },
        data: { ghinProfileUrl: update.ghinProfileUrl },
      })
    )
  );

  const updated = results.filter((result) => result.status === "updated");
  const unchanged = results.filter((result) => result.status === "unchanged");
  const notFound = results.filter((result) => result.status === "not_found");

  return {
    success: true,
    message: `Updated ${updated.length} players, ${unchanged.length} unchanged, ${notFound.length} not found`,
    updatedCount: updated.length,
    unchangedCount: unchanged.length,
    notFoundCount: notFound.length,
    results,
  };
}

export async function GET() {
  return NextResponse.json({
    totalEntries: GHIN_PROFILE_URLS.length,
    players: GHIN_PROFILE_URLS.map((entry) => ({
      requestedName: entry.primaryName,
      aliases: entry.aliases ?? [],
    })),
  });
}

export async function POST() {
  try {
    return NextResponse.json(await applyUpdates());
  } catch (error) {
    console.error("Error updating GHIN URLs:", error);
    return NextResponse.json(
      { error: "Failed to update GHIN URLs" },
      { status: 500 }
    );
  }
}
