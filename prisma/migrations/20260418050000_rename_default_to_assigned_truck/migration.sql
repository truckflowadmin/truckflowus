-- Rename defaultTruckId to assignedTruckId on Driver
ALTER TABLE "Driver" RENAME COLUMN "defaultTruckId" TO "assignedTruckId";

-- Recreate index with new name
DROP INDEX IF EXISTS "Driver_defaultTruckId_idx";
CREATE INDEX "Driver_assignedTruckId_idx" ON "Driver"("assignedTruckId");

-- Recreate foreign key with new name
ALTER TABLE "Driver" DROP CONSTRAINT IF EXISTS "Driver_defaultTruckId_fkey";
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_assignedTruckId_fkey" FOREIGN KEY ("assignedTruckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
