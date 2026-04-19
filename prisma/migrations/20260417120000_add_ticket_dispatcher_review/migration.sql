-- AlterTable: add dispatcher review columns to Ticket
ALTER TABLE "Ticket" ADD COLUMN "dispatcherReviewedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "dispatcherReviewedBy" TEXT;
