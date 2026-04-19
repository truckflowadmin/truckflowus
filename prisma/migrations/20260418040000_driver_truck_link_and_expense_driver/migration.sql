-- Link drivers to default trucks
ALTER TABLE "Driver" ADD COLUMN "defaultTruckId" TEXT;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_defaultTruckId_fkey" FOREIGN KEY ("defaultTruckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Driver_defaultTruckId_idx" ON "Driver"("defaultTruckId");

-- Add driverId to Expense so drivers can submit expenses
ALTER TABLE "Expense" ADD COLUMN "driverId" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Expense_driverId_idx" ON "Expense"("driverId");

-- Add TruckDocType enum and docType column to TruckPhoto
CREATE TYPE "TruckDocType" AS ENUM ('REGISTRATION', 'INSURANCE', 'INSPECTION', 'TRUCK_PHOTO', 'OTHER');
ALTER TABLE "TruckPhoto" ADD COLUMN "docType" "TruckDocType" NOT NULL DEFAULT 'OTHER';
CREATE INDEX "TruckPhoto_truckId_docType_idx" ON "TruckPhoto"("truckId", "docType");

-- Migrate existing TruckPhoto labels to docType where possible
UPDATE "TruckPhoto" SET "docType" = 'REGISTRATION' WHERE "label" = 'Registration';
UPDATE "TruckPhoto" SET "docType" = 'INSURANCE' WHERE "label" = 'Insurance Card';
UPDATE "TruckPhoto" SET "docType" = 'TRUCK_PHOTO' WHERE "label" = 'Truck Photo';
