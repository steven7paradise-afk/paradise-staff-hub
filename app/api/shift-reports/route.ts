import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isClientControlFormName } from "@/lib/client-control-form";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { attendanceActualMinutes, currentRomeMinutes, scheduledEntryPolicy } from "@/lib/scheduled-attendance";
import { answerText, normalizeShiftReportData, romeDayRange } from "@/lib/shift-reports";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const allowedRoles = new Set([...managerRoles, "RESPONSABILE"]);

function todayInRome() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean);
  const text = answerText(value);
  return text ? text.split(",").map((name) => name.trim()).filter(Boolean) : [];
}

async function automaticReportData(day: string, locationId: string) {
  const { date, start, end } = romeDayRange(day);
  const [workers, schedules, logs, responses] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, sede_id: locationId, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
      select: { id: true, name: true, photo_url: true }, orderBy: { name: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { date, location_id: locationId },
      include: { user: { select: { id: true, name: true, employee_status: true } }, category: { select: { code: true, name: true } }, location: { select: { name: true } } },
    }),
    prisma.attendanceLog.findMany({
      where: { location_id: locationId, timestamp: { gte: start, lt: end } },
      include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" },
    }),
    prisma.serviceFormResponse.findMany({
      where: { user_location_id: locationId, created_at: { gte: start, lt: end } },
      include: { form: { select: { name: true, category: true } }, user: { select: { name: true } } },
      orderBy: { created_at: "asc" },
    }),
  ]);

  const entries = logs.filter((log) => log.type === "ENTRATA");
  const entryIds = new Set(entries.map((log) => log.user_id));
  const nonWorkingCodes = /RIPOS|FERIE|MALATT|PERMESS|ASSEN/;
  const expected = schedules.filter((entry) => entry.user.employee_status !== FORMER_EMPLOYEE_STATUS && !nonWorkingCodes.test(`${entry.category.code} ${entry.category.name}`.toUpperCase()));
  const absences = expected.filter((entry) => !entryIds.has(entry.user_id)).map((entry) => ({ id: entry.user.id, name: entry.user.name, schedule: `${entry.start_time || ""}${entry.end_time ? `–${entry.end_time}` : ""}` }));
  const present = Array.from(new Map(entries.map((entry) => [entry.user_id, {
    id: entry.user.id, name: entry.user.name, time: entry.time,
  }])).values());
  const late = expected.flatMap((schedule) => {
    const entry = entries.find((log) => log.user_id === schedule.user_id);
    if (!entry) return [];
    const actualMinutes = attendanceActualMinutes(entry);
    const policy = scheduledEntryPolicy({ plannedStart: schedule.start_time, plannedEnd: schedule.end_time, locationName: schedule.location?.name });
    if (policy.plannedMinutes === null || policy.deadlineMinutes === null || actualMinutes <= policy.deadlineMinutes) return [];
    const actual = `${String(Math.floor(actualMinutes / 60) % 24).padStart(2, "0")}:${String(actualMinutes % 60).padStart(2, "0")}`;
    const minutes = Math.max(0, actualMinutes - policy.plannedMinutes);
    return [{ id: entry.id, name: schedule.user.name, planned: schedule.start_time || "—", actual, minutes, detail: `${schedule.start_time || "—"} previsto · ${actual} effettivo · +${minutes} min` }];
  });

  const clientResponses = responses.filter((response) => isClientControlFormName(response.form.name, response.form.category));
  const clientTimeline = clientResponses.map((response) => {
    const answers = response.answers as Record<string, unknown>;
    const notes = [
      answerText(answers.client_control_notes_text),
      answerText(answers.client_control_shopify_order_note),
      answerText(answers.custom_extra_note),
    ].filter(Boolean);
    return {
      id: response.id,
      at: response.created_at.toISOString(),
      client: answerText(answers.client_control_client_name) || "Cliente non indicata",
      service: answerText(answers.client_control_service_title || answers.service_title || answers.client_control_products_list),
      shopifyOrder: answerText(answers.client_control_shopify_order),
      staff: namesFromAnswer(answers.client_control_service_staff || answers.client_control_service_owner),
      notes,
      completedBy: response.user.name,
      detailUrl: `/service-forms/responses/${response.id}`,
    };
  });

  const openPauses = workers.flatMap((worker) => {
    const workerLogs = logs.filter((log) => log.user_id === worker.id);
    const last = workerLogs.at(-1);
    return last?.type === "PAUSA" ? [{ id: worker.id, name: worker.name, since: last.time }] : [];
  });
  const pauseTimeline = workers.flatMap((worker) => {
    const workerLogs = logs.filter((log) => log.user_id === worker.id);
    return workerLogs.flatMap((log, index) => {
      if (log.type !== "PAUSA") return [];
      const reentry = workerLogs.slice(index + 1).find((candidate) => candidate.type === "RIENTRO");
      return [{ id: `${worker.id}-${log.id}`, userId: worker.id, name: worker.name, start: log.time, end: reentry?.time || null }];
    });
  });

  return {
    generatedAt: new Date().toISOString(), day,
    totals: { expected: expected.length, present: present.length, late: late.length, absent: absences.length, clients: clientTimeline.length },
    present, late, absences, openPauses, pauseTimeline, clientTimeline,
  };
}

