-- Backfill completedAt for COMPLETED tickets that are missing it.
-- Uses createdAt as a safe fallback — it's always in the past and won't
-- inflate current-week counts (unlike updatedAt which changes on any edit).
UPDATE "Ticket"
SET "completedAt" = "createdAt"
WHERE status = 'COMPLETED'
  AND "completedAt" IS NULL;

-- Also fix any tickets where completedAt was previously backfilled from
-- updatedAt (which may have been recently touched), by resetting them to
-- createdAt. Only affects tickets where completedAt exactly equals updatedAt
-- AND is different from createdAt (indicating a bad backfill, not a natural set).
UPDATE "Ticket"
SET "completedAt" = "createdAt"
WHERE status = 'COMPLETED'
  AND "completedAt" = "updatedAt"
  AND "completedAt" != "createdAt";
