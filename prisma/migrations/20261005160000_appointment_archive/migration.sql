CREATE TABLE "appointment_archive" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "start_at" TIMESTAMPTZ(3) NOT NULL,
  "search_text" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sheet" JSONB,
  "synced_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "appointment_archive_start_at_id_idx" ON "appointment_archive"("start_at", "id");
CREATE TABLE "appointment_archive_sync" (
  "month" TEXT NOT NULL PRIMARY KEY,
  "completed_at" TIMESTAMPTZ(3),
  "lease_until" TIMESTAMPTZ(3),
  "error" BOOLEAN NOT NULL DEFAULT false
);
