-- AlterTable: add address fields to Job
ALTER TABLE "Job" ADD COLUMN "hauledFromAddress" TEXT;
ALTER TABLE "Job" ADD COLUMN "hauledToAddress" TEXT;
