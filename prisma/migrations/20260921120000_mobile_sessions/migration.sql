CREATE TABLE "mobile_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "device_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_sessions_token_hash_key" ON "mobile_sessions"("token_hash");
CREATE INDEX "mobile_sessions_user_id_idx" ON "mobile_sessions"("user_id");
CREATE INDEX "mobile_sessions_expires_at_idx" ON "mobile_sessions"("expires_at");

ALTER TABLE "mobile_sessions"
  ADD CONSTRAINT "mobile_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
