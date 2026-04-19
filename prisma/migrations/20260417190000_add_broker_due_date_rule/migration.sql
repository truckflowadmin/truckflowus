-- Add due date rule settings to Broker
ALTER TABLE "Broker" ADD COLUMN "dueDateRule" TEXT NOT NULL DEFAULT 'NEXT_FRIDAY';
ALTER TABLE "Broker" ADD COLUMN "dueDateDays" INTEGER;
