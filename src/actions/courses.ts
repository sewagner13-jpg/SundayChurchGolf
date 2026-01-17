"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface CourseHoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
}

export interface CourseFormData {
  name: string;
  scorecardImageUrl?: string | null;
  holes: CourseHoleData[];
}

function validateCourseHoles(holes: CourseHoleData[]): void {
  if (holes.length !== 18) {
    throw new Error("Course must have exactly 18 holes");
  }

  const holeNumbers = new Set(holes.map((h) => h.holeNumber));
  const handicapRanks = new Set(holes.map((h) => h.handicapRank));

  // Check hole numbers are 1-18
  for (let i = 1; i <= 18; i++) {
    if (!holeNumbers.has(i)) {
      throw new Error(`Missing hole number ${i}`);
    }
  }

  // Check handicap ranks are 1-18 (unique)
  for (let i = 1; i <= 18; i++) {
    if (!handicapRanks.has(i)) {
      throw new Error(`Missing handicap rank ${i}`);
    }
  }

  // Check pars are valid
  for (const hole of holes) {
    if (hole.par < 3 || hole.par > 5) {
      throw new Error(`Invalid par for hole ${hole.holeNumber}`);
    }
  }
}

export async function createCourse(data: CourseFormData) {
  validateCourseHoles(data.holes);

  const course = await prisma.course.create({
    data: {
      name: data.name,
      scorecardImageUrl: data.scorecardImageUrl || null,
      holes: {
        create: data.holes,
      },
    },
    include: { holes: true },
  });

  revalidatePath("/courses");
  return course;
}

export async function updateCourse(id: string, data: CourseFormData) {
  validateCourseHoles(data.holes);

  // Delete existing holes and recreate
  await prisma.courseHole.deleteMany({ where: { courseId: id } });

  const course = await prisma.course.update({
    where: { id },
    data: {
      name: data.name,
      scorecardImageUrl: data.scorecardImageUrl || null,
      holes: {
        create: data.holes,
      },
    },
    include: { holes: true },
  });

  revalidatePath("/courses");
  return course;
}

export async function deleteCourse(id: string) {
  // Check if course has been used in a round
  const usedInRound = await prisma.round.findFirst({
    where: { courseId: id },
  });

  if (usedInRound) {
    throw new Error("Cannot delete course that has been used in rounds.");
  }

  await prisma.course.delete({ where: { id } });
  revalidatePath("/courses");
}

export async function listCourses() {
  return prisma.course.findMany({
    orderBy: { name: "asc" },
    include: {
      holes: {
        orderBy: { holeNumber: "asc" },
      },
    },
  });
}

export async function getCourse(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      holes: {
        orderBy: { holeNumber: "asc" },
      },
    },
  });
}
