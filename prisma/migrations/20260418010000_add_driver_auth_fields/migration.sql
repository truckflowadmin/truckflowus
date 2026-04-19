-- Add driver authentication fields
ALTER TABLE "Driver" ADD COLUMN "email" TEXT;
ALTER TABLE "Driver" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "Driver" ADD COLUMN "pinSet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Driver" ADD COLUMN "securityQ1" TEXT;
ALTER TABLE "Driver" ADD COLUMN "securityA1" TEXT;
ALTER TABLE "Driver" ADD COLUMN "securityQ2" TEXT;
ALTER TABLE "Driver" ADD COLUMN "securityA2" TEXT;
ALTER TABLE "Driver" ADD COLUMN "securityQ3" TEXT;
ALTER TABLE "Driver" ADD COLUMN "securityA3" TEXT;
