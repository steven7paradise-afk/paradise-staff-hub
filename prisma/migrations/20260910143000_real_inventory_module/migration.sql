CREATE TYPE "InventoryLocationKind" AS ENUM ('WAREHOUSE', 'SALON');
CREATE TYPE "InventoryLabelStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'DAMAGED', 'LOST', 'CANCELLED');
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'RETURN', 'DAMAGED', 'ADJUSTMENT');
CREATE TYPE "InventorySyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'NOT_CONFIGURED');

CREATE SEQUENCE "inventory_label_code_seq" START 1;

CREATE TABLE "inventory_products" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image_url" TEXT,
  "category" TEXT,
  "sku" TEXT NOT NULL,
  "barcode" TEXT,
  "minimum_stock" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "shopify_product_id" TEXT,
  "shopify_variant_id" TEXT,
  "shopify_inventory_item_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_products_minimum_stock_check" CHECK ("minimum_stock" >= 0)
);

CREATE TABLE "inventory_locations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "InventoryLocationKind" NOT NULL,
  "address" TEXT,
  "linked_location_id" TEXT,
  "shopify_location_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_labels" (
  "id" TEXT NOT NULL,
  "label_code" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "lot_number" TEXT,
  "status" "InventoryLabelStatus" NOT NULL DEFAULT 'AVAILABLE',
  "received_at" TIMESTAMP(3),
  "sold_at" TIMESTAMP(3),
  "last_printed_at" TIMESTAMP(3),
  "print_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_labels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_labels_print_count_check" CHECK ("print_count" >= 0)
);

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "inventory_label_id" TEXT NOT NULL,
  "movement_type" "InventoryMovementType" NOT NULL,
  "from_location_id" TEXT,
  "to_location_id" TEXT,
  "user_id" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_print_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "printer_name" TEXT,
  "label_format" TEXT NOT NULL DEFAULT '50x30',
  "labels_count" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_print_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_print_jobs_labels_count_check" CHECK ("labels_count" > 0)
);

CREATE TABLE "inventory_print_job_labels" (
  "print_job_id" TEXT NOT NULL,
  "label_id" TEXT NOT NULL,
  CONSTRAINT "inventory_print_job_labels_pkey" PRIMARY KEY ("print_job_id", "label_id")
);

CREATE TABLE "inventory_stock_sync_jobs" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "desired_quantity" INTEGER NOT NULL,
  "status" "InventorySyncStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "synced_at" TIMESTAMP(3),
  CONSTRAINT "inventory_stock_sync_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_stock_sync_jobs_quantity_check" CHECK ("desired_quantity" >= 0)
);

CREATE UNIQUE INDEX "inventory_products_sku_key" ON "inventory_products"("sku");
CREATE UNIQUE INDEX "inventory_products_barcode_key" ON "inventory_products"("barcode");
CREATE UNIQUE INDEX "inventory_products_shopify_variant_id_key" ON "inventory_products"("shopify_variant_id");
CREATE INDEX "inventory_products_name_idx" ON "inventory_products"("name");
CREATE INDEX "inventory_products_category_idx" ON "inventory_products"("category");
CREATE UNIQUE INDEX "inventory_locations_code_key" ON "inventory_locations"("code");
CREATE UNIQUE INDEX "inventory_locations_linked_location_id_key" ON "inventory_locations"("linked_location_id");
CREATE INDEX "inventory_locations_kind_active_idx" ON "inventory_locations"("kind", "active");
CREATE UNIQUE INDEX "inventory_labels_label_code_key" ON "inventory_labels"("label_code");
CREATE UNIQUE INDEX "inventory_labels_barcode_key" ON "inventory_labels"("barcode");
CREATE INDEX "inventory_labels_product_id_status_idx" ON "inventory_labels"("product_id", "status");
CREATE INDEX "inventory_labels_location_id_status_idx" ON "inventory_labels"("location_id", "status");
CREATE INDEX "inventory_labels_created_at_idx" ON "inventory_labels"("created_at");
CREATE INDEX "inventory_movements_inventory_label_id_created_at_idx" ON "inventory_movements"("inventory_label_id", "created_at");
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");
CREATE INDEX "inventory_movements_movement_type_created_at_idx" ON "inventory_movements"("movement_type", "created_at");
CREATE INDEX "inventory_movements_from_location_id_created_at_idx" ON "inventory_movements"("from_location_id", "created_at");
CREATE INDEX "inventory_movements_to_location_id_created_at_idx" ON "inventory_movements"("to_location_id", "created_at");
CREATE INDEX "inventory_print_jobs_created_at_idx" ON "inventory_print_jobs"("created_at");
CREATE INDEX "inventory_print_job_labels_label_id_idx" ON "inventory_print_job_labels"("label_id");
CREATE INDEX "inventory_stock_sync_jobs_status_created_at_idx" ON "inventory_stock_sync_jobs"("status", "created_at");
CREATE INDEX "inventory_stock_sync_jobs_product_id_location_id_created_at_idx" ON "inventory_stock_sync_jobs"("product_id", "location_id", "created_at");

ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_linked_location_id_fkey" FOREIGN KEY ("linked_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_labels" ADD CONSTRAINT "inventory_labels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_labels" ADD CONSTRAINT "inventory_labels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_labels" ADD CONSTRAINT "inventory_labels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_label_id_fkey" FOREIGN KEY ("inventory_label_id") REFERENCES "inventory_labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_print_jobs" ADD CONSTRAINT "inventory_print_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_print_job_labels" ADD CONSTRAINT "inventory_print_job_labels_print_job_id_fkey" FOREIGN KEY ("print_job_id") REFERENCES "inventory_print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_print_job_labels" ADD CONSTRAINT "inventory_print_job_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "inventory_labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_sync_jobs" ADD CONSTRAINT "inventory_stock_sync_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_sync_jobs" ADD CONSTRAINT "inventory_stock_sync_jobs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Il registro è append-only: eventuali correzioni devono essere nuovi movimenti ADJUSTMENT.
CREATE FUNCTION prevent_inventory_movement_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'I movimenti di magazzino sono immutabili';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_movements_immutable_update"
BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

