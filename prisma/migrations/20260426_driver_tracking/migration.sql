-- GPS location pings from the native driver app
CREATE TABLE "DriverLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- Proof of delivery (photos + signatures)
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "ticketRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- Indexes for DriverLocation
CREATE INDEX "DriverLocation_driverId_jobId_idx" ON "DriverLocation"("driverId", "jobId");
CREATE INDEX "DriverLocation_jobId_idx" ON "DriverLocation"("jobId");
CREATE INDEX "DriverLocation_companyId_createdAt_idx" ON "DriverLocation"("companyId", "createdAt");

-- Indexes for ProofOfDelivery
CREATE INDEX "ProofOfDelivery_jobId_idx" ON "ProofOfDelivery"("jobId");
CREATE INDEX "ProofOfDelivery_driverId_idx" ON "ProofOfDelivery"("driverId");
CREATE INDEX "ProofOfDelivery_companyId_idx" ON "ProofOfDelivery"("companyId");

-- Foreign keys for DriverLocation
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JobAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for ProofOfDelivery
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
