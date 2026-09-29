import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buildResultBonusData } from "../lib/result-bonus-data";
import { blankResultBonusState, calculateResultBonus, defaultResultBonusRules, resultBonusDailyLosses, type ResultBonusDay } from "../lib/result-bonus";

test("senza ingresso non matura la giornata, qualunque sia la regola assenza", async () => {
  const state = blankResultBonusState({ a: { userId: "a", level: "JUNIOR" } });
  state.rules = defaultResultBonusRules();
  state.rules.ZERO_REWORK = { mode: "TRACK_ONLY", amount: 0 };
  const schedule = { user_id: "a", date: new Date("2026-09-15"), location_id: "salon", start_time: "10:00", category: { code: "WORK", name: "Lavoro", start_time: "10:00" } };
  let logs: Array<{ user_id: string; date: Date; timestamp: Date; type: string }> = [];
  let leaves: Array<{ user_id: string; start_date: Date; end_date: Date; type: string }> = [];
  const db = {
    user: { findMany: async () => [{ id: "a", name: "Test", active: true, role: "DIPENDENTE", sede_id: "salon", location: { name: "Buenos Aires" }, mansione: "Parrucchiera", photo_url: null }] },
    setting: { findUnique: async ({ where }: { where: { key: string } }) => where.key === "result_bonus:2026-09" ? { value: state } : null, findMany: async () => [] },
    scheduleEntry: { findMany: async () => [schedule] },
    attendanceLog: { findMany: async () => logs },
    leaveRequest: { findMany: async () => leaves },
    document: { findMany: async () => [] }, serviceFormResponse: { findMany: async () => [] },
  } as unknown as PrismaClient;
  const load = async () => (await buildResultBonusData({ id: "admin", name: "Direzione", role: "ADMIN", active: true }, "2026-09", false, db)).people[0];
  for (const mode of ["ZERO_DAY", "AMOUNT", "TRACK_ONLY"] as const) {
    state.rules.ABSENCE = { mode, amount: -3 };
    const report = await load();
    assert.equal(report.days[0].state, "ZERO");
    assert.equal(report.calculation.conformingDays, 0);
    assert.equal(report.calculation.dayAmount, 0);
    assert.equal(report.calculation.exactAmount, 0);
  }
  logs = [{ user_id: "a", date: schedule.date, timestamp: new Date("2026-09-15T08:00:00Z"), type: "USCITA" }];
  assert.equal((await load()).days[0].state, "ZERO");
  state.disputes.push({ id: "d", userId: "a", targetId: "day:a:2026-09-15", targetDate: "2026-09-15", reason: "Correzione", status: "ACCEPTED", createdAt: "2026-09-16" });
  assert.equal((await load()).days[0].state, "ZERO");
  logs[0].type = "ENTRATA";
  assert.equal((await load()).days[0].state, "CONFORMING");
  leaves = [{ user_id: "a", start_date: schedule.date, end_date: schedule.date, type: "FERIE" }];
  assert.equal((await load()).days[0].state, "NEUTRAL");
  assert.equal((await load()).calculation.dayAmount, 0);
  leaves = [];
  for (const [code, name] of [["R", "Riposo"], ["F", "Ferie"], ["M", "Malattia"], ["AI", "Assenza"]]) {
    schedule.category = { ...schedule.category, code, name };
    const report = await load();
    assert.deepEqual(report.days, []);
    assert.equal(report.calculation.conformingDays, 0);
    assert.equal(report.calculation.dayAmount, 0);
  }
});

test("riepilogo giornaliero distingue guadagno netto e perdita senza penalizzare riposi o tetto", () => {
  const days: ResultBonusDay[] = [
    { date: "2026-09-01", state: "ADJUSTED", reasons: [] },
    { date: "2026-09-02", state: "ZERO", reasons: [] },
    { date: "2026-09-03", state: "NEUTRAL", reasons: [] },
    { date: "2026-09-04", state: "PENDING", reasons: [] },
    { date: "2026-09-05", state: "ADJUSTED", reasons: [] },
  ];
  const extras = [
    { id: "a", date: "2026-09-01", amount: -3, label: "Ritardo", source: "Presenze" },
    { id: "b", date: "2026-09-01", amount: 4, label: "Premio", source: "Direzione" },
    { id: "c", date: "2026-09-02", amount: -3, label: "Assenza", source: "Presenze" },
    { id: "d", date: "2026-09-05", amount: -50, label: "Penalità", source: "Direzione" },
  ];
  const losses = resultBonusDailyLosses(days, extras, 10);
  assert.deepEqual(Object.values(losses), [3, 10, 0, 0, 10]);
  const calculation = calculateResultBonus({ level: "JUNIOR", dailyValues: { JUNIOR: 10, AUTONOMA: null, MASTER: null }, days, extras, disciplinaryLetter: false, finalized: false });
  assert.equal(calculation.dailyAmounts["2026-09-01"], 11);
  assert.equal(calculation.dailyAmounts["2026-09-02"], 0);
  assert.deepEqual(calculation.dailyLosses, losses);
  const capped = calculateResultBonus({ level: "JUNIOR", dailyValues: { JUNIOR: 200, AUTONOMA: null, MASTER: null }, days: days.map((d) => ({ ...d, state: "CONFORMING" })), extras: [], disciplinaryLetter: false, finalized: false });
  assert.equal(capped.dailyAmounts["2026-09-02"], 0);
  assert.equal(capped.dailyLosses["2026-09-02"], 0);
});
