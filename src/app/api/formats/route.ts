import { listFormats } from "@/actions/formats";
import { NextResponse } from "next/server";
import { FORMAT_DEFINITIONS } from "@/lib/format-definitions";

const DEF_BY_ID = new Map(FORMAT_DEFINITIONS.map((d) => [d.id, d]));
const DEF_BY_NAME = new Map(FORMAT_DEFINITIONS.map((d) => [d.name, d]));

export async function GET() {
  const dbFormats = await listFormats();

  const enriched = dbFormats.map((dbFmt) => {
    const def = DEF_BY_ID.get(dbFmt.id) ?? DEF_BY_NAME.get(dbFmt.name);
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
      definitionId: def?.id ?? dbFmt.id,
    };
  });

  return NextResponse.json(enriched);
}
