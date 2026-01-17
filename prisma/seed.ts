import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Timberlake Country Club hole data
// Par and Handicap Rank for each hole
const timberlakeHoles = [
  { holeNumber: 1, par: 4, handicapRank: 11 },
  { holeNumber: 2, par: 4, handicapRank: 7 },
  { holeNumber: 3, par: 3, handicapRank: 17 },
  { holeNumber: 4, par: 5, handicapRank: 3 },
  { holeNumber: 5, par: 4, handicapRank: 5 },
  { holeNumber: 6, par: 4, handicapRank: 13 },
  { holeNumber: 7, par: 3, handicapRank: 15 },
  { holeNumber: 8, par: 4, handicapRank: 9 },
  { holeNumber: 9, par: 5, handicapRank: 1 },
  { holeNumber: 10, par: 4, handicapRank: 12 },
  { holeNumber: 11, par: 4, handicapRank: 8 },
  { holeNumber: 12, par: 5, handicapRank: 4 },
  { holeNumber: 13, par: 3, handicapRank: 18 },
  { holeNumber: 14, par: 4, handicapRank: 6 },
  { holeNumber: 15, par: 4, handicapRank: 14 },
  { holeNumber: 16, par: 4, handicapRank: 10 },
  { holeNumber: 17, par: 3, handicapRank: 16 },
  { holeNumber: 18, par: 5, handicapRank: 2 },
];

async function main() {
  console.log("Seeding database...");

  // Seed Timberlake Country Club (idempotent)
  const existingCourse = await prisma.course.findUnique({
    where: { name: "Timberlake Country Club" },
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
    console.log("Timberlake Country Club already exists.");
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
