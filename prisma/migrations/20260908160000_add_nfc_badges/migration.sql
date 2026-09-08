ALTER TABLE "users"
ADD COLUMN "nfc_badge_hash" TEXT,
ADD COLUMN "nfc_badge_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nfc_badge_enrolled_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_nfc_badge_hash_key" ON "users"("nfc_badge_hash");
