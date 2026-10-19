import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as s from "./schemas";
import { loadOffice } from "./data";
import { audit } from "./security";
export function createOfficeServer(identity: { user_id: string; client_id: string }, load = loadOffice) {
  const server = new McpServer({ name: "paradise-staff-hub", version: "1.0.0" }, { instructions: "Dati operativi in sola lettura. Rispetta data_notes e valori null; non dedurre salute, motivi di assenza o produttività individuale dai dati. Nessun tool modifica lo Staff Hub." });
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  function register<I extends z.ZodRawShape, O extends z.ZodRawShape>(name: string, description: string, input: I, output: O, run: (args: z.infer<z.ZodObject<I>>) => Promise<unknown>) {
    const inputSchema: z.ZodObject<z.ZodRawShape> = z.object(input);
    server.registerTool(name, { description, inputSchema, outputSchema: z.object(output), annotations }, async (args): Promise<CallToolResult> => {
      const started = Date.now();
      try {
        const data = z.object(output).parse(await run(z.object(input).parse(args)));
        audit("tool.read", { ...identity, tool: name, status: 200, duration_ms: Date.now() - started });
        return { structuredContent: data as Record<string, unknown>, content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      } catch {
        audit("tool.failed", { ...identity, tool: name, status: 400, duration_ms: Date.now() - started });
        return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "Dati non disponibili o identificatore non incluso nel connettore." }) }] };
      }
    });
  }
  register("get_office_summary", "Snapshot aggiornato di reparti, personale operativo e progetti disponibili. Consultare data_notes per i dati non presenti.", {}, s.Summary.shape, async () => { const d = await load(); return { ...d.meta, departments: d.departments, employees: d.employees, projects: d.projects }; });
  register("list_employees", "Personale configurato per il connettore, opzionalmente per reparto.", { department_key: s.DepartmentKey.optional() }, s.Employees.shape, async args => { const d = await load(); return { ...d.meta, employees: d.employees.filter(e => !args.department_key || e.department_key === args.department_key) }; });
  register("get_employee", "Scheda operativa, timbrature di oggi, attività aperte e ultimi sette giorni. Nessun dato HR privato.", { employee_id: z.string().min(1).max(100) }, s.EmployeeDetail.shape, async args => {
    const d = await load(); const employee = d.employees.find(e => e.id === args.employee_id); if (!employee) throw new Error("not_found");
    return { ...d.meta, employee, attendance: d.attendance.find(a => a.employee_id === employee.id), current_task: employee.current_task, tasks: d.tasks.filter(t => t.assignee_ids.includes(employee.id) && t.status !== "completata"), projects: d.projects.filter(p => p.assignee_ids.includes(employee.id)), history: d.history(employee.id) };
  });
  register("get_attendance", "Presenze operative per data (YYYY-MM-DD), oggi in Europe/Rome se omessa. Non contiene motivi di assenza.", { date: s.DateKey.optional() }, s.Attendances.shape, async args => { const now = new Date(); const d = await load(now, args.date); return { ...d.meta, date: args.date || d.meta.generated_at.slice(0, 10), employees: d.attendance }; });
  register("list_tasks", "Attività operative e stato aggiornato; testi approvati per la condivisione. due_before è una data esclusiva.", { employee_id: z.string().min(1).max(100).optional(), department_key: s.DepartmentKey.optional(), status: s.TaskStatus.optional(), due_before: s.DateKey.optional() }, s.Tasks.shape, async args => {
    const d = await load(); const ids = new Set(d.employees.filter(e => (!args.department_key || e.department_key === args.department_key) && (!args.employee_id || e.id === args.employee_id)).map(e => e.id));
    return { ...d.meta, tasks: d.tasks.filter(t => t.assignee_ids.some(id => ids.has(id)) && (!args.status || t.status === args.status) && (!args.due_before || (t.due_date && t.due_date < args.due_before))) };
  });
  register("list_projects", "Progetti disponibili nello Staff Hub. Al momento restituisce elenco vuoto con data_notes perché manca un archivio progetti.", { department_key: s.DepartmentKey.optional(), status: s.ProjectStatus.optional() }, s.Projects.shape, async args => { const d = await load(); return { ...d.meta, projects: d.projects.filter(p => (!args.department_key || p.department_key === args.department_key) && (!args.status || p.status === args.status)) }; });
  return server;
}
