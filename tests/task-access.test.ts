import assert from "node:assert/strict";
import test from "node:test";
import { taskWorkerWhere } from "../lib/task-access";

test("i Super Admin sono disponibili tra gli assegnatari delle task", () => {
  const where = taskWorkerWhere();

  assert.deepEqual(where.role, { not: "ZERO" });
  assert.equal(
    where.OR?.some((condition) => "role" in condition && condition.role === "SUPER_ADMIN"),
    true,
  );
});
