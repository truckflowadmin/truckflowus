-- Add driver time tracking fields to Job (pause/resume timer)
ALTER TABLE "Job" ADD COLUMN "driverTimeSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "lastResumedAt" TIMESTAMP(3);
