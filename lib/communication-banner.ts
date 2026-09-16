export const BANNER_DEFAULT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

export function communicationBannerExpiry(date: unknown, now = new Date()): Date {
  const defaultExpiry = new Date(now.getTime() + BANNER_DEFAULT_DURATION_MS);
  if (date === undefined || date === null || date === "") return defaultExpiry;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Scegli una data valida per il banner.");
  const midday = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(midday.getTime()) || midday.toISOString().slice(0, 10) !== date) throw new Error("Scegli una data valida per il banner.");
  const hourInRome = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(midday));
  const expiry = new Date(new Date(`${date}T23:59:59.999Z`).getTime() - (hourInRome - 12) * 60 * 60 * 1000);
  if (expiry < defaultExpiry) throw new Error("La data deve garantire almeno 3 giorni di visibilità.");
  return expiry;
}
