import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { loadResultBonusState, saveResultBonusState } from "../lib/result-bonus-data";
import { blankResultBonusState, defaultResultBonusRules } from "../lib/result-bonus";

test("salvataggio e rilettura regole/premi; il nuovo mese eredita solo regole e livelli", async () => {
  const records = new Map<string, unknown>();
  // In-memory database adapter: never writes to staff or payroll data.
  const tx = { setting: {
    findUnique: async ({ where }: { where: { key: string } }) => records.has(where.key) ? { value: records.get(where.key) } : null,
    findFirst: async ({ where }: { where: { key: { startsWith: string; lt?: string; lte?: string } } }) => {
      const key = [...records.keys()].filter((key) => key.startsWith(where.key.startsWith) && key < (where.key.lt ?? where.key.lte ?? "")).sort().at(-1);
      return key ? { value: records.get(key) } : null;
    },
    upsert: async ({ where, update }: { where: { key: string }; update: { value: unknown } }) => {
      records.set(where.key, JSON.parse(JSON.stringify(update.value))); return {};
    },
  } } as unknown as Prisma.TransactionClient;
  const state = blankResultBonusState({ a: { userId: "a", level: "MASTER" } });
  state.rules = defaultResultBonusRules();
  state.dailyValues = { JUNIOR: 4, AUTONOMA: 8.5, MASTER: null };
  state.rules.LATE_ENTRY = { mode: "AMOUNT", amount: -5.5 };
  state.rules.TABLE_PREVIOUS_STAFF = { mode: "AMOUNT", amount: -10 };
  state.events.push({ id: "award", userId: "a", date: "2026-09-29", type: "PERSONAL_BONUS", amount: 25, evidence: "Risultato", actorId: "admin", actorName: "Direzione", createdAt: "2026-09-29T10:00:00Z" });
  await saveResultBonusState("2026-09", state, tx);
  const saved = await loadResultBonusState("2026-09", tx);
  assert.deepEqual(saved.rules, state.rules);
  assert.deepEqual(saved.dailyValues, state.dailyValues);
  assert.equal(saved.events[0].amount, 25);
  const next = await loadResultBonusState("2026-10", tx);
  assert.deepEqual(next.rules, state.rules);
  assert.deepEqual(next.dailyValues, state.dailyValues);
  assert.deepEqual(next.configs, state.configs);
  assert.equal(next.events.length, 0);
  next.rules!.LATE_ENTRY.amount = -20;
  next.dailyValues!.JUNIOR = 6;
  assert.equal((await loadResultBonusState("2026-09", tx)).dailyValues!.JUNIOR, 4);
  assert.equal((await loadResultBonusState("2026-09", tx)).rules!.LATE_ENTRY.amount, -5.5);
});
