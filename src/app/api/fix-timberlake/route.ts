import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/fix-timberlake - Fix hole 9 par to 4
export async function POST() {
  try {
    const course = await prisma.course.findUnique({
      where: { name: "Timberlake Country Club" },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Timberlake Country Club not found" },
        { status: 404 }
      );
    }

    // Update hole 9 to par 4
    const updated = await prisma.courseHole.updateMany({
      where: {
        courseId: course.id,
        holeNumber: 9,
      },
      data: {
        par: 4,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Hole 9 updated to par 4",
      updated: updated.count,
    });
  } catch (error) {
    console.error("Error fixing Timberlake:", error);
    return NextResponse.json(
      { error: "Failed to update hole 9" },
      { status: 500 }
    );
  }
}
