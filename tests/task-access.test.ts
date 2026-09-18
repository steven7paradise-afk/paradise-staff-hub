import assert from "node:assert/strict";
import test from "node:test";
import { canViewAllTasks, hasTaskAccess, taskEscalationRecipientWhere, taskMentionSlug, taskParticipantWhere, taskWorkerWhere } from "../lib/task-access";

test("i Super Admin sono disponibili tra gli assegnatari delle task", () => {
  const where = taskWorkerWhere();

  assert.deepEqual(where.role, { not: "ZERO" });
  assert.equal(where.active, true);
  assert.deepEqual(where.employee_status, { not: "Ex dipendente" });
});

test("tutto lo staff attivo può essere scelto come destinatario", () => {
  const where = taskWorkerWhere();

  assert.equal(where.OR, undefined);
  assert.deepEqual(where.role, { not: "ZERO" });
});

test("ogni ruolo attivo può aprire la pagina Task", () => {
  assert.equal(hasTaskAccess("MAGAZZINO"), true);
  assert.equal(hasTaskAccess("DIPENDENTE"), true);
});

test("solo responsabili, amministrazione e ufficio vedono tutte le task", () => {
  assert.equal(canViewAllTasks("RESPONSABILE"), true);
  assert.equal(canViewAllTasks("DIPENDENTE", "Parrucchiere", "Buenos Aires"), false);
  assert.equal(canViewAllTasks("DIPENDENTE", "Ufficio ordini", "Ufficio"), true);
});

test("il personale di salone vede task proprie, assegnate, commentate o menzionate", () => {
  assert.equal(taskMentionSlug("Steven Álvarez"), "steven_alvarez");
  const where = taskParticipantWhere("staff-1", "Steven Álvarez");

  assert.equal(where.OR?.length, 3);
  assert.deepEqual(where.OR?.[0], { created_by_id: "staff-1" });
  assert.deepEqual(where.OR?.[1], { assignees: { some: { id: "staff-1" } } });
  assert.deepEqual(where.OR?.[2], {
    comments: {
      some: {
        OR: [
          { user_id: "staff-1" },
          { message: { contains: "@steven_alvarez", mode: "insensitive" } },
        ],
      },
    },
  });
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
