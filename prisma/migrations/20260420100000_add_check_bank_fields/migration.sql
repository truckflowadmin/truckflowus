-- Add bank routing/account fields for printed checks
ALTER TABLE "Company" ADD COLUMN "checkRoutingNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "checkAccountNumber" TEXT;
