ALTER TABLE "leave_requests"
ADD COLUMN "employee_response" TEXT,
ADD COLUMN "employee_acknowledged_at" TIMESTAMP(3);
