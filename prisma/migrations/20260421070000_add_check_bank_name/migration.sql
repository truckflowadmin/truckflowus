-- Add bank name field for printed checks
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "checkBankName" TEXT;
