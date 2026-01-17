import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const timberlakeCourseData = [
  { holeNumber: 1, par: 4, handicapRank: 15 },
  { holeNumber: 2, par: 4, handicapRank: 1 },
  { holeNumber: 3, par: 4, handicapRank: 3 },
  { holeNumber: 4, par: 3, handicapRank: 11 },
  { holeNumber: 5, par: 5, handicapRank: 7 },
  { holeNumber: 6, par: 4, handicapRank: 5 },
  { holeNumber: 7, par: 4, handicapRank: 9 },
  { holeNumber: 8, par: 3, handicapRank: 17 },
  { holeNumber: 9, par: 4, handicapRank: 13 },
  { holeNumber: 10, par: 4, handicapRank: 8 },
  { holeNumber: 11, par: 4, handicapRank: 6 },
  { holeNumber: 12, par: 5, handicapRank: 4 },
  { holeNumber: 13, par: 3, handicapRank: 16 },
  { holeNumber: 14, par: 4, handicapRank: 12 },
  { holeNumber: 15, par: 4, handicapRank: 2 },
  { holeNumber: 16, par: 4, handicapRank: 18 },
  { holeNumber: 17, par: 3, handicapRank: 14 },
  { holeNumber: 18, par: 5, handicapRank: 10 },
]

async function main() {
  console.log('Starting seed...')

  // Create default format
  const defaultFormat = await prisma.format.upsert({
    where: { id: 'default-sunday-church' },
    update: {},
    create: {
      id: 'default-sunday-church',
      name: 'Sunday Church Scramble Skins',
      description: 'Scramble tee-to-green, all players putt out, score is total under-par makes',
      defaultTeamSize: 4,
    },
  })
  console.log('Created format:', defaultFormat.name)

  // Create Timberlake Country Club
  const timberlake = await prisma.course.upsert({
    where: { id: 'timberlake-cc' },
    update: {},
    create: {
      id: 'timberlake-cc',
      name: 'Timberlake Country Club',
      scorecardImage: null,
      holes: {
        create: timberlakeCourseData,
      },
    },
  })
  console.log('Created course:', timberlake.name)

  // Create current season
  const currentYear = new Date().getFullYear()
  const currentSeason = await prisma.season.upsert({
    where: { year: currentYear },
    update: {},
    create: {
      year: currentYear,
    },
  })
  console.log(`Created season: ${currentSeason.year}`)

  // Create some sample players
  const samplePlayers = [
    { fullName: 'John Smith', nickname: 'Johnny', isActive: true },
    { fullName: 'Mike Johnson', nickname: 'Mikey', isActive: true },
    { fullName: 'Tom Williams', nickname: 'Tommy', isActive: true },
    { fullName: 'Dave Brown', nickname: null, isActive: true },
    { fullName: 'Chris Davis', nickname: 'CD', isActive: true },
    { fullName: 'Pat Miller', nickname: null, isActive: true },
    { fullName: 'Sam Wilson', nickname: 'Sammy', isActive: true },
    { fullName: 'Alex Moore', nickname: null, isActive: true },
  ]

  for (const player of samplePlayers) {
    await prisma.player.upsert({
      where: { id: `player-${player.fullName.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `player-${player.fullName.toLowerCase().replace(/\s+/g, '-')}`,
        ...player,
      },
    })
  }
  console.log(`Created ${samplePlayers.length} sample players`)

  console.log('Seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
