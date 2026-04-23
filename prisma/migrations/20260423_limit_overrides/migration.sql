-- Add per-tenant limit overrides (null = use plan default)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxDriversOverride" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxTicketsPerMonthOverride" INTEGER;
