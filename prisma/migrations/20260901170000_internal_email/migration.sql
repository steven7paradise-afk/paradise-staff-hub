CREATE TABLE "internal_emails" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "draft_recipient_ids" JSONB,
    "attachments" JSONB,
    "sender_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_email_recipients" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_email_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "internal_emails_sender_id_created_at_idx" ON "internal_emails"("sender_id", "created_at");
CREATE INDEX "internal_email_recipients_recipient_id_created_at_idx" ON "internal_email_recipients"("recipient_id", "created_at");
CREATE UNIQUE INDEX "internal_email_recipients_email_id_recipient_id_key" ON "internal_email_recipients"("email_id", "recipient_id");

ALTER TABLE "internal_emails" ADD CONSTRAINT "internal_emails_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_email_recipients" ADD CONSTRAINT "internal_email_recipients_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "internal_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_email_recipients" ADD CONSTRAINT "internal_email_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
