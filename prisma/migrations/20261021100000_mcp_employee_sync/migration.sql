ALTER TABLE "User" ADD COLUMN "department_key" TEXT;
ALTER TABLE "User" ADD COLUMN "mcp_excluded" BOOLEAN NOT NULL DEFAULT false;
-- Preserve previously approved operational departments. Inclusion is now opt-out.
UPDATE "User" AS u SET "department_key" = e->>'department_key'
FROM "Setting" s, jsonb_array_elements(s."value"->'employees') e
WHERE s."key" = 'mcp_office_config_v1' AND u."id" = e->>'employee_id';
ALTER TABLE "User" ADD CONSTRAINT "User_department_key_check" CHECK ("department_key" IS NULL OR "department_key" IN ('ecom','mkt','admin','ceo','tit','mag','sarta','saloni'));
CREATE INDEX "User_mcp_roster_idx" ON "User" ("active", "mcp_excluded", "department_key");
