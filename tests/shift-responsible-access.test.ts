import assert from "node:assert/strict";
import test from "node:test";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess } from "../lib/shift-responsible-access";

test("il responsabile assegnato scrive soltanto dopo la presa visione", () => {
  const day = emptyShiftAccessDay();
  assert.equal(hasShiftWriteAccess(day, "responsabile", "responsabile"), false);
  day.acknowledgements.responsabile = { at: "2026-09-03T08:00:00.000Z", clockIn: "10:00", shiftStatus: "In turno" };
  assert.equal(hasShiftWriteAccess(day, "responsabile", "responsabile"), true);
});

test("un altro responsabile deve avere permesso e presa visione", () => {
  const day = emptyShiftAccessDay();
  day.permissions.altro = { status: "APPROVED", requestedAt: "2026-09-03T08:00:00.000Z" };
  assert.equal(hasShiftWriteAccess(day, "altro", "responsabile"), false);
  day.acknowledgements.altro = { at: "2026-09-03T08:05:00.000Z", clockIn: null, shiftStatus: "Non timbrato" };
  assert.equal(hasShiftWriteAccess(day, "altro", "responsabile"), true);
  day.permissions.altro.status = "DENIED";
  assert.equal(hasShiftWriteAccess(day, "altro", "responsabile"), false);
});

test("normalizza presa visione, permessi e firme salvati", () => {
  const access = normalizeShiftResponsibleAccess({
    "2026-09-03": {
      acknowledgements: { u1: { at: "2026-09-03T08:00:00.000Z", clockIn: "10:00", shiftStatus: "In turno" } },
      permissions: { u2: { status: "APPROVED", requestedAt: "2026-09-03T08:01:00.000Z" } },
      audit: [{ id: "a1", questionId: "q1", actorId: "u2", actorName: "Laura", at: "2026-09-03T08:02:00.000Z", action: "ANSWER", previousValue: "NO", nextValue: "YES" }],
    },
  });
  assert.equal(access["2026-09-03"].acknowledgements.u1.clockIn, "10:00");
  assert.equal(access["2026-09-03"].permissions.u2.status, "APPROVED");
  assert.equal(access["2026-09-03"].audit[0].actorName, "Laura");
  assert.equal(access["2026-09-03"].audit[0].previousValue, "NO");
  assert.equal(access["2026-09-03"].audit[0].nextValue, "YES");
});
