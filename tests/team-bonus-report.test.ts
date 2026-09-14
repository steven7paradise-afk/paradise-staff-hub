import assert from "node:assert/strict";
import test from "node:test";

import { previousPayrollMonth, scoreTeamBonusWorkers, type TeamBonusWorker } from "../lib/team-bonus-report";

function worker(overrides: Partial<TeamBonusWorker> = {}): TeamBonusWorker {
  return {
    name: "Collaboratore Test",
    role: "Parrucchiera",
    location: "Salone Buenos Aires",
    days: 10,
    scheduledDays: 10,
    hours: 80,
    clients: 20,
    photos: 10,
    products: 10,
    reviews: 2,
    lateDays: 0,
    lateMinutes: 0,
    lateReturns: 0,
    lateReturnMinutes: 0,
    unjustifiedAbsences: 0,
    completedTasks: 1,
    ...overrides,
  };
}

test("a settembre apre automaticamente il report di agosto", () => {
  assert.deepEqual(previousPayrollMonth(new Date(2026, 8, 14)), { monthIndex: 7, year: 2026 });
});

test("gestisce correttamente il passaggio da gennaio a dicembre", () => {
  assert.deepEqual(previousPayrollMonth(new Date(2027, 0, 4)), { monthIndex: 11, year: 2026 });
});

test("consiglia il bonus al profilo con risultati completi e senza ritardi", () => {
  const [result] = scoreTeamBonusWorkers([worker({ clients: 30, photos: 24, products: 28, reviews: 6, completedTasks: 2 })]);
  assert.equal(result.status, "BONUS_CONSIGLIATO");
  assert.equal(result.comparable, true);
});

test("non classifica nuovi ingressi o ruoli non commerciali con pochi dati", () => {
  const results = scoreTeamBonusWorkers([
    worker({ name: "Nuova Persona", days: 1, scheduledDays: 1, clients: 1 }),
    worker({ name: "Reception", role: "Receptionist", clients: 10 }),
  ]);
  assert.ok(results.every((result) => result.status === "DATI_INSUFFICIENTI" && !result.comparable));
});
