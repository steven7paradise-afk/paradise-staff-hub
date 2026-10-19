import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { loadOffice } from "../lib/mcp/data";
function patch(t: any, target: any, key: string, fn: (...args: any[]) => any) { const old = target[key]; target[key] = t.mock.fn(fn); t.after(() => { target[key] = old; }); return target[key]; }
test("operational projection excludes private data and does not write business records", async t => {
  const users = patch(t, prisma.user, "findMany", async (args) => { assert.deepEqual(Object.keys(args.select).sort(), ["id", "name"]); return [{ id: "a", name: "Test", fiscal_code: "PRIVATE_SENTINEL", iban: "PRIVATE_SENTINEL" }]; });
  patch(t, prisma.setting, "findUnique", async () => ({ value: { employees: [{ employee_id: "a", department_key: "ecom", public_role: "Operatore" }], departments: [{ key: "ecom", capacity: 2, lead_employee_id: "a" }], task_texts: [] } }));
  patch(t, prisma.attendanceLog, "findMany", async (args) => { assert.deepEqual(Object.keys(args.select).sort(), ["timestamp", "type", "user_id"]); return []; });
  patch(t, prisma.staffTask, "findMany", async (args) => { for (const field of ["title", "description", "notes", "completion_note", "attachment_url"]) assert.equal(args.select[field], undefined); return [{ id: "task", title: "PRIVATE_SENTINEL", description: "PRIVATE_SENTINEL", status: "ACTIVE", priority: "MEDIA", started_at: new Date("2026-10-19T07:00:00Z"), due_date: new Date("2026-10-18T12:00:00Z"), created_at: new Date("2026-10-18T12:00:00Z"), completed_at: null, created_by_id: "not-published", assignees: [{ id: "a" }, { id: "not-published" }] }]; });
  for (const model of [prisma.user, prisma.staffTask, prisma.attendanceLog, prisma.setting]) for (const method of ["create", "update", "delete", "upsert"]) patch(t, model, method, () => { throw Error("Operational write forbidden"); });
  const d = await loadOffice(new Date("2026-10-19T10:00:00Z"));
  assert.equal(JSON.stringify(d).includes("PRIVATE_SENTINEL"), false);
  assert.equal(d.employees[0].overdue_tasks_count, 1); assert.equal(d.employees[0].current_task?.title, "Attività operativa");
  assert.equal(d.tasks[0].assigned_by, null); assert.deepEqual(d.tasks[0].assignee_ids, ["a"]);
  assert.equal(d.employees[0].status, "non_timbrato"); assert.equal(d.departments[0].free_seats, 2); assert.equal(d.departments[1].free_seats, null);
  assert.equal(d.projects.length, 0); assert.equal(d.history("a").length, 7); assert.equal(users.mock.callCount(), 1);
});