const reportInclude = {
  location: { select: { id: true, name: true } },
  responsible: { select: { id: true, name: true, photo_url: true } },
  approved_by: { select: { id: true, name: true } },
  revisions: {
    include: { actor: { select: { id: true, name: true, role: true } } },
    orderBy: { created_at: "desc" as const },
  },
};

const reportListInclude = {
  location: { select: { id: true, name: true } },
  responsible: { select: { id: true, name: true, photo_url: true } },
  approved_by: { select: { id: true, name: true } },
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const day = request.nextUrl.searchParams.get("date") || todayInRome();
  const locationId = request.nextUrl.searchParams.get("locationId") || session.user.sedeId || "";
  const locations = await prisma.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const selectedLocationId = locationId || locations[0]?.id || "";
  if (!selectedLocationId) return NextResponse.json({ error: "Nessuna sede disponibile" }, { status: 400 });
  if (session.user.role === "RESPONSABILE" && selectedLocationId !== session.user.sedeId) return NextResponse.json({ error: "Sede non autorizzata" }, { status: 403 });

  const { date } = romeDayRange(day);
  const [automatic, report, recentReports, products] = await Promise.all([
    automaticReportData(day, selectedLocationId),
    prisma.shiftReport.findUnique({ where: { date_location_id: { date, location_id: selectedLocationId } }, include: reportInclude }),
    prisma.shiftReport.findMany({
      where: session.user.role === "RESPONSABILE" ? { responsible_id: session.user.id } : {},
      include: reportListInclude, orderBy: [{ date: "desc" }, { updated_at: "desc" }], take: 40,
    }),
    prisma.shiftReportProduct.findMany({
      where: managerRoles.has(session.user.role) ? {} : { active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);
  return NextResponse.json({ day, locations: session.user.role === "RESPONSABILE" ? locations.filter((location) => location.id === session.user.sedeId) : locations, automatic, report, reports: recentReports, products, manager: managerRoles.has(session.user.role) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const action = String(payload.action || "SAVE").toUpperCase();

  if (action === "CREATE_PRODUCT" || action === "TOGGLE_PRODUCT") {
    if (!managerRoles.has(session.user.role)) return NextResponse.json({ error: "Solo l’amministrazione può modificare il catalogo prodotti" }, { status: 403 });
    if (action === "CREATE_PRODUCT") {
      const name = String(payload.name || "").trim().replace(/\s+/g, " ").slice(0, 200);
      const category = String(payload.category || "").trim().replace(/\s+/g, " ").slice(0, 100);
      if (!name) return NextResponse.json({ error: "Inserisci il nome del prodotto" }, { status: 400 });
      const existingProduct = await prisma.shiftReportProduct.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (existingProduct) return NextResponse.json({ error: "Questo prodotto è già presente" }, { status: 409 });
      const product = await prisma.shiftReportProduct.create({ data: { name, category: category || null } });
      return NextResponse.json({ product });
    }
    const productId = String(payload.productId || "");
    const existingProduct = await prisma.shiftReportProduct.findUnique({ where: { id: productId } });
    if (!existingProduct) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });
    const product = await prisma.shiftReportProduct.update({ where: { id: productId }, data: { active: !existingProduct.active } });
    return NextResponse.json({ product });
  }

  if (action === "APPROVE" || action === "REQUEST_CORRECTION") {
    if (!managerRoles.has(session.user.role)) return NextResponse.json({ error: "Solo lo Store Manager può verificare il report" }, { status: 403 });
    const report = await prisma.shiftReport.findUnique({ where: { id: String(payload.reportId || "") }, include: { responsible: { select: { id: true, name: true } }, location: { select: { name: true } } } });
    if (!report || report.status !== "DA_VERIFICARE") return NextResponse.json({ error: "Il report non è in attesa di verifica" }, { status: 409 });
    const managerNote = String(payload.managerNote || "").trim().slice(0, 5000);
    if (action === "REQUEST_CORRECTION" && !managerNote) return NextResponse.json({ error: "Indica cosa deve essere corretto" }, { status: 400 });
    const status = action === "APPROVE" ? "APPROVATO" : "DA_CORREGGERE";
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.shiftReport.update({
        where: { id: report.id },
        data: {
          status, manager_notes: managerNote || null,
          approved_by_id: action === "APPROVE" ? session.user.id : null,
          approved_at: action === "APPROVE" ? now : null,
        }, include: reportInclude,
      });
      await tx.shiftReportRevision.create({ data: {
        report_id: report.id, actor_id: session.user.id, action, status,
        note: managerNote || null,
        snapshot: { reportData: next.report_data, automaticData: next.automatic_data, managerNotes: managerNote || null },
      } });
      return next;
    });
    await createNotifications([{
      id: randomUUID(), user_id: report.responsible.id,
      title: action === "APPROVE" ? "Report giornata approvato" : "Correzione report richiesta",
      message: action === "APPROVE" ? `Lo Store Manager ha approvato il report di ${report.location.name}.` : managerNote,
      type: "REPORT_TURNO", page: 1, action_url: `/shift-reports?date=${report.date.toISOString().slice(0, 10)}&locationId=${report.location_id}`, read: false, created_at: now,
    }]);
    return NextResponse.json({ report: updated });
  }

  if (session.user.role !== "RESPONSABILE") return NextResponse.json({ error: "Solo il Responsabile di Turno può compilare il report" }, { status: 403 });
  if (action !== "SAVE" && action !== "SUBMIT") return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  const day = String(payload.date || todayInRome());
  const today = todayInRome();
  if (day > today) return NextResponse.json({ error: "Non puoi compilare un report futuro" }, { status: 400 });
  if (action === "SUBMIT" && day === today && currentRomeMinutes() < 18 * 60 + 30) {
    return NextResponse.json({ error: "Il report di oggi può essere inviato dalle 18:30" }, { status: 409 });
  }
  const locationId = session.user.sedeId;
  if (!locationId) return NextResponse.json({ error: "Il Responsabile non ha una sede assegnata" }, { status: 400 });
  const { date } = romeDayRange(day);
  const reportData = normalizeShiftReportData(payload.reportData);
  if (action === "SUBMIT" && !reportData.daySummary) return NextResponse.json({ error: "Scrivi il riepilogo della giornata prima dell’invio" }, { status: 400 });
  if (action === "SUBMIT" && reportData.attendanceAllPresent === null) return NextResponse.json({ error: "Indica se tutto il personale era presente" }, { status: 400 });
  if (action === "SUBMIT" && reportData.attendanceAllPresent === false && !reportData.reportedLate && !reportData.reportedAbsences) return NextResponse.json({ error: "Indica i ritardi o le assenze dichiarate" }, { status: 400 });
  if (action === "SUBMIT" && [reportData.checks.staffPresentable, reportData.checks.salonClean, reportData.checks.materialsAvailable].some((value) => value === null)) return NextResponse.json({ error: "Completa Presentabilità staff, Ordine / pulizia e Materiali prima dell’invio" }, { status: 400 });
  if (action === "SUBMIT" && [reportData.refusedServices, reportData.refusedServiceReason, reportData.refusedServiceDecision].some(Boolean) && ![reportData.refusedServices, reportData.refusedServiceReason, reportData.refusedServiceDecision].every(Boolean)) return NextResponse.json({ error: "Completa servizio rifiutato, motivo e decisione presa da" }, { status: 400 });
  const existing = await prisma.shiftReport.findUnique({ where: { date_location_id: { date, location_id: locationId } } });
  if (existing && existing.responsible_id !== session.user.id) return NextResponse.json({ error: "Il report di questa sede è già assegnato a un altro Responsabile" }, { status: 409 });
  if (existing && !["DRAFT", "DA_CORREGGERE"].includes(existing.status)) return NextResponse.json({ error: "Il report è già stato inviato e non può essere modificato" }, { status: 409 });
  const automaticData = await automaticReportData(day, locationId);
  if (action === "SUBMIT") {
    const clients = (automaticData.clientTimeline as Array<{ id: string }>);
    const missingCheck = clients.find((client) => !reportData.clientChecks[client.id]?.status);
    if (missingCheck) return NextResponse.json({ error: `Conferma l’esito della cliente: ${String((missingCheck as { client?: string }).client || "cliente non indicata")}` }, { status: 400 });
    const incompleteProblem = clients.find((client) => reportData.clientChecks[client.id]?.status === "PROBLEM" && (!reportData.clientChecks[client.id]?.problem || !reportData.clientChecks[client.id]?.solution || reportData.clientChecks[client.id]?.resolved === null));
    if (incompleteProblem) return NextResponse.json({ error: "Per ogni cliente con problemi indica problema, soluzione e se è stato risolto" }, { status: 400 });
  }
  const status = action === "SUBMIT" ? "DA_VERIFICARE" : existing?.status === "DA_CORREGGERE" ? "DA_CORREGGERE" : "DRAFT";
  const now = new Date();
  const saved = await prisma.$transaction(async (tx) => {
    const next = existing
      ? await tx.shiftReport.update({ where: { id: existing.id }, data: { report_data: reportData, automatic_data: automaticData, status, submitted_at: action === "SUBMIT" ? now : existing.submitted_at, manager_notes: action === "SUBMIT" ? null : existing.manager_notes }, include: reportInclude })
      : await tx.shiftReport.create({ data: { date, location_id: locationId, responsible_id: session.user.id, report_data: reportData, automatic_data: automaticData, status, submitted_at: action === "SUBMIT" ? now : null }, include: reportInclude });
    await tx.shiftReportRevision.create({ data: {
      report_id: next.id, actor_id: session.user.id, action, status,
      snapshot: { reportData, automaticData },
    } });
    return next;
  });

  if (action === "SUBMIT") {
    const managers = await prisma.user.findMany({
      where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] }, OR: [{ sede_id: locationId }, { sede_id: null }] },
      select: { id: true },
    });
    await createNotifications(managers.map((manager) => ({
      id: randomUUID(), user_id: manager.id, title: "Report turno da verificare",
      message: `${session.user.name} ha inviato il report giornaliero.`, type: "REPORT_TURNO", page: 1,
      action_url: `/shift-reports/admin?date=${day}&locationId=${locationId}`, read: false, created_at: now,
    })));
    const escalatedClients = Object.values(reportData.clientChecks).filter((check) => check.escalated);
    if (escalatedClients.length || reportData.notesForLeydi) {
      const leydiRecipients = await prisma.user.findMany({ where: { active: true, name: { contains: "Leydi", mode: "insensitive" } }, select: { id: true } });
      await createNotifications(leydiRecipients.map((recipient) => ({
        id: randomUUID(), user_id: recipient.id, title: "Escalation dal report di turno",
        message: reportData.notesForLeydi || `${escalatedClients.length} situazione/i cliente richiedono la tua attenzione.`,
        type: "REPORT_ESCALATION", page: 1,
        action_url: `/shift-reports/admin?date=${day}&locationId=${locationId}`, read: false, created_at: now,
      })));
    }
  }
  return NextResponse.json({ report: saved });
}
