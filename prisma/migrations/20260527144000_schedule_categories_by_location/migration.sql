ALTER TABLE "schedule_categories" ADD COLUMN "location_id" TEXT;

ALTER TABLE "schedule_categories" DROP CONSTRAINT IF EXISTS "schedule_categories_code_key";

CREATE UNIQUE INDEX "schedule_categories_code_location_id_key" ON "schedule_categories"("code", "location_id");

ALTER TABLE "schedule_categories"
  ADD CONSTRAINT "schedule_categories_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
