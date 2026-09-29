import assert from "node:assert/strict";
import test from "node:test";
import { resultBonusAppearanceEvents } from "../lib/result-bonus-appearance";
import { buildResultBonusData } from "../lib/result-bonus-data";
import { blankResultBonusState, defaultResultBonusRules } from "../lib/result-bonus";
import type { PrismaClient } from "@prisma/client";

const question = { id: "appearance", title: "PRESENTABILITÀ STAFF", answerType: "STAFF_CHECKLIST", staffResponseMode: "YES_NO", options: ["Divisa", "Capelli"] };
const answer = (responses: Record<string, unknown>, staffId = "a") => JSON.stringify({ staffChecks: [{ staffId, name: "Nome non usato per attribuire", responses }] });
const collect = (answers: unknown, questions: unknown = [question]) => resultBonusAppearanceEvents(questions, answers, "2026-09", "2026-09-29", ["a"]);

test("due No contano una sola non conformità per persona/giorno con tutti i motivi", () => {
  const events = collect({ "2026-09-15": { appearance: answer({ Divisa: "NO", Capelli: "NO" }) } });
  assert.equal(events.length, 1);
  assert.equal(events[0].userId, "a");
  assert.equal(events[0].date, "2026-09-15");
  assert.match(events[0].evidence, /Divisa; Capelli/);
});
test("non penalizza Sì, mancate risposte, caselle vuote, note, staff estraneo o date future", () => {
  for (const responses of [{ Divisa: "YES" }, {}, { Divisa: "UNCHECKED" }, { Divisa: false }, { Divisa: "" }, { Altro: "NO" }]) {
    assert.deepEqual(collect({ "2026-09-15": { appearance: answer(responses) } }), []);
  }
  assert.deepEqual(collect({ "2026-09-15": { appearance: answer({ Divisa: "NO" }, "other") }, "2026-09-30": { appearance: answer({ Divisa: "NO" }) }, "2026-08-15": { appearance: answer({ Divisa: "NO" }) } }), []);
  for (const raw of ["NO", "Testo libero", "null", "[]", "{}", '{"staffChecks":[null,{},false]}']) assert.deepEqual(collect({ "2026-09-15": { appearance: raw } }), []);
});
test("caselle legacy non diventano No e altre checklist non producono presentabilità", () => {
  const answers = { "2026-09-15": { appearance: answer({ Divisa: "NO" }) } };
  assert.deepEqual(collect(answers, [{ ...question, staffResponseMode: "CHECKBOXES" }]), []);
  assert.deepEqual(collect(answers, [{ ...question, title: "Controllo pause" }]), []);
  assert.deepEqual(collect(answers, [{ ...question, answerType: "TEXT" }]), []);
});
test("rilettura delle risposte corrette rimuove il No senza lasciare eventi persistenti", () => {
  const answers = { "2026-09-15": { appearance: answer({ Divisa: "NO" }) } };
  assert.equal(collect(answers).length, 1);
  answers["2026-09-15"].appearance = answer({ Divisa: "YES", Capelli: "YES" });
  assert.deepEqual(collect(answers), []);
});
test("la modalità salvata resta valida anche dopo modifiche alla domanda", () => {
  const payload = JSON.parse(answer({ Divisa: "NO" }));
  assert.equal(collect({ "2026-09-15": { appearance: JSON.stringify({ ...payload, staffResponseMode: "YES_NO" }) } }, [{ ...question, staffResponseMode: "CHECKBOXES" }]).length, 1);
  assert.equal(collect({ "2026-09-15": { appearance: JSON.stringify({ ...payload, staffResponseMode: "CHECKBOXES" }) } }).length, 0);
});

test("il report applica la regola salvata una sola volta, corregge il saldo e rispetta le contestazioni", async () => {
  // All database methods are replaced by in-memory fixtures; no payroll writes.
  const state = blankResultBonusState({ a: { userId: "a", level: "JUNIOR" } });
  state.rules = defaultResultBonusRules();
  state.rules.APPEARANCE = { mode: "AMOUNT", amount: -4 };
  state.rules.ZERO_REWORK = { mode: "TRACK_ONLY", amount: 0 };
  const answers = { "2026-09-15": { appearance: answer({ Divisa: "NO", Capelli: "NO" }) } };
  const person = { id: "a", name: "Angelica Test", active: true, role: "DIPENDENTE", sede_id: "salon", location: { name: "Buenos Aires" }, mansione: "Parrucchiera", photo_url: null };
  const db = {
    user: { findMany: async () => [person] },
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) => where.key === "result_bonus:2026-09" ? { value: state } : null,
      findMany: async ({ where }: { where: { key: { in?: string[] } } }) => where.key.in ? [{ key: "shift_responsible_questions", value: [question] }, { key: "shift_responsible_answers", value: answers }] : [],
    },
    scheduleEntry: { findMany: async () => [{ user_id: "a", date: new Date("2026-09-15"), location_id: "salon", start_time: "10:00", category: { code: "WORK", name: "Lavoro", start_time: "10:00" } }] },
    attendanceLog: { findMany: async () => [{ user_id: "a", date: new Date("2026-09-15"), timestamp: new Date("2026-09-15T08:00:00Z"), type: "ENTRATA" }] },
    leaveRequest: { findMany: async () => [] }, document: { findMany: async () => [] }, serviceFormResponse: { findMany: async () => [] },
  } as unknown as PrismaClient;
  const load = async () => (await buildResultBonusData({ id: "admin", name: "Direzione", role: "ADMIN", active: true }, "2026-09", false, db)).people[0];
  let report = await load();
  assert.equal(report.extras.length, 1);
  assert.equal(report.extras[0].amount, -4);
  assert.equal(report.days[0].state, "ADJUSTED");
  assert.equal(report.calculation.exactAmount, 196);
  assert.match(report.extras[0].label, /Divisa; Capelli/);
  state.events.push({ id: "manual", userId: "a", date: "2026-09-15", type: "APPEARANCE", evidence: "Richiamo", actorId: "admin", actorName: "Direzione", createdAt: "2026-09-15T12:00:00Z" });
  assert.equal((await load()).extras.length, 1);
  state.events = [];
  state.rules.APPEARANCE = { mode: "ZERO_DAY", amount: 0 };
  report = await load();
  assert.equal(report.days[0].state, "ZERO");
  assert.equal(report.calculation.exactAmount, 0);
  state.rules.APPEARANCE = { mode: "TRACK_ONLY", amount: 0 };
  report = await load();
  assert.equal(report.extras.length, 0);
  assert.equal(report.calculation.exactAmount, 200);
  assert.equal(report.timeline.filter((item) => item.kind === "TRACK_ONLY").length, 1);
  state.rules.APPEARANCE = { mode: "AMOUNT", amount: -4 };
  state.disputes.push({ id: "d", userId: "a", targetId: "day:a:2026-09-15", targetDate: "2026-09-15", reason: "Correzione", status: "ACCEPTED", createdAt: "2026-09-16" });
  assert.equal((await load()).extras.length, 0);
  state.disputes = [];
  answers["2026-09-15"].appearance = answer({ Divisa: "YES", Capelli: "YES" });
  report = await load();
  assert.equal(report.extras.length, 0);
  assert.equal(report.days[0].state, "CONFORMING");
  assert.equal(report.calculation.exactAmount, 200);
});
