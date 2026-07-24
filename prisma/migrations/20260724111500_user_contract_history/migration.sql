ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "contract_history" JSONB;
