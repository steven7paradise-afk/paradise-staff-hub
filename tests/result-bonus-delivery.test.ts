import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { publicDailyBonus, saveDailyBonusPublication } from "../lib/result-bonus-delivery";
import { resultBonusDailyAmounts } from "../lib/result-bonus";

test("lo staff riceve soltanto data e importo, senza punti, regole e penalità", () => {
  assert.deepEqual(publicDailyBonus({ date: "2026-09-29", amount: 24, points: -5, reasons: ["Ritardo"], rules: {}, exitId: "private" }), { date: "2026-09-29", amount: 24 });
  assert.equal(publicDailyBonus({ date: "2026-09-29", amount: -1 }), null);
});

test("il premio giornaliero include +4 e -5 punti, senza erodere i giorni precedenti", () => {
  const days = [{ date: "2026-09-28", state: "CONFORMING" as const, reasons: [] }, { date: "2026-09-29", state: "ADJUSTED" as const, reasons: [] }];
  const extras = [{ id: "a", date: "2026-09-29", label: "Premio", amount: 4, source: "test" }, { id: "b", date: "2026-09-29", label: "Ritardo", amount: -5, source: "test" }];
  assert.deepEqual(resultBonusDailyAmounts(days, extras, 20, 500, false), { "2026-09-28": 20, "2026-09-29": 19 });
  assert.deepEqual(resultBonusDailyAmounts(days, [{ ...extras[0], amount: -100 }], 20, 500, false), { "2026-09-28": 20, "2026-09-29": 0 });
  assert.deepEqual(resultBonusDailyAmounts(days, extras, 20, 25, false), { "2026-09-28": 20, "2026-09-29": 5 });
});

test("uscita ripetuta non duplica notifiche; una nuova uscita aggiorna la stessa giornata", async () => {
  let stored: unknown;
  const notifications = new Map<string, { message: string }>();
  const tx = { setting: {
    findUnique: async () => stored ? { value: stored } : null,
    upsert: async ({ update }: { update: { value: unknown } }) => { stored = update.value; },
  }, notification: { upsert: async ({ where, create }: { where: { id: string }; create: { message: string } }) => { notifications.set(where.id, create); } } } as unknown as Prisma.TransactionClient;
  const input = { userId: "a", date: "2026-09-29", amount: 19, exitId: "exit1", exitTime: "2026-09-29T17:00:00Z" };
  assert.equal(await saveDailyBonusPublication(tx, input), true);
  assert.equal(await saveDailyBonusPublication(tx, input), false);
  assert.equal(await saveDailyBonusPublication(tx, { ...input, exitId: "old", exitTime: "2026-09-29T16:00:00Z" }), false);
  assert.equal(await saveDailyBonusPublication(tx, { ...input, exitId: "exit2", exitTime: "2026-09-29T18:00:00Z", amount: 23 }), true);
  assert.equal(notifications.size, 1);
  assert.match([...notifications.values()][0].message, /23 punti/);
  assert.doesNotMatch([...notifications.values()][0].message, /€|euro|guadagnato|ritardo|penalità/i);
});
