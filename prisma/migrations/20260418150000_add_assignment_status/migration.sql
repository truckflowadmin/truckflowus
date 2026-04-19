-- Add per-driver status tracking fields to JobAssignment
ALTER TABLE "JobAssignment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ASSIGNED';
ALTER TABLE "JobAssignment" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "JobAssignment" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "JobAssignment" ADD COLUMN "driverTimeSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobAssignment" ADD COLUMN "lastResumedAt" TIMESTAMP(3);

-- Backfill: copy job-level status/timing to existing assignments
-- If the job is IN_PROGRESS or COMPLETED, mirror that to all its assignments
UPDATE "JobAssignment" ja
SET
  "status" = j."status",
  "startedAt" = j."startedAt",
  "completedAt" = j."completedAt",
  "driverTimeSeconds" = COALESCE(j."driverTimeSeconds", 0),
  "lastResumedAt" = j."lastResumedAt"
FROM "Job" j
WHERE ja."jobId" = j."id"
  AND j."status" IN ('IN_PROGRESS', 'COMPLETED');
