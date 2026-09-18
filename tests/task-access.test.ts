import assert from "node:assert/strict";
import test from "node:test";
import { taskEscalationRecipientWhere, taskWorkerWhere } from "../lib/task-access";

test("i Super Admin sono disponibili tra gli assegnatari delle task", () => {
  const where = taskWorkerWhere();

  assert.deepEqual(where.role, { not: "ZERO" });
  assert.equal(
    where.OR?.some((condition) => "role" in condition && condition.role === "SUPER_ADMIN"),
    true,
  );
});

test("il responsabile salone può assegnare task anche all'ufficio", () => {
  const where = taskEscalationRecipientWhere("salone-buenos-aires");

  assert.equal(where.active, true);
  assert.equal(
    where.OR?.some((condition) => "mansione" in condition && Boolean(condition.mansione)),
    true,
  );
  assert.equal(
    where.OR?.some((condition) => "location" in condition && Boolean(condition.location)),
    true,
  );
  assert.equal(
    where.OR?.some((condition) => "role" in condition && condition.role === "RESPONSABILE" && condition.sede_id === "salone-buenos-aires"),
    true,
  );
});
