-- Add checkNumber to DriverPayment
ALTER TABLE "DriverPayment" ADD COLUMN IF NOT EXISTS "checkNumber" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "DriverPayment_companyId_checkNumber_idx" ON "DriverPayment"("companyId", "checkNumber");

-- Create ManualCheck table
CREATE TABLE IF NOT EXISTS "ManualCheck" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "checkNumber" INTEGER NOT NULL DEFAULT 0,
    "payee" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "memo" TEXT,
    "category" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ManualCheck_companyId_idx" ON "ManualCheck"("companyId");
CREATE INDEX IF NOT EXISTS "ManualCheck_companyId_checkNumber_idx" ON "ManualCheck"("companyId", "checkNumber");
