CREATE TABLE "shift_reports" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location_id" TEXT NOT NULL,
    "responsible_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "report_data" JSONB NOT NULL,
    "automatic_data" JSONB NOT NULL,
    "manager_notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shift_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_report_revisions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_report_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_report_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shift_report_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_reports_date_location_id_key" ON "shift_reports"("date", "location_id");
CREATE INDEX "shift_reports_status_date_idx" ON "shift_reports"("status", "date");
CREATE INDEX "shift_reports_responsible_id_idx" ON "shift_reports"("responsible_id");
CREATE INDEX "shift_report_revisions_report_id_created_at_idx" ON "shift_report_revisions"("report_id", "created_at");
CREATE UNIQUE INDEX "shift_report_products_name_key" ON "shift_report_products"("name");
CREATE INDEX "shift_report_products_active_name_idx" ON "shift_report_products"("active", "name");

ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_report_revisions" ADD CONSTRAINT "shift_report_revisions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "shift_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_report_revisions" ADD CONSTRAINT "shift_report_revisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
