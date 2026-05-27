ALTER TABLE "devices"
ADD COLUMN "enrollment_token_hash" TEXT,
ADD COLUMN "access_token_hash" TEXT,
ADD COLUMN "registered_ip" TEXT,
ADD COLUMN "enrollment_expires_at" TIMESTAMP(3),
ADD COLUMN "activated_at" TIMESTAMP(3);
