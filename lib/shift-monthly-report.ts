import { activeShiftFollowUps, type ShiftResponsibleAnswers, type ShiftResponsibleQuestion } from "./shift-responsible-questions";
import { resolveCanonicalStaffName } from "./client-control-normalize";

export type ReportPeriod = { month: string; firstDay: string; lastDay: string; partial: boolean };
export function reportPeriods(month: string, today: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 2020 || month > today.slice(0, 7)) throw new Error("Mese non valido");
  const [year, m] = month.split("-").map(Number);
  const previous = new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7);
  const partial = month === today.slice(0, 7);
  const period = (key: string): ReportPeriod => {
    const [y, n] = key.split("-").map(Number);
    const days = new Date(Date.UTC(y, n, 0)).getUTCDate();
    const last = partial ? Math.min(Number(today.slice(8, 10)), days) : days;
    return { month: key, firstDay: `${key}-01`, lastDay: `${key}-${String(last).padStart(2, "0")}`, partial };
  };
  return { current: period(month), previous: period(previous) };
}
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function parse(value?: string) { try { return record(JSON.parse(value || "")); } catch { return {}; } }
const inPeriod = (day: string, period: ReportPeriod) => day >= period.firstDay && day <= period.lastDay;
export function summarizeShiftMonth(questions: ShiftResponsibleQuestion[], answers: ShiftResponsibleAnswers, period: ReportPeriod) {
  const days = Object.entries(answers).filter(([day, values]) => inPeriod(day, period) && Object.keys(values).length > 0).sort(([a], [b]) => a.localeCompare(b));
  const required = questions.filter(q => q.required !== false);
  const staff = new Map<string, { name: string; question: string; control: string; yes: number; no: number; unselected: number; days: Set<string> }>();
  const questionStats = questions.map(q => {
    let answered = 0, complete = 0, yes = 0, no = 0, structured = 0, entries = 0;
    const ratings: number[] = [];
    for (const [day, values] of days) {
      const value = values[q.id];
      if (!value) continue;
      answered++;
      if (activeShiftFollowUps(q, value).every(f => Boolean(values[`${q.id}::${f.key}`]?.trim()))) complete++;
      if (value === "YES") yes++;
      if (value === "NO") no++;
      if (["RATING", "LINEAR_SCALE"].includes(q.answerType) && Number.isFinite(Number(value)) && Number(value) >= (q.scaleMin ?? 1) && Number(value) <= (q.scaleMax ?? 5)) ratings.push(Number(value));
      const data = parse(value);
      if (Object.keys(data).length) structured++;
      for (const field of ["clientNotes", "timelineEntries", "staffNotes", "textEntries"]) {
        if (Array.isArray(data[field])) entries += (data[field] as unknown[]).filter(item => {
          const r = record(item); return Boolean(String(r.note ?? r.value ?? "").trim());
        }).length;
      }
      if (typeof data.taskId === "string" && data.taskId) entries++;
      if (Array.isArray(data.staffChecks)) for (const raw of data.staffChecks) {
        const person = record(raw); const name = String(person.name || "Senza nome");
        for (const [control, result] of Object.entries(record(person.responses))) {
          if (!["YES", "NO", "CHECKED", "UNCHECKED"].includes(String(result))) continue;
          const key = JSON.stringify([person.staffId || name, q.id, control]);
          const row = staff.get(key) || { name, question: q.title, control, yes: 0, no: 0, unselected: 0, days: new Set<string>() };
          row.days.add(day);
          if (result === "YES" || result === "CHECKED") row.yes++;
          else if (result === "UNCHECKED" || q.staffResponseMode === "CHECKBOXES") row.unselected++;
          else row.no++;
          staff.set(key, row);
        }
      }
    }
    return { id: q.id, title: q.title, required: q.required !== false, answered, complete, missing: days.length - answered, yes, no, structured, entries, rating: ratings.length ? ratings.reduce((a,b) => a+b,0)/ratings.length : null, ratingCount: ratings.length };
  });
  const daily = days.map(([day, values]) => ({ day, completed: required.filter(q => values[q.id] && activeShiftFollowUps(q,values[q.id]).every(f => Boolean(values[`${q.id}::${f.key}`]?.trim()))).length, total: required.length }));
  const denominator = days.length * required.length;
  const completion = denominator ? daily.reduce((sum,d) => sum+d.completed,0)/denominator*100 : null;
  const known = new Set(questions.map(q=>q.id));
  const legacyQuestions = new Set(days.flatMap(([,values])=>Object.keys(values).map(k=>k.split("::")[0]).filter(k=>!known.has(k)))).size;
  return { days: days.length, completion, questionStats, daily, legacyQuestions, staff: Array.from(staff.values()).map(r=>({...r,days:r.days.size})).sort((a,b)=>a.name.localeCompare(b.name)||a.question.localeCompare(b.question)||a.control.localeCompare(b.control)) };
}
export type ClientReportRow = { id: string; createdAt: string; answers: unknown; locationName: string | null };
export function summarizeClientMonth(rows: ClientReportRow[], names: string[], period: ReportPeriod) {
  const seen = new Set<string>(); let total = 0, excluded = 0;
  const salons = new Map<string, number>();
  const staff = new Map<string, { name: string; salon: string; services: number }>();
  for (const row of rows) {
    const instant = new Date(row.createdAt);
    if (!Number.isFinite(instant.getTime())) continue;
    const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(instant);
    if (!inPeriod(day,period) || seen.has(row.id)) continue;
    seen.add(row.id);
    const a = record(row.answers);
    if (["errore","finito"].includes(String(a.client_control_correctness||"").trim().toLowerCase())) { excluded++; continue; }
    const salon = String(a.client_control_location || row.locationName || "Senza sede").trim();
    const list = (v: unknown): string[] => (Array.isArray(v) ? v : String(v||"").split(/[,;]+/)).map(String).map(n=>n.trim()).filter(Boolean);
    const selected = list(a.client_control_service_staff), owner = list(a.client_control_service_owner);
    const workers = new Set((selected.length ? selected : owner.length ? owner : ["Senza responsabile"]).map(n=>resolveCanonicalStaffName(n,names)));
    total++;salons.set(salon,(salons.get(salon)||0)+1);
    for (const name of workers) {
      const key=JSON.stringify([salon,name]); const r=staff.get(key)||{name,salon,services:0};r.services++;staff.set(key,r);
    }
  }
  return { total, excluded, salons:Array.from(salons,([name,total])=>({name,total})), staff:Array.from(staff.values()).sort((a,b)=>b.services-a.services||a.name.localeCompare(b.name)) };
}
export type MonthlyShiftReport = {
  generatedAt: string; current: ReportPeriod; previous: ReportPeriod;
  shifts: ReturnType<typeof summarizeShiftMonth>; previousShifts: ReturnType<typeof summarizeShiftMonth>;
  clients: ReturnType<typeof summarizeClientMonth>; previousClients: ReturnType<typeof summarizeClientMonth>;
};
