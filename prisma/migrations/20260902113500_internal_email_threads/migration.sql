ALTER TABLE "internal_emails" ADD COLUMN "thread_id" TEXT;
ALTER TABLE "internal_emails" ADD COLUMN "reply_to_id" TEXT;

UPDATE "internal_emails" SET "thread_id" = "id" WHERE "thread_id" IS NULL;

DO $$
DECLARE
  reply_row RECORD;
  previous_id TEXT;
  previous_thread_id TEXT;
BEGIN
  FOR reply_row IN
    SELECT "id", "sender_id", "subject", "created_at"
    FROM "internal_emails"
    WHERE "status" = 'SENT' AND "subject" ~* '^Re:[[:space:]]*'
    ORDER BY "created_at" ASC
  LOOP
    SELECT candidate."id", candidate."thread_id"
      INTO previous_id, previous_thread_id
    FROM "internal_emails" candidate
    WHERE candidate."status" = 'SENT'
      AND candidate."created_at" < reply_row."created_at"
      AND lower(regexp_replace(candidate."subject", '^(Re:[[:space:]]*)+', '', 'i')) = lower(regexp_replace(reply_row."subject", '^(Re:[[:space:]]*)+', '', 'i'))
      AND (
        EXISTS (
          SELECT 1 FROM "internal_email_recipients" reply_recipient
          WHERE reply_recipient."email_id" = reply_row."id"
            AND reply_recipient."recipient_id" = candidate."sender_id"
        )
        OR EXISTS (
          SELECT 1 FROM "internal_email_recipients" candidate_recipient
          WHERE candidate_recipient."email_id" = candidate."id"
            AND candidate_recipient."recipient_id" = reply_row."sender_id"
        )
      )
    ORDER BY candidate."created_at" DESC
    LIMIT 1;

    IF previous_id IS NOT NULL THEN
      UPDATE "internal_emails"
      SET "thread_id" = previous_thread_id, "reply_to_id" = previous_id
      WHERE "id" = reply_row."id";
    END IF;

    previous_id := NULL;
    previous_thread_id := NULL;
  END LOOP;
END $$;

ALTER TABLE "internal_emails" ALTER COLUMN "thread_id" SET NOT NULL;

CREATE INDEX "internal_emails_thread_id_created_at_idx" ON "internal_emails"("thread_id", "created_at");
