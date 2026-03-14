import { listFormats } from "@/actions/formats";
import { NextResponse } from "next/server";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";

// Build a lookup map keyed by format name (DB uses auto-generated IDs, not the
// string IDs from FORMAT_DEFINITIONS, so we match by name)
const DEF_BY_NAME = new Map(FORMAT_DEFINITIONS.map((d) => [d.name, d]));

export async function GET() {
  const dbFormats = await listFormats();

  const enriched = dbFormats.map((dbFmt) => {
    const def = DEF_BY_NAME.get(dbFmt.name);
    return {
      ...dbFmt,
      shortLabel: def?.shortLabel ?? dbFmt.name.slice(0, 8),
      gameDescription: def?.gameDescription ?? dbFmt.description,
      formatCategory: def?.formatCategory ?? "skins",
      supportedTeamSizes: def?.supportedTeamSizes ?? [4],
      configOptions: def?.configOptions ?? [],
      requiresIndividualScores: def?.requiresIndividualScores ?? false,
      requiresDesignatedPlayer: def?.requiresDesignatedPlayer ?? false,
      requiresDriveTracking: def?.requiresDriveTracking ?? false,
      // Expose the canonical definition ID so client code can look up FORMAT_MAP
      definitionId: def?.id ?? null,
    };
  });

  return NextResponse.json(enriched);
}
