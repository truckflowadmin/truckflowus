-- AlterTable: Add customerId to SmsLog for customer contact tracking
ALTER TABLE "SmsLog" ADD COLUMN "customerId" TEXT;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SmsLog_customerId_idx" ON "SmsLog"("customerId");
