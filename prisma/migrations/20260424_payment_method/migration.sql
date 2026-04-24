-- CreateEnum PaymentMethod
CREATE TYPE "PaymentMethod" AS ENUM ('CHECK', 'CASH', 'DIRECT_DEPOSIT', 'MONEY_ORDER', 'ZELLE', 'VENMO', 'OTHER');

-- Add manual payment tracking fields to DriverPayment
ALTER TABLE "DriverPayment" ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriverPayment" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CHECK';
ALTER TABLE "DriverPayment" ADD COLUMN "referenceNumber" TEXT;
