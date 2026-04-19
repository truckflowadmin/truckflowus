-- Add optional trip-sheet override fields to Truck
ALTER TABLE "Truck" ADD COLUMN "payToName" TEXT;
ALTER TABLE "Truck" ADD COLUMN "dispatcherName" TEXT;
