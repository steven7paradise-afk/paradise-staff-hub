CREATE TABLE "end_of_day_checklists" (
    "id" TEXT NOT NULL,
    "operational_date" TIMESTAMP(3) NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "counts" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "confirmations" JSONB NOT NULL,
    "confirmation_notes" JSONB NOT NULL,
    "notes" TEXT,
    "operator_one_name" TEXT NOT NULL,
    "operator_two_name" TEXT NOT NULL,
    "manager_name" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "end_of_day_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "end_of_day_checklist_comments" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "end_of_day_checklist_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "end_of_day_checklists_operational_date_key" ON "end_of_day_checklists"("operational_date");
CREATE INDEX "end_of_day_checklists_submitted_at_idx" ON "end_of_day_checklists"("submitted_at");
CREATE INDEX "end_of_day_checklist_comments_checklist_id_created_at_idx" ON "end_of_day_checklist_comments"("checklist_id", "created_at");
CREATE INDEX "end_of_day_checklist_comments_author_id_idx" ON "end_of_day_checklist_comments"("author_id");

ALTER TABLE "end_of_day_checklists" ADD CONSTRAINT "end_of_day_checklists_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_of_day_checklist_comments" ADD CONSTRAINT "end_of_day_checklist_comments_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "end_of_day_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_of_day_checklist_comments" ADD CONSTRAINT "end_of_day_checklist_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
