-- AlterTable: Add phone to Broker
ALTER TABLE "Broker" ADD COLUMN "phone" TEXT;

-- AlterTable: Add brokerId and jobId to SmsLog
ALTER TABLE "SmsLog" ADD COLUMN "brokerId" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN "jobId" TEXT;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SmsLog_brokerId_idx" ON "SmsLog"("brokerId");
