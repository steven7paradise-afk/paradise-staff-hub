ALTER TABLE "inventory_count_sessions"
ADD COLUMN "inventory_date" DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX "inventory_count_sessions_location_id_inventory_date_idx"
ON "inventory_count_sessions"("location_id", "inventory_date");

CREATE INDEX "inventory_count_sessions_inventory_date_created_at_idx"
ON "inventory_count_sessions"("inventory_date", "created_at");

DROP INDEX IF EXISTS "inventory_count_sessions_location_id_created_at_idx";
