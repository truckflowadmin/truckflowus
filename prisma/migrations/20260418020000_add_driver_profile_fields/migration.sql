-- Add profile fields to Driver (address, emergency contact)
ALTER TABLE "Driver" ADD COLUMN "address" TEXT;
ALTER TABLE "Driver" ADD COLUMN "city" TEXT;
ALTER TABLE "Driver" ADD COLUMN "state" TEXT;
ALTER TABLE "Driver" ADD COLUMN "zip" TEXT;
ALTER TABLE "Driver" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "Driver" ADD COLUMN "emergencyContactPhone" TEXT;
