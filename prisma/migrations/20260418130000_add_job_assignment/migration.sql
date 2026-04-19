-- AlterTable: add requiredTruckCount to Job
ALTER TABLE "Job" ADD COLUMN "requiredTruckCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable: JobAssignment (multiple drivers per job)
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "truckNumber" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobAssignment_jobId_idx" ON "JobAssignment"("jobId");
CREATE INDEX "JobAssignment_driverId_idx" ON "JobAssignment"("driverId");
CREATE UNIQUE INDEX "JobAssignment_jobId_driverId_key" ON "JobAssignment"("jobId", "driverId");

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: migrate existing single-driver assignments to JobAssignment table
INSERT INTO "JobAssignment" ("id", "jobId", "driverId", "truckNumber", "assignedAt")
SELECT gen_random_uuid()::text, "id", "driverId", "truckNumber", COALESCE("assignedAt", NOW())
FROM "Job"
WHERE "driverId" IS NOT NULL;
