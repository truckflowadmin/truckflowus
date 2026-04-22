-- Add companyId to SmsLog for multi-tenant filtering
ALTER TABLE "SmsLog" ADD COLUMN "companyId" TEXT;
CREATE INDEX "SmsLog_companyId_createdAt_idx" ON "SmsLog"("companyId", "createdAt");

-- Backfill companyId from driver relation where possible
UPDATE "SmsLog" SET "companyId" = d."companyId"
FROM "Driver" d WHERE "SmsLog"."driverId" = d."id" AND "SmsLog"."companyId" IS NULL;

-- Backfill companyId from broker relation where possible
UPDATE "SmsLog" SET "companyId" = b."companyId"
FROM "Broker" b WHERE "SmsLog"."brokerId" = b."id" AND "SmsLog"."companyId" IS NULL;

-- Create FaxDirection enum
CREATE TYPE "FaxDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- Create FaxStatus enum
CREATE TYPE "FaxStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENDING', 'DELIVERED', 'RECEIVING', 'RECEIVED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELED');

-- Create FaxLog table
CREATE TABLE "FaxLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "direction" "FaxDirection" NOT NULL,
    "faxNumber" TEXT NOT NULL,
    "pages" INTEGER,
    "mediaUrl" TEXT,
    "twilioSid" TEXT,
    "status" "FaxStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "driverId" TEXT,
    "brokerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaxLog_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX "FaxLog_companyId_createdAt_idx" ON "FaxLog"("companyId", "createdAt");
CREATE INDEX "FaxLog_faxNumber_idx" ON "FaxLog"("faxNumber");
CREATE INDEX "FaxLog_createdAt_idx" ON "FaxLog"("createdAt");

-- Add foreign keys
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaxLog" ADD CONSTRAINT "FaxLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaxLog" ADD CONSTRAINT "FaxLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaxLog" ADD CONSTRAINT "FaxLog_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
