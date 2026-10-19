import { prisma } from "@/lib/prisma";
import { CONFIG_KEY, OfficeConfig, emptyConfig, departments, type OfficeConfiguration } from "./schemas";
import { addDays, dayStart, romeDate, romeIso, attendanceForDay, TIMEZONE, type ClockLog } from "./time";
export const employeeSelect = { id: true, name: true } as const;
export const taskSelect = { id: true, status: true, priority: true, due_date: true, started_at: true, completed_at: true, created_at: true, created_by_id: true, assignees: { select: { id: true } } } as const;
// No task notes/descriptions, employee contacts, payroll, documents or leave tables are queried.
export async function officeConfig(): Promise<OfficeConfiguration> {
  const setting = await prisma.setting.findUnique({ where: { key: CONFIG_KEY }, select: { value: true } });
  return setting ? OfficeConfig.parse(setting.value) : emptyConfig;
}
export function taskState(status: string): "da_fare" | "in_corso" | "completata" {
  return ["COMPLETED", "DONE"].includes(status) ? "completata" : ["ACTIVE", "COMPLETION_REQUESTED"].includes(status) ? "in_corso" : "da_fare";
}
export async function loadOffice(now = new Date(), date = romeDate(now)) {
  const config = await officeConfig();
  const ids = config.employees.map(e => e.employee_id);
  const people = await prisma.user.findMany({ where: { id: { in: ids }, active: true, employee_status: { not: "Ex dipendente" } }, select: employeeSelect, orderBy: { name: "asc" } });
  const visibleIds = people.map(e => e.id), visible = new Set(visibleIds);
  const firstDay = addDays(date, -6);
  const [logs, rawTasks] = await Promise.all([
    prisma.attendanceLog.findMany({ where: { user_id: { in: visibleIds }, timestamp: { gte: dayStart(addDays(firstDay, -1)), lt: dayStart(addDays(date, 1)) } }, select: { user_id: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.staffTask.findMany({ where: { assignees: { some: { id: { in: visibleIds } } } }, select: taskSelect, orderBy: { created_at: "desc" } }),
  ]);
  const publicTexts = new Map(config.task_texts.map(t => [t.task_id, t]));
  const tasks = rawTasks.map(t => {
    const text = publicTexts.get(t.id);
    return { id: t.id, title: text?.title || "Attività operativa", description: text?.description || null, status: taskState(t.status), priority: ["ALTA", "MEDIA", "BASSA", "URGENTE"].includes(t.priority) ? t.priority : "MEDIA", due_date: t.due_date ? romeDate(t.due_date) : null, created_at: romeIso(t.created_at), assigned_by: visible.has(t.created_by_id) ? t.created_by_id : null, assignee_ids: t.assignees.map(a => a.id).filter(id => visible.has(id)), text_shared: Boolean(text) };
  });
  const byPerson = new Map<string, ClockLog[]>();
  for (const log of logs) { const items = byPerson.get(log.user_id) || []; items.push(log); byPerson.set(log.user_id, items); }
  const attendance = people.map(p => ({ employee_id: p.id, ...attendanceForDay(byPerson.get(p.id) || [], date, now) }));
  const employees = people.map(p => {
    const assignment = config.employees.find(e => e.employee_id === p.id)!;
    const own = tasks.filter(t => t.assignee_ids.includes(p.id));
    const current = rawTasks.filter(t => t.status === "ACTIVE" && t.started_at && t.assignees.some(a => a.id === p.id)).sort((a, b) => b.started_at!.getTime() - a.started_at!.getTime())[0];
    const presence = attendance.find(a => a.employee_id === p.id)!;
    return { id: p.id, name: p.name, role: assignment.public_role || "Collaboratore", department_key: assignment.department_key, is_department_lead: config.departments.some(d => d.key === assignment.department_key && d.lead_employee_id === p.id), status: presence.status, checked_in_at: presence.checked_in_at, checked_out_at: presence.checked_out_at, current_task: current ? { id: current.id, title: publicTexts.get(current.id)?.title || "Attività operativa", started_at: current.started_at ? romeIso(current.started_at) : null } : null, open_tasks_count: own.filter(t => t.status !== "completata").length, overdue_tasks_count: own.filter(t => t.status !== "completata" && t.due_date && t.due_date < romeDate(now)).length };
  });
  const rooms = departments.map(d => {
    const setup = config.departments.find(c => c.key === d.key);
    const occupied = employees.filter(e => e.department_key === d.key && ["in_sede", "in_pausa", "in_riunione"].includes(e.status)).length;
    return { ...d, lead_employee_id: setup?.lead_employee_id && visible.has(setup.lead_employee_id) ? setup.lead_employee_id : null, free_seats: setup?.capacity != null ? Math.max(0, setup.capacity - occupied) : null };
  });
  const meta = { generated_at: romeIso(now), timezone: TIMEZONE as "Europe/Rome", data_notes: [
    "Sono inclusi solo i collaboratori configurati per il connettore MCP.",
    "Progetti non disponibili: lo Staff Hub non contiene un archivio progetti strutturato.",
    "Assenze e riunioni non sono dedotte: senza timbratura lo stato è non_timbrato.",
    "Posti liberi null indica capienza non configurata; presenze e pause occupano un posto.",
    "current_task indica l’attività ACTIVE avviata più recentemente, non una misura dell’attività della persona.",
    "Titoli e descrizioni sono condivisi solo nella versione operativa approvata; gli altri testi sono omessi.",
    "Le ore sono ricavate dalle timbrature e non sostituiscono il calcolo retributivo.",
  ] };
  return { meta, employees, departments: rooms, tasks, attendance, projects: [] as import("zod").infer<typeof import("./schemas").Project>[],
    history(employeeId: string) { return Array.from({ length: 7 }, (_, index) => { const day = addDays(firstDay, index); return { date: day, worked_hours: Math.round(attendanceForDay(byPerson.get(employeeId) || [], day, now).worked_minutes / 60 * 100) / 100, completed_tasks_count: rawTasks.filter(t => t.completed_at && romeDate(t.completed_at) === day && taskState(t.status) === "completata" && t.assignees.some(a => a.id === employeeId)).length }; }); },
  };
}
