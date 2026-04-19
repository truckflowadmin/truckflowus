-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "brokerId" TEXT,
    "driverId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'CREATED',
    "hauledFrom" TEXT NOT NULL,
    "hauledTo" TEXT NOT NULL,
    "material" TEXT,
    "quantityType" "QuantityType" NOT NULL DEFAULT 'LOADS',
    "totalLoads" INTEGER NOT NULL DEFAULT 1,
    "completedLoads" INTEGER NOT NULL DEFAULT 0,
    "ratePerUnit" DECIMAL(10,2),
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "openForDrivers" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add jobId to Ticket
ALTER TABLE "Ticket" ADD COLUMN "jobId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_companyId_jobNumber_key" ON "Job"("companyId", "jobNumber");
CREATE INDEX "Job_companyId_status_idx" ON "Job"("companyId", "status");
CREATE INDEX "Job_driverId_status_idx" ON "Job"("driverId", "status");
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");
CREATE INDEX "Job_brokerId_idx" ON "Job"("brokerId");
CREATE INDEX "Ticket_jobId_idx" ON "Ticket"("jobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
