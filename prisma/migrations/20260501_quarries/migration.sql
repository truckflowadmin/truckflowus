-- CreateTable
CREATE TABLE "Quarry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "website" TEXT,
    "pricingUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "hoursOfOp" TEXT,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quarry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quarry_companyId_idx" ON "Quarry"("companyId");

-- AddForeignKey
ALTER TABLE "Quarry" ADD CONSTRAINT "Quarry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
