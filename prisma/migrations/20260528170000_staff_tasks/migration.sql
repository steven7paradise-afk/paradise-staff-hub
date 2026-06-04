CREATE TABLE "staff_tasks" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'MEDIA',
  "location_id" TEXT NOT NULL,
  "assigned_to_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "due_date" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_tasks_location_id_idx" ON "staff_tasks"("location_id");
CREATE INDEX "staff_tasks_assigned_to_id_idx" ON "staff_tasks"("assigned_to_id");
CREATE INDEX "staff_tasks_status_idx" ON "staff_tasks"("status");

ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
