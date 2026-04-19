-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "disabledFeatures" TEXT[],
ADD COLUMN     "featureOverrides" TEXT[];
