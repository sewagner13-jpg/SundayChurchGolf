-- CreateTable
CREATE TABLE "RoundMessage" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "senderTeamId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundMessageAcknowledgement" (
    "id" TEXT NOT NULL,
    "roundMessageId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundMessageAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoundMessage_roundId_createdAt_idx" ON "RoundMessage"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "RoundMessage_senderTeamId_idx" ON "RoundMessage"("senderTeamId");

-- CreateIndex
CREATE INDEX "RoundMessageAcknowledgement_teamId_idx" ON "RoundMessageAcknowledgement"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundMessageAcknowledgement_roundMessageId_teamId_key" ON "RoundMessageAcknowledgement"("roundMessageId", "teamId");

-- AddForeignKey
ALTER TABLE "RoundMessage" ADD CONSTRAINT "RoundMessage_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundMessage" ADD CONSTRAINT "RoundMessage_senderTeamId_fkey" FOREIGN KEY ("senderTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundMessageAcknowledgement" ADD CONSTRAINT "RoundMessageAcknowledgement_roundMessageId_fkey" FOREIGN KEY ("roundMessageId") REFERENCES "RoundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundMessageAcknowledgement" ADD CONSTRAINT "RoundMessageAcknowledgement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
