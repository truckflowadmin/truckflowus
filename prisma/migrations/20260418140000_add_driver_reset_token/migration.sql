-- Add email reset token fields to Driver
ALTER TABLE "Driver" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "Driver" ADD COLUMN "resetTokenExp" TIMESTAMP(3);

-- Unique index on resetToken for fast lookups
CREATE UNIQUE INDEX "Driver_resetToken_key" ON "Driver"("resetToken");
