-- AlterTable: add truckNumber to Ticket for per-ticket truck tracking
ALTER TABLE "Ticket" ADD COLUMN "truckNumber" TEXT;
