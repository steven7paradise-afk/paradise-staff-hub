import type { AnalyticsRow, AnalyticsStaff, AnalyticsDelay } from './client-control-analytics';

export function monthlyStaffReport(rows: AnalyticsRow[], staff: AnalyticsStaff[], delays: AnalyticsDelay[], attendanceDays: Record<string, number>) {
  return staff.filter(s => s.active && /buenos|corso/i.test(s.salon || '')).map(s => {
    const own = rows.filter(r => r.primary?.id === s.id && /buenos|corso/i.test(r.salon));
    const done = own.filter(r => r.category === 'completed' && r.primaryNote);
    const delay = delays.find(d => d.id === s.id);
    return { name: s.name, clients: done.length, before: done.filter(r => r.checks.before).length,
      after: done.filter(r => r.checks.after).length, both: done.filter(r => r.checks.before && r.checks.after).length,
      reviews: done.filter(r => r.checks.review).length, discovery: done.filter(r => r.discovery !== 'Non indicato').length,
      missing: own.filter(r => r.category === 'missing').length, pending: own.filter(r => r.category === 'pending').length,
      fallback: done.filter(r => r.dateSource === 'created').length, clockDays: attendanceDays[s.id] || 0,
      entryMinutes: delay?.entryMinutes || 0, breakMinutes: delay?.breakMinutes || 0,
      totalMinutes: delay?.totalMinutes || 0, lateDays: delay?.days.length || 0 };
  }).sort((a,b) => b.clients - a.clients || a.name.localeCompare(b.name));
}
export type MonthlyStaffResult = ReturnType<typeof monthlyStaffReport>[number];
