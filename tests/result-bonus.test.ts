import assert from "node:assert/strict";
import test from "node:test";
import { calculateResultBonus, defaultResultBonusDailyValues, parseResultBonusDailyValues, defaultResultBonusRules, parseResultBonusRules, resultBonusEventEffect, roundResultBonusUp, type ResultBonusDay } from "../lib/result-bonus";

const days = (conforming: number, zero = 0, neutral = 0): ResultBonusDay[] => [
  ...Array.from({ length: conforming }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, state: "CONFORMING" as const, reasons: [] })),
  ...Array.from({ length: zero }, (_, index) => ({ date: `2026-10-${String(conforming + index + 1).padStart(2, "0")}`, state: "ZERO" as const, reasons: ["Ritardo"] })),
  ...Array.from({ length: neutral }, (_, index) => ({ date: `2026-10-${String(conforming + zero + index + 1).padStart(2, "0")}`, state: "NEUTRAL" as const, reasons: ["Malattia"] })),
];

test("basi giornaliere distinte per livello, automatico compatibile e zero esplicito", () => {
  const dailyValues = parseResultBonusDailyValues({ JUNIOR: 4, AUTONOMA: 8.5, MASTER: 12 });
  const input = { days: days(2), extras: [], disciplinaryLetter: false, finalized: false, dailyValues };
  assert.equal(calculateResultBonus({ ...input, level: "JUNIOR" }).exactAmount, 8);
  assert.equal(calculateResultBonus({ ...input, level: "AUTONOMA" }).exactAmount, 17);
  assert.equal(calculateResultBonus({ ...input, level: "MASTER" }).exactAmount, 24);
  assert.equal(calculateResultBonus({ ...input, level: null }).dailyValue, 0);
  assert.equal(calculateResultBonus({ ...input, level: "MASTER", dailyValues: defaultResultBonusDailyValues() }).exactAmount, 500);
  assert.equal(calculateResultBonus({ ...input, level: "MASTER", dailyValues: { ...dailyValues, MASTER: 0 } }).exactAmount, 0);
});

test("base fissa: non accredita riposo/futuro, applica dinamiche e mantiene tetto e azzeramento", () => {
  const dailyValues = { JUNIOR: 10, AUTONOMA: null, MASTER: null };
  const input = { level: "JUNIOR" as const, dailyValues, days: [...days(1, 1, 1), { date: "2026-10-04", state: "PENDING" as const, reasons: [] }], extras: [{ id: "late", date: "2026-10-01", amount: -2, label: "Ritardo", source: "test" }], disciplinaryLetter: false, finalized: false };
  assert.equal(calculateResultBonus(input).exactAmount, 8);
  assert.equal(calculateResultBonus({ ...input, dailyValues: { ...dailyValues, JUNIOR: 1000 } }).exactAmount, 200);
  assert.equal(calculateResultBonus({ ...input, disciplinaryLetter: true }).exactAmount, 0);
});

test("i valori giornalieri rifiutano vuoti, negativi e precisione errata", () => {
  for (const amount of [undefined, "", "5", -1, Infinity, NaN, 0.001, 10001]) {
    assert.throws(() => parseResultBonusDailyValues({ JUNIOR: amount, AUTONOMA: null, MASTER: null }));
  }
  assert.throws(() => parseResultBonusDailyValues(null));
});

test("il mese perfetto raggiunge esattamente il tetto del livello", () => {
  const result = calculateResultBonus({ level: "MASTER", days: days(22), extras: [], disciplinaryLetter: false, finalized: false });
  assert.equal(result.dailyValue, 500 / 22);
  assert.equal(result.exactAmount, 500);
});

test("una giornata non conforme vale zero e non crea un saldo negativo", () => {
  const result = calculateResultBonus({ level: "MASTER", days: days(20, 2), extras: [], disciplinaryLetter: false, finalized: true });
  assert.equal(Math.round(result.exactAmount), 455);
  assert.equal(result.displayedAmount, 460);
});

test("i bonus recuperano giornate perse senza superare il tetto", () => {
  const result = calculateResultBonus({ level: "MASTER", days: days(20, 2), extras: [{ id: "x", date: "2026-10-10", label: "Extra", amount: 45, source: "test" }], disciplinaryLetter: false, finalized: true });
  assert.equal(result.displayedAmount, 500);
});

