-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "DriverPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "hoursWorked" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "jobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "ticketsCompleted" INTEGER NOT NULL DEFAULT 0,
    "payType" "PayType" NOT NULL DEFAULT 'HOURLY',
    "payRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "calculatedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adjustedAmount" DECIMAL(10,2),
    "finalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverPayment_companyId_driverId_idx" ON "DriverPayment"("companyId", "driverId");
CREATE INDEX "DriverPayment_companyId_status_idx" ON "DriverPayment"("companyId", "status");
CREATE INDEX "DriverPayment_driverId_periodStart_idx" ON "DriverPayment"("driverId", "periodStart");

-- AddForeignKey
ALTER TABLE "DriverPayment" ADD CONSTRAINT "DriverPayment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
