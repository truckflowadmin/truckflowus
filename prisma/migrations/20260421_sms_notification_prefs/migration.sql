-- Add SMS notification preference fields to Driver
ALTER TABLE "Driver" ADD COLUMN "smsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Driver" ADD COLUMN "smsJobAssignment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Driver" ADD COLUMN "smsJobStatusChange" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Driver" ADD COLUMN "smsNewJobAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Driver" ADD COLUMN "smsPayrollReady" BOOLEAN NOT NULL DEFAULT true;

-- Add SMS notification preference fields to User (dispatchers)
ALTER TABLE "User" ADD COLUMN "smsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "smsDriverIssue" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "smsDriverCompleted" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "smsNewBrokerJob" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