test("le assenze giustificate sono neutrali e non abbassano il tetto raggiungibile", () => {
  const result = calculateResultBonus({ level: "AUTONOMA", days: days(20, 0, 2), extras: [], disciplinaryLetter: false, finalized: true });
  assert.equal(result.eligibleDays, 20);
  assert.equal(result.displayedAmount, 300);
});

test("la lettera di contestazione formale azzera l'intero mese", () => {
  const result = calculateResultBonus({ level: "MASTER", days: days(22), extras: [{ id: "x", date: "2026-10-10", label: "Extra", amount: 50, source: "test" }], disciplinaryLetter: true, finalized: true });
  assert.equal(result.displayedAmount, 0);
});

test("gli eventi manuali hanno effetti vincolati e mai importi negativi", () => {
  assert.deepEqual(resultBonusEventEffect("APPEARANCE", "MASTER"), { kind: "ZERO_DAY", amount: 0 });
  assert.deepEqual(resultBonusEventEffect("URGENT_AVAILABILITY", "MASTER"), { kind: "BONUS", amount: 5 });
  assert.deepEqual(resultBonusEventEffect("TRAINING", "MASTER"), { kind: "BONUS", amount: 0 });
  assert.equal(roundResultBonusUp(406, 500), 410);
});

test("le dinamiche configurate accettano valori positivi e negativi con centesimi", () => {
  const rules = defaultResultBonusRules();
  rules.APPEARANCE = { mode: "AMOUNT", amount: -12.5 };
  rules.POSITIVE_REVIEW = { mode: "AMOUNT", amount: 7.25 };
  const parsed = parseResultBonusRules(rules);
  assert.deepEqual(resultBonusEventEffect("APPEARANCE", "MASTER", parsed), { kind: "BONUS", amount: -12.5 });
  assert.deepEqual(resultBonusEventEffect("POSITIVE_REVIEW", "MASTER", parsed), { kind: "BONUS", amount: 7.25 });
  assert.deepEqual(resultBonusEventEffect("TRAINING", "MASTER", parsed), { kind: "BONUS", amount: 0 });
  assert.throws(() => parseResultBonusRules({ ...rules, LATE_ENTRY: { mode: "AMOUNT", amount: NaN } }));
  assert.throws(() => parseResultBonusRules({ ...rules, LATE_ENTRY: { mode: "AMOUNT", amount: "-5" } }));
  assert.throws(() => parseResultBonusRules({ ...rules, LATE_ENTRY: { mode: "AMOUNT", amount: 0.001 } }));
  assert.throws(() => parseResultBonusRules({ ...rules, TABLE_PREVIOUS_STAFF: { mode: "ZERO_DAY", amount: 0 } }));
});

test("ritardo a importo mantiene la base giornaliera ma non è una giornata conforme", () => {
  const result = calculateResultBonus({ level: "MASTER", days: [...days(19), { date: "2026-10-20", state: "ADJUSTED", reasons: ["Ritardo"] }], extras: [{ id: "late", date: "2026-10-20", label: "Ritardo", amount: -10, source: "test" }], disciplinaryLetter: false, finalized: false });
  assert.equal(result.conformingDays, 19);
  assert.equal(result.adjustedDays, 1);
  assert.equal(result.dayAmount, 500);
  assert.equal(result.exactAmount, 490);
});

test("variazioni e premio individuale restano tra zero e tetto senza alterare gli input", () => {
  const extra = { id: "manual", date: "2026-10-20", label: "Premio individuale", amount: 100, source: "Direzione" };
  const input = { level: "MASTER" as const, days: days(10, 10), extras: [extra], disciplinaryLetter: false, finalized: false };
  assert.equal(calculateResultBonus(input).exactAmount, 350);
  assert.equal(calculateResultBonus({ ...input, extras: [{ ...extra, amount: -1000 }] }).exactAmount, 250);
  assert.equal(calculateResultBonus({ ...input, extras: [{ ...extra, amount: 1000 }] }).exactAmount, 500);
  assert.equal(input.extras[0].amount, 100);
  assert.equal(calculateResultBonus({ ...input, level: null }).exactAmount, 0);
});
