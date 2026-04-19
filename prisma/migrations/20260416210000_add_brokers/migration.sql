-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "email" TEXT,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "mailingAddress" TEXT,
    "notes" TEXT,
    "tripSheetForm" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broker_companyId_idx" ON "Broker"("companyId");

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add brokerId to Ticket
ALTER TABLE "Ticket" ADD COLUMN "brokerId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_brokerId_idx" ON "Ticket"("brokerId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TripSheetStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateTable
CREATE TABLE "TripSheet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "status" "TripSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDue" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripSheet_companyId_idx" ON "TripSheet"("companyId");
CREATE INDEX "TripSheet_brokerId_idx" ON "TripSheet"("brokerId");

-- AddForeignKeys
ALTER TABLE "TripSheet" ADD CONSTRAINT "TripSheet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripSheet" ADD CONSTRAINT "TripSheet_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add tripSheetId to Ticket
ALTER TABLE "Ticket" ADD COLUMN "tripSheetId" TEXT;
CREATE INDEX "Ticket_tripSheetId_idx" ON "Ticket"("tripSheetId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tripSheetId_fkey" FOREIGN KEY ("tripSheetId") REFERENCES "TripSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
