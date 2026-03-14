ALTER TABLE "Player"
ADD COLUMN "ghinNumber" TEXT,
ADD COLUMN "ghinProfileUrl" TEXT,
ADD COLUMN "lastVerifiedDate" TIMESTAMP(3),
ADD COLUMN "handicapSource" TEXT;

ALTER TABLE "RoundPlayer"
ADD COLUMN "eventHandicapIndex" DECIMAL(4,1),
ADD COLUMN "eventHandicapLockedAt" TIMESTAMP(3);

UPDATE "Player"
SET "lastVerifiedDate" = "handicapLastUpdatedAt"
WHERE "lastVerifiedDate" IS NULL
  AND "handicapLastUpdatedAt" IS NOT NULL;
