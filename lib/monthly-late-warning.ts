export const MONTHLY_LATE_WARNING_THRESHOLD = 3;
export const MONTHLY_LATE_WARNING_DURATION_MS = 60_000;

export function shouldShowMonthlyLateWarning(monthlyLateCount: number) {
  return Number.isFinite(monthlyLateCount) && monthlyLateCount > MONTHLY_LATE_WARNING_THRESHOLD;
}
