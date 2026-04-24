-- AlterTable: add EIN field for tax/1099 filing
ALTER TABLE "Company" ADD COLUMN "ein" TEXT;
