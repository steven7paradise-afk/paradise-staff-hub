type Closing = { location_id: string; date: Date; withdrawn: number };
type Withdrawal = { location_id: string; date: Date; amount: number };
type Week = { key: string; value: unknown };

// Mirrors the management dashboard: current availability since the last month
// closure, and movements attributed to the month containing the week's end.
export function financialSummary(day: string, closings: Closing[], withdrawals: Withdrawal[], weeks: Week[], closedMonth: string | null) {
  const [year, month] = day.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const closed = closedMonth?.split("-").map(Number);
  const openStart = closed ? new Date(Date.UTC(closed[0], closed[1], 1)) : null;
  const amount = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const parsed = weeks.flatMap(week => {
    const value = week.value as { weekKey?: string; bank_deposit?: number; withdrawals?: number } | null;
    if (!value?.weekKey) return [];
    const [a, b] = value.weekKey.split(":");
    const from = new Date(`${a}T00:00:00Z`), until = new Date(`${b || a}T00:00:00Z`);
    if (!b) until.setUTCDate(until.getUTCDate() + 6);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime())) return [];
    return [{ from, until, location: week.key.split(":")[1], deposits: amount(value.bank_deposit), withdrawals: amount(value.withdrawals) }];
  });
  // Input is newest first, as on the website. Corrections replace earlier closings.
  const latest = new Map<string, Closing>();
  for (const row of closings) {
    const key = `${row.location_id}:${row.date.toISOString().slice(0, 10)}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const openWeeks = parsed.filter(w => !openStart || new Date(w.until.getTime() + 86399999) >= openStart);
  const unclosed = withdrawals.filter(w => (!openStart || w.date >= openStart) && !openWeeks.some(c => c.location === w.location_id && w.date >= c.from && w.date.getTime() <= c.until.getTime() + 86399999));
  const monthly = parsed.filter(w => w.until >= start && w.until < end);
  const sum = <T>(items: T[], get: (item: T) => number) => items.reduce((total, item) => total + get(item), 0);
  const money = (n: number) => Math.round(n * 100) / 100;
  return {
    period: new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    available: money(sum([...latest.values()].filter(c => !openStart || c.date >= openStart), c => c.withdrawn) - sum(openWeeks, c => c.deposits + c.withdrawals) - sum(unclosed, c => c.amount)),
    deposits: money(sum(monthly, w => w.deposits)),
    withdrawals: money(sum(monthly, w => w.withdrawals)),
    expenses: money(sum(withdrawals.filter(w => w.date >= start && w.date < end), w => w.amount)),
    revenue: money(sum([...latest.values()].filter(c => c.date >= start && c.date < end), c => c.withdrawn)),
  };
}
