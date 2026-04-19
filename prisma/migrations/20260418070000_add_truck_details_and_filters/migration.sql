-- Add drivetrain detail fields to Truck
ALTER TABLE "Truck" ADD COLUMN "engineMake" TEXT;
ALTER TABLE "Truck" ADD COLUMN "engineModel" TEXT;
ALTER TABLE "Truck" ADD COLUMN "engineSerial" TEXT;
ALTER TABLE "Truck" ADD COLUMN "transmissionMake" TEXT;
ALTER TABLE "Truck" ADD COLUMN "transmissionModel" TEXT;
ALTER TABLE "Truck" ADD COLUMN "transmissionSerial" TEXT;
ALTER TABLE "Truck" ADD COLUMN "rearEndMake" TEXT;
ALTER TABLE "Truck" ADD COLUMN "rearEndModel" TEXT;
ALTER TABLE "Truck" ADD COLUMN "rearEndRatio" TEXT;
ALTER TABLE "Truck" ADD COLUMN "rearEndSerial" TEXT;

-- Create FilterType enum and TruckFilter table
CREATE TYPE "FilterType" AS ENUM ('DIESEL', 'OIL', 'AIR_CABIN', 'AIR_ENGINE');

CREATE TABLE "TruckFilter" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "filterType" "FilterType" NOT NULL,
    "partNumber" TEXT,
    "lastReplacedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckFilter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TruckFilter_truckId_filterType_key" ON "TruckFilter"("truckId", "filterType");
CREATE INDEX "TruckFilter_truckId_idx" ON "TruckFilter"("truckId");

ALTER TABLE "TruckFilter" ADD CONSTRAINT "TruckFilter_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
