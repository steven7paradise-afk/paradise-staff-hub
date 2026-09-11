CREATE TABLE "inventory_count_sessions" (
  "id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "scans_count" INTEGER NOT NULL,
  "products_count" INTEGER NOT NULL,
  "summary" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_count_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_count_scans" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "inventory_label_id" TEXT,
  "raw_code" TEXT NOT NULL,
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_count_scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_count_sessions_location_id_created_at_idx" ON "inventory_count_sessions"("location_id", "created_at");
CREATE INDEX "inventory_count_sessions_created_by_id_created_at_idx" ON "inventory_count_sessions"("created_by_id", "created_at");
CREATE INDEX "inventory_count_scans_session_id_scanned_at_idx" ON "inventory_count_scans"("session_id", "scanned_at");
CREATE INDEX "inventory_count_scans_product_id_scanned_at_idx" ON "inventory_count_scans"("product_id", "scanned_at");
CREATE INDEX "inventory_count_scans_inventory_label_id_idx" ON "inventory_count_scans"("inventory_label_id");

ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_scans" ADD CONSTRAINT "inventory_count_scans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "inventory_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_count_scans" ADD CONSTRAINT "inventory_count_scans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_scans" ADD CONSTRAINT "inventory_count_scans_inventory_label_id_fkey" FOREIGN KEY ("inventory_label_id") REFERENCES "inventory_labels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
