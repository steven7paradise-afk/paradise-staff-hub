ALTER TABLE "users"
ADD COLUMN "google_calendar_sync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "google_calendar_id" TEXT;

ALTER TABLE "leave_requests"
ADD COLUMN "google_calendar_event_id" TEXT;
