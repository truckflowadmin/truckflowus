-- AlterTable: change Ticket.quantity from INT to DECIMAL(10,2) to support fractional tons/yards
ALTER TABLE "Ticket" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2) USING "quantity"::DECIMAL(10,2);
ALTER TABLE "Ticket" ALTER COLUMN "quantity" SET DEFAULT 1;
