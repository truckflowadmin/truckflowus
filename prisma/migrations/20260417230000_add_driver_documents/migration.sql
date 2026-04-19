-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('LICENSE_FRONT', 'LICENSE_BACK', 'MEDICAL_CERT', 'VOID_CHECK', 'OTHER');

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverDocument_driverId_docType_idx" ON "DriverDocument"("driverId", "docType");

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
