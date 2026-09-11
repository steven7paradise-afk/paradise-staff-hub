CREATE TABLE "inventory_catalogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_catalogs_name_key" ON "inventory_catalogs"("name");
CREATE INDEX "inventory_catalogs_active_name_idx" ON "inventory_catalogs"("active", "name");

INSERT INTO "inventory_catalogs" ("id", "name", "created_at", "updated_at")
SELECT 'catalog_' || md5(lower(trim("category"))), trim("category"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "inventory_products"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY trim("category");
