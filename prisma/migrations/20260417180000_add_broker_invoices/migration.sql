-- Add broker invoice support to Invoice table
ALTER TABLE "Invoice" ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Invoice" ADD COLUMN "brokerId" TEXT;
ALTER TABLE "Invoice" ALTER COLUMN "customerId" DROP NOT NULL;

-- Add index and foreign key for brokerId
CREATE INDEX "Invoice_brokerId_idx" ON "Invoice"("brokerId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
