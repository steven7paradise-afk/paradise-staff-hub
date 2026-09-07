export function moneyNumber(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

export function cashDateFromInput(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return new Date(`${raw}T00:00:00.000Z`);
}

export function cashDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeCashIdentity(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function cashClosingLocationOverride(userName: unknown, assignedLocationName: unknown) {
  const user = normalizeCashIdentity(userName);
  const location = normalizeCashIdentity(assignedLocationName);
  if (user === "franci" && location === "ufficio paradise") {
    return "Salone Buenos Aires";
  }
  return null;
}
