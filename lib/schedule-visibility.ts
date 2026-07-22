export type VisibleScheduleMonth = {
  month: number;
  year: number;
};

function romeDateParts(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return {
    year,
    month: month - 1,
    day,
  };
}

export function visibleScheduleMonthsForEmployee(referenceDate = new Date()): VisibleScheduleMonth[] {
  const current = romeDateParts(referenceDate);
  const daysInCurrentMonth = new Date(Date.UTC(current.year, current.month + 1, 0)).getUTCDate();
  const canSeeNextMonth = current.day >= daysInCurrentMonth - 2;
  const months: VisibleScheduleMonth[] = [{ month: current.month, year: current.year }];

  if (canSeeNextMonth) {
    const next = new Date(Date.UTC(current.year, current.month + 1, 1));
    months.push({ month: next.getUTCMonth(), year: next.getUTCFullYear() });
  }

  return months;
}

export function isEmployeeScheduleMonthVisible(month: number, year: number, referenceDate = new Date()) {
  return visibleScheduleMonthsForEmployee(referenceDate).some((visible) => visible.month === month && visible.year === year);
}

export function coerceEmployeeScheduleMonth(month: number, year: number, referenceDate = new Date()): VisibleScheduleMonth {
  if (isEmployeeScheduleMonthVisible(month, year, referenceDate)) {
    return { month, year };
  }

  return visibleScheduleMonthsForEmployee(referenceDate)[0];
}

export function employeeScheduleWindow(referenceDate = new Date()) {
  const months = visibleScheduleMonthsForEmployee(referenceDate);
  const first = months[0];
  const last = months[months.length - 1];

  return {
    months,
    start: new Date(Date.UTC(first.year, first.month, 1)),
    end: new Date(Date.UTC(last.year, last.month + 1, 1)),
  };
}
