CREATE TABLE "work_hour_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_hour_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_hour_records_user_id_date_key" ON "work_hour_records"("user_id", "date");
CREATE INDEX "work_hour_records_date_idx" ON "work_hour_records"("date");

ALTER TABLE "work_hour_records"
ADD CONSTRAINT "work_hour_records_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
