import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { buildResultBonusData, isBuenosAiresActor } from "@/lib/result-bonus-data";
import { RESULT_BONUS_START_MONTH, validResultBonusMonth } from "@/lib/result-bonus";

const DAILY_PREFIX = "result_bonus_daily:";
export type PublishedDailyBonus = { date: string; amount: number };

export function publicDailyBonus(value: unknown): PublishedDailyBonus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || typeof raw.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount < 0) return null;
  // Explicit allowlist: no rules, points, deductions, other workers or explanations.
  return { date: raw.date, amount: raw.amount };
}

export async function loadPublishedDailyBonuses(userId: string, month: string) {
  validResultBonusMonth(month);
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: `${DAILY_PREFIX}${userId}:${month}-` } }, select: { value: true }, orderBy: { key: "desc" } });
  return rows.map((row) => publicDailyBonus(row.value)).filter((row): row is PublishedDailyBonus => Boolean(row));
}

export async function saveDailyBonusPublication(tx: Prisma.TransactionClient, input: { userId: string; date: string; amount: number; exitId: string; exitTime: string }) {
  const { userId, date, amount, exitId, exitTime } = input;
  const key = `${DAILY_PREFIX}${userId}:${date}`;
  const old = await tx.setting.findUnique({ where: { key }, select: { value: true } });
  const previous = old?.value as { exitId?: string; exitTime?: string } | undefined;
  if (previous?.exitId === exitId || (previous?.exitTime && previous.exitTime >= exitTime)) return false;
  const value = { date, amount, exitId, exitTime, publishedAt: new Date().toISOString() };
  await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  const money = amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const notification = { user_id: userId, title: "Il tuo guadagno della giornata", message: `Il ${day} hai guadagnato ${money}.`, type: "PREMIO_RISULTATO", action_url: "/notifications" };
  const notificationId = `result-bonus:${userId}:${date}`;
  await tx.notification.upsert({ where: { id: notificationId }, create: { id: notificationId, ...notification }, update: { ...notification, read: false } });
  return true;
}

/** Idempotent in-app notification, never WhatsApp and never exposing the scoring rules. */
export async function publishDailyResultBonus(exitId: string) {
  const exit = await prisma.attendanceLog.findUnique({ where: { id: exitId }, include: { user: { include: { location: true } } } });
  if (!exit || exit.type !== "USCITA" || !exit.user.active || !["DIPENDENTE", "RESPONSABILE"].includes(exit.user.role) || !isBuenosAiresActor(exit.user.location?.name)) return;
  const date = exit.date.toISOString().slice(0, 10);
  const month = date.slice(0, 7);
  if (month < RESULT_BONUS_START_MONTH) return;
  const data = await buildResultBonusData(exit.user, month, true);
  const person = data.people.find((person) => person.id === exit.user_id);
  if (!person?.level) return; // An unconfigured award is not a confirmed zero-euro award.
  const amount = person.calculation.dailyAmounts[date] ?? 0;
  await prisma.$transaction(async (tx) => {
    await saveDailyBonusPublication(tx, { userId: exit.user_id, date, amount, exitId, exitTime: exit.timestamp.toISOString() });
  }, { isolationLevel: "Serializable", timeout: 15000 });
}
