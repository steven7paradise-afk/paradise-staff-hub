export const FORMER_EMPLOYEE_STATUS = "Ex dipendente";

export function resolveEmployeeActive(requestedActive: unknown, requestedStatus: string, currentActive: boolean) {
  if (typeof requestedActive === "boolean") return requestedActive;
  if (requestedStatus === FORMER_EMPLOYEE_STATUS) return true;
  return currentActive;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function formerEmployeeAccessDates(workforceData: unknown, fallback?: Date | null) {
  const profile = asRecord(workforceData);
  const rawSince = typeof profile.exEmployeeSince === "string" ? profile.exEmployeeSince : "";
  const sinceCandidate = rawSince ? new Date(rawSince) : fallback ?? new Date();
  const since = Number.isNaN(sinceCandidate.getTime()) ? (fallback ?? new Date()) : sinceCandidate;
  const rawUntil = typeof profile.exDocumentAccessUntil === "string" ? profile.exDocumentAccessUntil : "";
  const untilCandidate = rawUntil ? new Date(rawUntil) : addCalendarMonths(since, 3);
  const until = Number.isNaN(untilCandidate.getTime()) ? addCalendarMonths(since, 3) : untilCandidate;
  return { since, until };
}

export function hasFormerEmployeeDocumentAccess(workforceData: unknown, fallback?: Date | null, now = new Date()) {
  return now.getTime() <= formerEmployeeAccessDates(workforceData, fallback).until.getTime();
}

export function isFormerEmployeeAllowedPath(pathname: string) {
  return pathname === "/documents"
    || pathname.startsWith("/documents/")
    || /^\/api\/documents\/[^/]+\/download\/?$/.test(pathname);
}
