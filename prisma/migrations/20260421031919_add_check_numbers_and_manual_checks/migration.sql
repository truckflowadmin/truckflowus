-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('PAYMENT', 'ADJUSTMENT', 'PLAN_CHANGE', 'TRIAL_STARTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "customPriceCents" INTEGER,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "payDay" TEXT,
ADD COLUMN     "payFrequency" TEXT;

-- AlterTable
ALTER TABLE "DriverPayment" ADD COLUMN     "checkNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ManualCheck" (
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

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "BillingEventType" NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "subscriptionStatus" "SubscriptionStatus",
    "paymentMethod" TEXT,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualCheck_companyId_idx" ON "ManualCheck"("companyId");

-- CreateIndex
CREATE INDEX "ManualCheck_companyId_checkNumber_idx" ON "ManualCheck"("companyId", "checkNumber");

-- CreateIndex
CREATE INDEX "BillingEvent_companyId_createdAt_idx" ON "BillingEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_companyId_type_idx" ON "BillingEvent"("companyId", "type");

-- CreateIndex
CREATE INDEX "DriverPayment_companyId_checkNumber_idx" ON "DriverPayment"("companyId", "checkNumber");

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
