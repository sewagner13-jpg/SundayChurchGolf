-- CreateTable
CREATE TABLE "ManualSettlement" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualSettlementEntry" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualSettlementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualSettlement_year_idx" ON "ManualSettlement"("year");

-- CreateIndex
CREATE INDEX "ManualSettlement_date_idx" ON "ManualSettlement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ManualSettlementEntry_settlementId_playerId_key" ON "ManualSettlementEntry"("settlementId", "playerId");

-- CreateIndex
CREATE INDEX "ManualSettlementEntry_playerId_idx" ON "ManualSettlementEntry"("playerId");

-- AddForeignKey
ALTER TABLE "ManualSettlementEntry" ADD CONSTRAINT "ManualSettlementEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ManualSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSettlementEntry" ADD CONSTRAINT "ManualSettlementEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
