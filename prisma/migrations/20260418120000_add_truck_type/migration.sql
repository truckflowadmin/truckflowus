-- CreateEnum
CREATE TYPE "TruckType" AS ENUM ('SINGLE_AXLE', 'TANDEM', 'TRI_AXLE', 'QUAD', 'SUPER_DUMP', 'OTHER');

-- AlterTable: add truckType to Truck
ALTER TABLE "Truck" ADD COLUMN "truckType" "TruckType";

-- AlterTable: add requiredTruckType to Job
ALTER TABLE "Job" ADD COLUMN "requiredTruckType" "TruckType";
