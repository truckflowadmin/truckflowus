-- Add security question fields to User (same pattern as Driver)
ALTER TABLE "User" ADD COLUMN "securityQ1" TEXT;
ALTER TABLE "User" ADD COLUMN "securityA1" TEXT;
ALTER TABLE "User" ADD COLUMN "securityQ2" TEXT;
ALTER TABLE "User" ADD COLUMN "securityA2" TEXT;
ALTER TABLE "User" ADD COLUMN "securityQ3" TEXT;
ALTER TABLE "User" ADD COLUMN "securityA3" TEXT;
