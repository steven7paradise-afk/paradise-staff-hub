import { z } from "zod";
export const DepartmentKey = z.enum(["ecom", "mkt", "admin", "ceo", "tit", "mag", "sarta", "saloni"]);
export const departments = [
  { key: "ecom", name: "E-commerce" }, { key: "mkt", name: "Marketing & Social" },
  { key: "admin", name: "Amministrazione" }, { key: "ceo", name: "Ufficio Brayan (direzione)" }, { key: "tit", name: "Ufficio titolare" },
  { key: "mag", name: "Magazzino" }, { key: "sarta", name: "Sartoria" }, { key: "saloni", name: "Saloni" },
] as const;
export const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data non valida");
const Iso = z.string().datetime({ offset: true });
const Id = z.string().min(1).max(100);
export const EmployeeStatus = z.enum(["in_sede", "in_pausa", "in_riunione", "fuori_sede", "assente", "non_timbrato"]);
export const TaskStatus = z.enum(["da_fare", "in_corso", "completata"]);
export const ProjectStatus = z.enum(["in_linea", "da_seguire", "in_ritardo", "completato"]);
export const CurrentTask = z.object({ id: Id, title: z.string(), started_at: Iso.nullable() });
export const Employee = z.object({ id: Id, name: z.string(), role: z.string(), department_key: DepartmentKey.nullable(), is_department_lead: z.boolean(), status: EmployeeStatus, checked_in_at: Iso.nullable(), checked_out_at: Iso.nullable(), current_task: CurrentTask.nullable(), open_tasks_count: z.number().int().nonnegative(), overdue_tasks_count: z.number().int().nonnegative() });
export const Task = z.object({ id: Id, title: z.string(), description: z.string().nullable(), status: TaskStatus, priority: z.string(), due_date: DateKey.nullable(), created_at: Iso, assigned_by: Id.nullable(), assignee_ids: z.array(Id), text_shared: z.boolean() });
export const Project = z.object({ id: Id, name: z.string(), department_key: DepartmentKey, owner_employee_id: Id.nullable(), assignee_ids: z.array(Id), progress_percent: z.number().min(0).max(100), status: ProjectStatus, due_date: DateKey.nullable(), open_tasks_count: z.number().int().nonnegative(), closed_tasks_count: z.number().int().nonnegative() });
export const Attendance = z.object({ employee_id: Id, status: EmployeeStatus, checked_in_at: Iso.nullable(), checked_out_at: Iso.nullable(), worked_minutes: z.number().int().nonnegative(), breaks: z.array(z.object({ started_at: Iso, ended_at: Iso.nullable(), minutes: z.number().int().nonnegative() })) });
export const Meta = { generated_at: Iso, timezone: z.literal("Europe/Rome"), data_notes: z.array(z.string()) };
export const Summary = z.object({ ...Meta, departments: z.array(z.object({ key: DepartmentKey, name: z.string(), lead_employee_id: Id.nullable(), free_seats: z.number().int().nonnegative().nullable() })), employees: z.array(Employee), projects: z.array(Project) });
export const Employees = z.object({ ...Meta, employees: z.array(Employee) });
export const EmployeeDetail = z.object({ ...Meta, employee: Employee, attendance: Attendance, current_task: CurrentTask.nullable(), tasks: z.array(Task), projects: z.array(Project), history: z.array(z.object({ date: DateKey, worked_hours: z.number().nonnegative(), completed_tasks_count: z.number().int().nonnegative() })) });
export const Attendances = z.object({ ...Meta, date: DateKey, employees: z.array(Attendance) });
export const Tasks = z.object({ ...Meta, tasks: z.array(Task) });
export const Projects = z.object({ ...Meta, projects: z.array(Project) });
// Explicit mapping avoids guessing staff departments or disclosing arbitrary HR/task notes.
export const OfficeConfig = z.object({
  employees: z.array(z.object({ employee_id: Id, department_key: DepartmentKey, public_role: z.string().max(100) })).max(500),
  departments: z.array(z.object({ key: DepartmentKey, lead_employee_id: Id.nullable(), capacity: z.number().int().min(0).max(1000).nullable() })).max(8),
  task_texts: z.array(z.object({ task_id: Id, title: z.string().trim().min(1).max(150), description: z.string().max(300) })).max(2000),
}).strict().superRefine((value, ctx) => {
  for (const ids of [value.employees.map(e => e.employee_id), value.departments.map(d => d.key), value.task_texts.map(t => t.task_id)])
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Identificatori duplicati" });
  for (const d of value.departments) if (d.lead_employee_id && !value.employees.some(e => e.employee_id === d.lead_employee_id && e.department_key === d.key)) ctx.addIssue({ code: "custom", message: "Il capo reparto deve appartenere al reparto" });
});
export type OfficeConfiguration = z.infer<typeof OfficeConfig>;
export const emptyConfig: OfficeConfiguration = { employees: [], departments: [], task_texts: [] };
export const CONFIG_KEY = "mcp_office_config_v1";
