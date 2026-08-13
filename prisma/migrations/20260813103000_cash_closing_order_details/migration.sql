ALTER TABLE "cash_closings"
  ADD COLUMN IF NOT EXISTS "cash_orders" JSONB;
