export const CONTRACT_RENEWAL_REMINDER_DAYS = new Set([7, 3, 2, 1]);

export function calendarDaysBetween(todayKey: string, contractEndKey: string) {
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  const contractEnd = new Date(`${contractEndKey}T00:00:00.000Z`);
  if (Number.isNaN(today.getTime()) || Number.isNaN(contractEnd.getTime())) return null;
  return Math.round((contractEnd.getTime() - today.getTime()) / 86_400_000);
}

export function shouldShowContractRenewalPopup({
  active,
  daysLeft,
  renewalStatus,
}: {
  active: boolean;
  daysLeft: number | null;
  renewalStatus?: string;
}) {
  if (!active || daysLeft === null || renewalStatus === "RINNOVATO") return false;
  if (daysLeft <= 0) return true;
  return renewalStatus !== "NON_RINNOVATO" && CONTRACT_RENEWAL_REMINDER_DAYS.has(daysLeft);
}
