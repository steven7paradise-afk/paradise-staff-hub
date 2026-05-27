ALTER TABLE "users"
ADD COLUMN "birth_date" TIMESTAMP(3),
ADD COLUMN "fiscal_code" TEXT,
ADD COLUMN "contract_start" TIMESTAMP(3),
ADD COLUMN "contract_end" TIMESTAMP(3),
ADD COLUMN "photo_url" TEXT;

ALTER TABLE "locations"
ADD COLUMN "phone" TEXT,
ADD COLUMN "opening_time" TEXT,
ADD COLUMN "closing_time" TEXT;
