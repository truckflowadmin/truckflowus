-- CreateEnum
CREATE TYPE "QuantityType" AS ENUM ('LOADS', 'TONS', 'YARDS');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- Step 1: Add new columns as NULLABLE first
ALTER TABLE "Ticket" ADD COLUMN "hauledFrom" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "hauledTo" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "quantityType" "QuantityType" NOT NULL DEFAULT 'LOADS';
ALTER TABLE "Ticket" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Ticket" ADD COLUMN "ticketRef" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "date" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "ratePerUnit" DECIMAL(10,2);

-- Step 2: Migrate data from old columns to new
UPDATE "Ticket" SET
    "hauledFrom" = "pickupAddress",
    "hauledTo" = "dropoffAddress",
    "quantity" = "loadCount",
    "ratePerUnit" = "ratePerLoad",
    "date" = "scheduledFor";

-- Step 3: Make required columns NOT NULL now that they have data
ALTER TABLE "Ticket" ALTER COLUMN "hauledFrom" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "hauledTo" SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE "Ticket" DROP COLUMN "pickupAddress";
ALTER TABLE "Ticket" DROP COLUMN "pickupNotes";
ALTER TABLE "Ticket" DROP COLUMN "dropoffAddress";
ALTER TABLE "Ticket" DROP COLUMN "dropoffNotes";
ALTER TABLE "Ticket" DROP COLUMN "loadCount";
ALTER TABLE "Ticket" DROP COLUMN "ratePerLoad";
ALTER TABLE "Ticket" DROP COLUMN "scheduledFor";

-- CreateIndex
CREATE INDEX "Material_companyId_idx" ON "Material"("companyId");
CREATE UNIQUE INDEX "Material_companyId_name_key" ON "Material"("companyId", "name");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
