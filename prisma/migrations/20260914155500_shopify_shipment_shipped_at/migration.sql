ALTER TABLE "shopify_shipments" ADD COLUMN "shipped_at" TIMESTAMP(3);

UPDATE "shopify_shipments"
SET "shipped_at" = "updated_at"
WHERE "status" = 'SHIPPED' AND "shipped_at" IS NULL;

CREATE INDEX "shopify_shipments_status_shipped_at_idx"
ON "shopify_shipments"("status", "shipped_at");
