CREATE TABLE IF NOT EXISTS "service_forms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'Generale',
  "icon" TEXT NOT NULL DEFAULT 'FORM',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "allowed_roles" JSONB,
  "allowed_location_ids" JSONB,
  "fields" JSONB NOT NULL,
  "notify_roles" JSONB,
  "notify_user_ids" JSONB,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_form_responses" (
  "id" TEXT NOT NULL,
  "form_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "user_location_id" TEXT,
  "user_location_name" TEXT,
  "answers" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT,
  "assigned_to_id" TEXT,
  "internal_notes" JSONB,
  "comments" JSONB,
  "activity_log" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_form_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_forms_active_idx" ON "service_forms"("active");
CREATE INDEX IF NOT EXISTS "service_form_responses_form_id_idx" ON "service_form_responses"("form_id");
CREATE INDEX IF NOT EXISTS "service_form_responses_user_id_idx" ON "service_form_responses"("user_id");
CREATE INDEX IF NOT EXISTS "service_form_responses_status_idx" ON "service_form_responses"("status");
CREATE INDEX IF NOT EXISTS "service_form_responses_user_location_id_idx" ON "service_form_responses"("user_location_id");

DO $$ BEGIN
  ALTER TABLE "service_forms"
    ADD CONSTRAINT "service_forms_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_form_responses"
    ADD CONSTRAINT "service_form_responses_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "service_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_form_responses"
    ADD CONSTRAINT "service_form_responses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_form_responses"
    ADD CONSTRAINT "service_form_responses_user_location_id_fkey"
    FOREIGN KEY ("user_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
