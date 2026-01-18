import { PrismaClient } from "@prisma/client";

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
  { holeNumber: 9, par: 5, handicapRank: 13 },
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
    // Update existing course holes to ensure correct data
    console.log("Updating Timberlake Country Club holes...");
    for (const hole of timberlakeHoles) {
      await prisma.courseHole.upsert({
        where: {
          courseId_holeNumber: {
            courseId: existingCourse.id,
            holeNumber: hole.holeNumber,
          },
        },
        update: {
          par: hole.par,
          handicapRank: hole.handicapRank,
        },
        create: {
          courseId: existingCourse.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          handicapRank: hole.handicapRank,
        },
      });
    }
    console.log("Timberlake Country Club updated.");
  }

  // Seed Sunday Church Scramble Skins format (idempotent)
  const existingFormat = await prisma.format.findUnique({
    where: { name: "Sunday Church Scramble Skins" },
  });

  if (!existingFormat) {
    console.log("Creating Sunday Church Scramble Skins format...");
    await prisma.format.create({
      data: {
        name: "Sunday Church Scramble Skins",
        description:
          "Scramble tee-to-green. All players putt out. The recorded score is the total strokes under par made on the hole. If the team scores par or worse, record an X. Par and worse cannot win skins.",
      },
    });
    console.log("Sunday Church Scramble Skins format created.");
  } else {
    console.log("Sunday Church Scramble Skins format already exists.");
  }

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
