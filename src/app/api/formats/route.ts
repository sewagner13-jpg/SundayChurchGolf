import { listFormats } from "@/actions/formats";
import { NextResponse } from "next/server";

export async function GET() {
  const formats = await listFormats();
  return NextResponse.json(formats);
}
