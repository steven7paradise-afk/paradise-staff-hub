ALTER TABLE "schedule_categories" ADD COLUMN "editable_time" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "schedule_worker_overrides" (
  "id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "schedule_worker_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_worker_overrides_location_id_user_id_key" ON "schedule_worker_overrides"("location_id", "user_id");
CREATE INDEX "schedule_worker_overrides_location_id_idx" ON "schedule_worker_overrides"("location_id");
CREATE INDEX "schedule_worker_overrides_user_id_idx" ON "schedule_worker_overrides"("user_id");

ALTER TABLE "schedule_worker_overrides" ADD CONSTRAINT "schedule_worker_overrides_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_worker_overrides" ADD CONSTRAINT "schedule_worker_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
