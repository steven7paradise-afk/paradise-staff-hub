export function payrollMonthKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function attendanceMonthsFromDates(dates: Date[]) {
  return Array.from(new Set(dates.map((date) => payrollMonthKey(date.getUTCMonth() + 1, date.getUTCFullYear()))));
}

export function workedInPayrollMonth(workedMonths: string[] | undefined, month: number, year: number) {
  if (!workedMonths) return true;
  return workedMonths.includes(payrollMonthKey(month, year));
}

export function contractActiveInPayrollMonth(
  contractStart: string | null | undefined,
  contractEnd: string | null | undefined,
  month: number,
  year: number,
) {
  if (!contractStart) return false;
  const startsAt = new Date(contractStart).getTime();
  const endsAt = contractEnd ? new Date(contractEnd).getTime() : null;
  if (!Number.isFinite(startsAt) || (endsAt !== null && !Number.isFinite(endsAt))) return false;

  const monthStartsAt = Date.UTC(year, month - 1, 1);
  const nextMonthStartsAt = Date.UTC(year, month, 1);
  return startsAt < nextMonthStartsAt && (endsAt === null || endsAt >= monthStartsAt);
}
