-- Backfill completedAt for COMPLETED tickets that are missing it.
-- Uses updatedAt as the best available approximation of when the ticket was completed.
UPDATE "Ticket"
SET "completedAt" = "updatedAt"
WHERE status = 'COMPLETED'
  AND "completedAt" IS NULL;
