-- Fix tickets with bogus completedAt from the updatedAt backfill.
-- A ticket created more than 7 days ago but showing completedAt within
-- the last 7 days is clearly bad data — reset to createdAt.
UPDATE "Ticket"
SET "completedAt" = "createdAt"
WHERE status = 'COMPLETED'
  AND "createdAt" < (NOW() - INTERVAL '7 days')
  AND "completedAt" > (NOW() - INTERVAL '7 days');
