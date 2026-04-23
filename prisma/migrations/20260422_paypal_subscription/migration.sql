-- Add PayPal subscription fields to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "paypalPlanId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "paypalPayerEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- Add PayPal plan ID to Plan
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "paypalPlanId" TEXT;
