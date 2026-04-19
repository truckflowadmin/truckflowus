-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "scannedAt" TIMESTAMP(3),
ADD COLUMN     "scannedDate" TEXT,
ADD COLUMN     "scannedRawText" TEXT,
ADD COLUMN     "scannedTicketNumber" TEXT,
ADD COLUMN     "scannedTons" TEXT,
ADD COLUMN     "scannedYards" TEXT;
