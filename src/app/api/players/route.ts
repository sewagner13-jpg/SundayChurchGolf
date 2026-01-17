import { listPlayers } from "@/actions/players";
import { NextResponse } from "next/server";

export async function GET() {
  const players = await listPlayers(true);
  return NextResponse.json(players);
}
