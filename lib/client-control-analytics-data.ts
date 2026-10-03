import { dashboardDelaySummary } from "@/lib/dashboard-delay-summary";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import type { AnalyticsDelay, AnalyticsAbsence } from "@/lib/client-control-analytics";
import { prisma } from "@/lib/prisma";
import { getCowlendarBookingsForRange, hasCowlendarToken, type CowlendarBooking } from "@/lib/cowlendar";
import { isClientControlFormName } from "@/lib/client-control-form";
import { analyticsMonthRange, buildClientControlAnalytics, romeDate } from "@/lib/client-control-analytics";


export async function loadClientControlAnalytics(requestedMonth?: string) {
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth || "") ? requestedMonth! : romeDate(new Date()).slice(0, 7);
  const { start, end } = analyticsMonthRange(month);
  let bookings: CowlendarBooking[] = []; let warning = "";
  try {
    if (!hasCowlendarToken()) throw new Error("Agenda non configurata");
    bookings = await getCowlendarBookingsForRange({ startDate: start.toISOString(), endDate: new Date(end.getTime() - 1).toISOString(), limit: 5000, forceRefresh: true });
    if (bookings.length >= 5000) warning = "L’agenda ha raggiunto il limite di lettura: i conteggi degli appuntamenti potrebbero essere parziali.";
  } catch {
    warning = "Agenda non disponibile: mostriamo solo le schede, per data di creazione. Annullati e appuntamenti senza scheda potrebbero mancare.";
  }
  const [forms, staff, overrides] = await Promise.all([
    prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
    prisma.user.findMany({ select: { id: true, name: true, active: true, photo_url: true, location: { select: { id: true, name: true } } } }),
    prisma.setting.findUnique({ where: { key: "appointment_status_overrides" } }),
  ]);
  let delays: AnalyticsDelay[] = []; let delayWarning = "";
  let attendanceDays: Record<string, number> = {};
  const corsoStaff = staff.filter(s => s.active && /buenos|corso/i.test(s.location?.name || ""));
  const locationIds = [...new Set(corsoStaff.map(s => s.location!.id))];
  const staffIds = corsoStaff.map(s => s.id);
  // Attendance date is a civil date stored at UTC midnight, unlike booking timestamps.
  const attendanceStart = new Date(`${month}-01T00:00:00Z`);
  const attendanceEnd = new Date(Date.UTC(attendanceStart.getUTCFullYear(), attendanceStart.getUTCMonth() + 1, 1));
  try {
    const [logs, shifts, rules] = await Promise.all([
      prisma.attendanceLog.findMany({ where: { user_id: { in: staffIds }, location_id: { in: locationIds }, date: { gte: attendanceStart, lt: attendanceEnd } }, select: { user_id: true, date: true, type: true, timestamp: true, note: true }, orderBy: { timestamp: "asc" } }),
      prisma.scheduleEntry.findMany({ where: { user_id: { in: staffIds }, date: { gte: attendanceStart, lt: attendanceEnd } }, select: { user_id: true, date: true, start_time: true, end_time: true, category: { select: { name: true, code: true, start_time: true, end_time: true } } } }),
      prisma.setting.findMany({ where: { key: { in: locationIds.map(clockRuleKey) } } }),
    ]);
    attendanceDays = Object.fromEntries(corsoStaff.map(person => [person.id, new Set(logs.filter(l => l.user_id === person.id && l.type === "ENTRATA").map(l => l.date.toISOString().slice(0, 10))).size]));
    delays = corsoStaff.map(person => {
      const ownLogs = logs.filter(l => l.user_id === person.id);
      const ownShifts = shifts.filter(s => s.user_id === person.id);
      const limit = parseClockRule(rules.find(r => r.key === clockRuleKey(person.location!.id))?.value).breakDurationMinutes;
      const summary = dashboardDelaySummary(ownLogs, ownShifts, person.location?.name, limit);
      const days = [...new Set(ownLogs.map(l => l.date.toISOString().slice(0, 10)))].sort().map(date => ({ date, ...dashboardDelaySummary(ownLogs.filter(l => l.date.toISOString().slice(0, 10) === date), ownShifts.filter(s => s.date.toISOString().slice(0, 10) === date), person.location?.name, limit) })).filter(d => d.totalMinutes > 0);
      return { id: person.id, name: person.name, photoUrl: person.photo_url, salon: person.location?.name, ...summary, days };
    }).filter(person => person.totalMinutes > 0).sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name));
  } catch {
    delayWarning = "Dati delle timbrature non disponibili: riprova ad aggiornare la pagina.";
  }
  let absences: AnalyticsAbsence[] = []; let absenceWarning = "";
  try {
    const requests = await prisma.leaveRequest.findMany({
      where: { user_id: { in: staffIds }, type: { notIn: ["RIPOSO", "FERIE"] }, status: { in: ["APPROVED", "PENDING", "FLAGGED"] }, start_date: { lt: attendanceEnd }, end_date: { gte: attendanceStart } },
      select: { id: true, user_id: true, type: true, start_date: true, end_date: true, start_time: true, end_time: true, status: true, reason: true, sickness_unjustified: true },
      orderBy: { start_date: "desc" },
    });
    absences = requests.filter(r => !/^RITARDO AUTOMATICO/i.test(r.reason || "") && !(r.type === "PERMESSO" && r.status === "APPROVED" && !(r.reason || "").includes("[ASSENZA_INGIUSTIFICATA]"))).map(r => {
      const person = corsoStaff.find(s => s.id === r.user_id)!;
      const explicitUnjustified = (r.reason || "").includes("[ASSENZA_INGIUSTIFICATA]");
      const needsDocument = r.type === "MALATTIA" && r.sickness_unjustified;
      const category = explicitUnjustified && r.status === "APPROVED" || needsDocument ? "unjustified" as const : r.status === "APPROVED" ? "approved" as const : "pending" as const;
      const automaticAbsence = /Assenza senza timbratura/i.test(r.reason || "");
      const type = explicitUnjustified ? "Assenza" : automaticAbsence && r.type === "ALTRO" ? "Timbratura mancante" : ({ RIPOSO: "Riposo", FERIE: "Ferie", MALATTIA: "Malattia", PERMESSO: "Permesso", ALTRO: "Altra assenza" }[r.type] || "Assenza");
      return { id: person.id, name: person.name, photoUrl: person.photo_url, salon: person.location?.name, requestId: r.id,
        from: new Date(Math.max(+r.start_date, +attendanceStart)).toISOString().slice(0, 10), to: new Date(Math.min(+r.end_date, +attendanceEnd - 86400000)).toISOString().slice(0, 10),
        time: r.start_time || r.end_time ? `${r.start_time || "—"} – ${r.end_time || "—"}` : "Giornata intera", type, category,
        label: needsDocument ? "Malattia da giustificare" : explicitUnjustified && r.status === "APPROVED" ? "Non giustificata registrata" : r.status === "APPROVED" ? "Approvata" : r.status === "FLAGGED" ? "Da verificare" : "In attesa di approvazione" };
    });
  } catch { absenceWarning = "Assenze non disponibili: riprova ad aggiornare la pagina."; }
  const formIds = forms.filter(f => isClientControlFormName(f.name, f.category)).map(f => f.id);
  const cards = await prisma.serviceFormResponse.findMany({
    where: { form_id: { in: formIds }, OR: [
      { created_at: { gte: start, lt: end } },
      ...bookings.map(b => ({ answers: { path: ["booking_id"], equals: b.id } })),
    ] },
    select: { id: true, answers: true, created_at: true, updated_at: true, user_location_name: true },
  });
  const rows = buildClientControlAnalytics({ month, cards: cards.map(c => ({ ...c, created_at: c.created_at.toISOString(), updated_at: c.updated_at.toISOString(), answers: c.answers as Record<string, unknown> })), bookings, staff, statuses: (overrides?.value || {}) as Record<string, { status?: string }> });
  return { month, rows, warning, delays, delayWarning, absences, absenceWarning, attendanceDays,
    staff: staff.map(s => ({ id: s.id, name: s.name, active: s.active, photoUrl: s.photo_url, salon: s.location?.name || "Sede non indicata" })) };
}
