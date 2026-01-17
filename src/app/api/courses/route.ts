import { listCourses } from "@/actions/courses";
import { NextResponse } from "next/server";

export async function GET() {
  const courses = await listCourses();
  return NextResponse.json(courses);
}
