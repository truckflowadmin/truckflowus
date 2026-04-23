-- Add pendingPlanId to Company for PayPal payment-then-assign flow
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT;
