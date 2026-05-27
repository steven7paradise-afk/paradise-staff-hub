ALTER TABLE "work_hour_records"
ADD COLUMN "paid_break" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manual_override" BOOLEAN NOT NULL DEFAULT false;
