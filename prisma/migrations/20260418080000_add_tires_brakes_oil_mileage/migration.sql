-- Add oil specification fields to Truck
ALTER TABLE "Truck" ADD COLUMN "oilType" TEXT;
ALTER TABLE "Truck" ADD COLUMN "oilBrand" TEXT;

-- Add mileage tracking fields to TruckFilter
ALTER TABLE "TruckFilter" ADD COLUMN "mileage" INTEGER;
ALTER TABLE "TruckFilter" ADD COLUMN "nextDueMileage" INTEGER;

-- Add TIRES and BRAKES to FilterType enum
ALTER TYPE "FilterType" ADD VALUE 'TIRES';
ALTER TYPE "FilterType" ADD VALUE 'BRAKES';
