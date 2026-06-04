ALTER TABLE "staff_tasks"
ADD COLUMN IF NOT EXISTS "timer_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "completion_note" TEXT,
ADD COLUMN IF NOT EXISTS "completion_files" JSONB,
ADD COLUMN IF NOT EXISTS "completion_links" JSONB;

CREATE TABLE IF NOT EXISTS "staff_task_comments" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_task_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_task_comments_task_id_idx" ON "staff_task_comments"("task_id");
CREATE INDEX IF NOT EXISTS "staff_task_comments_user_id_idx" ON "staff_task_comments"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_comments_task_id_fkey'
  ) THEN
    ALTER TABLE "staff_task_comments"
    ADD CONSTRAINT "staff_task_comments_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_comments_user_id_fkey'
  ) THEN
    ALTER TABLE "staff_task_comments"
    ADD CONSTRAINT "staff_task_comments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
