/** Staff-facing unit for the daily result award; not the separate monthly bonus conversion. */
export function formatResultBonusPoints(value: number) {
  return `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })} ${value === 1 ? "punto" : "punti"}`;
}
export function resultBonusNotificationText<T extends { type: string; title: string; message: string }>(notification: T): T {
  if (notification.type !== "PREMIO_RISULTATO") return notification;
  const legacy = notification.message.match(/^Il (\d{1,2}\/\d{1,2}\/\d{4}) hai guadagnato ([\d.,]+)\s*€\.$/);
  if (!legacy) return notification;
  const amount = Number(legacy[2].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return notification;
  return { ...notification, title: "I tuoi punti della giornata", message: `Il ${legacy[1]} hai ottenuto ${formatResultBonusPoints(amount)}.` };
}
