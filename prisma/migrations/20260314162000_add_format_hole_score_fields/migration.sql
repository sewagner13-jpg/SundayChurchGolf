-- AlterTable
ALTER TABLE "Format"
ALTER COLUMN "defaultTeamSize" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HoleScore"
ADD COLUMN "grossScore" INTEGER,
ADD COLUMN "holeData" JSONB;
