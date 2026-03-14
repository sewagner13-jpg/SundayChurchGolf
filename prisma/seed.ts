import { PrismaClient } from "@prisma/client";
import { FORMAT_DEFINITIONS } from "../src/lib/format-definitions";

const prisma = new PrismaClient();

// Timberlake Country Club hole data (Par 71)
// Data from official scorecard - "Home to the only golf course on Lake Murray!"
// Par and Handicap Rank for each hole
const timberlakeHoles = [
  // Front 9 (Par 35)
  { holeNumber: 1, par: 4, handicapRank: 15 },
  { holeNumber: 2, par: 4, handicapRank: 1 },
  { holeNumber: 3, par: 4, handicapRank: 3 },
  { holeNumber: 4, par: 3, handicapRank: 11 },
  { holeNumber: 5, par: 5, handicapRank: 7 },
  { holeNumber: 6, par: 4, handicapRank: 5 },
  { holeNumber: 7, par: 4, handicapRank: 9 },
  { holeNumber: 8, par: 3, handicapRank: 17 },
  { holeNumber: 9, par: 4, handicapRank: 13 },
  // Back 9 (Par 36)
  { holeNumber: 10, par: 4, handicapRank: 8 },
  { holeNumber: 11, par: 4, handicapRank: 6 },
  { holeNumber: 12, par: 5, handicapRank: 4 },
  { holeNumber: 13, par: 3, handicapRank: 16 },
  { holeNumber: 14, par: 4, handicapRank: 12 },
  { holeNumber: 15, par: 4, handicapRank: 2 },
  { holeNumber: 16, par: 4, handicapRank: 18 },
  { holeNumber: 17, par: 3, handicapRank: 14 },
  { holeNumber: 18, par: 5, handicapRank: 10 },
];

async function main() {
  console.log("Seeding database...");

  // Seed Timberlake Country Club (idempotent - will update if exists)
  const existingCourse = await prisma.course.findUnique({
    where: { name: "Timberlake Country Club" },
    include: { holes: true },
  });

  if (!existingCourse) {
    console.log("Creating Timberlake Country Club...");
    await prisma.course.create({
      data: {
        name: "Timberlake Country Club",
        scorecardImageUrl: null,
        holes: {
          create: timberlakeHoles,
        },
      },
    });
    console.log("Timberlake Country Club created.");
  } else {
    // Update existing course holes - delete and recreate to avoid unique constraint issues
    console.log("Updating Timberlake Country Club holes...");
    await prisma.courseHole.deleteMany({
      where: { courseId: existingCourse.id },
    });
    await prisma.courseHole.createMany({
      data: timberlakeHoles.map((hole) => ({
        courseId: existingCourse.id,
        holeNumber: hole.holeNumber,
        par: hole.par,
        handicapRank: hole.handicapRank,
      })),
    });
    console.log("Timberlake Country Club updated.");
  }

  // Seed all 14 formats from FORMAT_DEFINITIONS (idempotent via upsert)
  console.log(`Seeding ${FORMAT_DEFINITIONS.length} formats...`);
  for (const def of FORMAT_DEFINITIONS) {
    await prisma.format.upsert({
      where: { name: def.name },
      update: {
        description: def.gameDescription,
        defaultTeamSize: def.defaultTeamSize,
      },
      create: {
        name: def.name,
        description: def.gameDescription,
        defaultTeamSize: def.defaultTeamSize,
      },
    });
  }
  console.log("All formats seeded.");

  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
