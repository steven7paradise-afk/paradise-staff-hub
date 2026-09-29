import assert from "node:assert/strict";
import test from "node:test";
import { blankResultBonusState, defaultResultBonusDailyValues, defaultResultBonusRules } from "../lib/result-bonus";
import { mergeResultBonusSettings, ResultBonusSettingsConflict } from "../lib/result-bonus-settings-merge";
import { loadResultBonusState, saveResultBonusState } from "../lib/result-bonus-data";
import type { Prisma } from "@prisma/client";

function fixture() {
  const state = { ...blankResultBonusState(), revision: 5, rules: defaultResultBonusRules(), dailyValues: defaultResultBonusDailyValues() };
  const body = { revision: 5, rules: structuredClone(state.rules), dailyValues: structuredClone(state.dailyValues), baseRules: structuredClone(state.rules), baseDailyValues: structuredClone(state.dailyValues) };
  body.rules.EXTRA_APPOINTMENT = { mode: "AMOUNT", amount: 2 };
  return { state, body };
}
test("salva la modifica anche quando cambiano livelli o altri dati del mese", () => {
  const { state, body } = fixture();
  state.revision = 9;
  const result = mergeResultBonusSettings(state, body);
  assert.equal(result.rules.EXTRA_APPOINTMENT.amount, 2);
  assert.equal(state.rules.EXTRA_APPOINTMENT.amount, 5);
});
test("mantiene le modifiche altrui su voci diverse", () => {
  const { state, body } = fixture();
  state.revision++;
  state.rules.LATE_ENTRY = { mode: "AMOUNT", amount: -3 };
  state.dailyValues.MASTER = 12;
  body.dailyValues.JUNIOR = 4;
  const result = mergeResultBonusSettings(state, body);
  assert.equal(result.rules.EXTRA_APPOINTMENT.amount, 2);
  assert.equal(result.rules.LATE_ENTRY.amount, -3);
  assert.equal(result.dailyValues.MASTER, 12);
  assert.equal(result.dailyValues.JUNIOR, 4);
});
test("non sovrascrive la stessa dinamica cambiata da un altro operatore", () => {
  const { state, body } = fixture();
  state.revision++;
  state.rules.EXTRA_APPOINTMENT.amount = 8;
  assert.throws(() => mergeResultBonusSettings(state, body), /Appuntamento oltre il quinto/);
  assert.equal(state.rules.EXTRA_APPOINTMENT.amount, 8);
});
test("non sovrascrive lo stesso valore giornaliero", () => {
  const { state, body } = fixture();
  state.revision++;
  state.dailyValues.JUNIOR = 8;
  body.dailyValues.JUNIOR = 4;
  assert.throws(() => mergeResultBonusSettings(state, body), /Valore giornata Junior/);
});
test("accetta un retry già salvato e blocca revisioni invalide o vecchi client senza base", () => {
  const { state, body } = fixture();
  state.revision++;
  state.rules.EXTRA_APPOINTMENT.amount = 2;
  assert.equal(mergeResultBonusSettings(state, body).rules.EXTRA_APPOINTMENT.amount, 2);
  assert.throws(() => mergeResultBonusSettings(state, { ...body, baseRules: undefined }), ResultBonusSettingsConflict);
  for (const revision of [-1, 100, NaN]) assert.throws(() => mergeResultBonusSettings(state, { ...body, revision }), ResultBonusSettingsConflict);
  assert.throws(() => mergeResultBonusSettings(state, { ...body, rules: { ...body.rules, LATE_ENTRY: { mode: "AMOUNT", amount: null } } }));
});
test("salvataggi consecutivi e rilettura conservano i valori uniti e la revisione reale", async () => {
  const { state, body } = fixture();
  state.revision = 10;
  state.configs.a = { userId: "a", level: "MASTER" };
  let stored: unknown;
  const db = { setting: {
    upsert: async ({ update }: { update: { value: unknown } }) => { stored = structuredClone(update.value); },
    findUnique: async () => ({ value: stored }),
  } } as unknown as Prisma.TransactionClient;
  Object.assign(state, mergeResultBonusSettings(state, body));
  state.revision++;
  await saveResultBonusState("2026-09", state, db);
  const saved = await loadResultBonusState("2026-09", db);
  assert.equal(saved.revision, 11);
  assert.equal(saved.rules!.EXTRA_APPOINTMENT.amount, 2);
  assert.equal(saved.configs.a.level, "MASTER");
  const next = { revision: saved.revision, rules: structuredClone(saved.rules), dailyValues: saved.dailyValues, baseRules: saved.rules, baseDailyValues: saved.dailyValues };
  next.rules!.EXTRA_APPOINTMENT.amount = 3;
  Object.assign(saved, mergeResultBonusSettings(saved, next));
  saved.revision++;
  await saveResultBonusState("2026-09", saved, db);
  assert.equal((await loadResultBonusState("2026-09", db)).rules!.EXTRA_APPOINTMENT.amount, 3);
});
