CREATE TABLE IF NOT EXISTS "shopify_payment_reviews" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_name" TEXT NOT NULL,
  "client_name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "methods" JSONB,
  "response_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requested_by_id" TEXT NOT NULL,
  "requested_by_name" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_by_id" TEXT,
  "confirmed_by_name" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shopify_payment_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shopify_payment_reviews_order_id_key"
  ON "shopify_payment_reviews"("order_id");

CREATE INDEX IF NOT EXISTS "shopify_payment_reviews_status_requested_at_idx"
  ON "shopify_payment_reviews"("status", "requested_at");
