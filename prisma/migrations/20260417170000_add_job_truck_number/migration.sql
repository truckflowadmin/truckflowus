-- AlterTable: add truckNumber to Job for default truck tracking per job
ALTER TABLE "Job" ADD COLUMN "truckNumber" TEXT;
