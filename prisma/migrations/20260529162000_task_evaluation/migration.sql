ALTER TABLE "staff_tasks"
ADD COLUMN "evaluation" TEXT,
ADD COLUMN "evaluated_by_id" TEXT,
ADD COLUMN "evaluated_at" TIMESTAMP(3);
