-- Fleet: Trucks and Expenses

-- Enums
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'SOLD');
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'MAINTENANCE', 'INSURANCE', 'REGISTRATION', 'TOLLS', 'TIRES', 'PARTS', 'LEASE', 'LOAN', 'WASH', 'PERMITS', 'OTHER');

-- Truck table
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "vin" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "licensePlate" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- TruckPhoto table
CREATE TABLE "TruckPhoto" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TruckPhoto_pkey" PRIMARY KEY ("id")
);

-- Expense table
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "truckId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "receiptUrl" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "recurringEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruckPhoto" ADD CONSTRAINT "TruckPhoto_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Truck_companyId_idx" ON "Truck"("companyId");
CREATE INDEX "Truck_companyId_truckNumber_idx" ON "Truck"("companyId", "truckNumber");
CREATE INDEX "TruckPhoto_truckId_idx" ON "TruckPhoto"("truckId");
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");
CREATE INDEX "Expense_companyId_category_idx" ON "Expense"("companyId", "category");
CREATE INDEX "Expense_companyId_truckId_idx" ON "Expense"("companyId", "truckId");
CREATE INDEX "Expense_companyId_date_idx" ON "Expense"("companyId", "date");
