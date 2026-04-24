-- Fix tickets where completedAt was incorrectly backfilled from updatedAt.
-- updatedAt changes on ANY edit, so old tickets touched recently got a
-- false "completed this week" timestamp. Reset those to createdAt.
UPDATE "Ticket"
SET "completedAt" = "createdAt"
WHERE status = 'COMPLETED'
  AND "completedAt" = "updatedAt"
  AND "completedAt" != "createdAt";
