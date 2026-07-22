ALTER TABLE "leave_requests" ADD COLUMN "approved_at" TIMESTAMP(3);

UPDATE "leave_requests"
SET "approved_at" = "created_at"
WHERE "status" = 'APPROVED'
  AND "approved_at" IS NULL;
