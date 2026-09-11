CREATE TABLE "assistant_action_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "assistant_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_action_logs_user_id_created_at_idx" ON "assistant_action_logs"("user_id", "created_at");
CREATE INDEX "assistant_action_logs_status_created_at_idx" ON "assistant_action_logs"("status", "created_at");

ALTER TABLE "assistant_action_logs"
ADD CONSTRAINT "assistant_action_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
