-- Preserve the 15-minute attempt window for payments created before expiresAt
-- was introduced. The expiry job only selects rows with a non-null expiresAt.
UPDATE "Payment"
SET "expiresAt" = "createdAt" + INTERVAL '15 minutes'
WHERE "status" IN ('PENDING', 'PROCESSING')
  AND "expiresAt" IS NULL;
