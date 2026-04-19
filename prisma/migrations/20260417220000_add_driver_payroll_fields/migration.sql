-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'SALARY', 'PERCENTAGE');

-- Add payroll fields to Driver
ALTER TABLE "Driver" ADD COLUMN "workerType" "WorkerType" NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "Driver" ADD COLUMN "payType" "PayType" NOT NULL DEFAULT 'HOURLY';
ALTER TABLE "Driver" ADD COLUMN "payRate" DECIMAL(10,2);
