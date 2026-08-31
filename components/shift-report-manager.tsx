"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, History, Loader2, MapPin, MessageSquareText, Save, Send, ShieldCheck, Sparkles, UserCheck, Users, XCircle } from "lucide-react";
import { emptyShiftReportData, shiftReportStatusLabel, type ShiftReportData } from "@/lib/shift-reports";
import { cn } from "@/lib/utils";

type ClientTimelineItem = {
  id: string; at: string; client: string; service: string; shopifyOrder: string;
  staff: string[]; notes: string[]; completedBy: string; detailUrl: string;
};
type AutomaticData = {
  generatedAt: string;
  totals: { expected: number; present: number; late: number; absent: number; clients: number };
  present: Array<{ id: string; name: string; time: string }>;
  late: Array<{ id: string; name: string; planned: string; actual: string; minutes: number; detail: string }>;
  absences: Array<{ id: string; name: string; schedule: string }>;
  openPauses: Array<{ id: string; name: string; since: string }>;
  pauseTimeline: Array<{ id: string; userId: string; name: string; start: string; end: string | null }>;
  clientTimeline: ClientTimelineItem[];
};
type Report = {
  id: string; date: string; status: string; report_data: ShiftReportData; automatic_data: AutomaticData;
  manager_notes: string | null; submitted_at: string | null; approved_at: string | null;
  location: { id: string; name: string }; responsible: { id: string; name: string; photo_url: string | null };
  approved_by: { id: string; name: string } | null;
  revisions: Array<{ id: string; action: string; status: string; note: string | null; created_at: string; actor: { name: string; role: string } }>;
};
type Product = { id: string; name: string; category: string | null; active: boolean };
type PageData = { day: string; manager: boolean; locations: Array<{ id: string; name: string }>; automatic: AutomaticData; report: Report | null; reports: Report[]; products: Product[] };

function localDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function currentRomeMinute(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  return part("hour") * 60 + part("minute");
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function dateTimeLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function statusTone(status: string) {
  if (status === "APPROVATO") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DA_CORREGGERE") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "DA_VERIFICARE") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function ShiftReportManager() {
  const [day, setDay] = useState(() => typeof window === "undefined" ? localDay() : new URLSearchParams(window.location.search).get("date") || localDay());
  const [locationId, setLocationId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("locationId") || "");
  const [data, setData] = useState<PageData | null>(null);
  const [form, setForm] = useState<ShiftReportData>(emptyShiftReportData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = async (nextDay = day, nextLocationId = locationId) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ date: nextDay });
      if (nextLocationId) query.set("locationId", nextLocationId);
      const response = await fetch(`/api/shift-reports?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossibile caricare il report");
      setData(result);
      if (!nextLocationId && result.locations[0]?.id) setLocationId(result.locations[0].id);
      setForm({ ...emptyShiftReportData, ...(result.report?.report_data || {}) });
      setManagerNote(result.report?.manager_notes || "");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Errore di caricamento" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(day, locationId); }, [day, locationId]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const report = data?.report ?? null;
  const automatic = (report?.automatic_data || data?.automatic) as AutomaticData | undefined;
  const editable = !data?.manager && (!report || report.status === "DRAFT" || report.status === "DA_CORREGGERE");
  const reportData = data?.manager && report ? report.report_data : form;
  const submitAvailable = day < localDay() || (day === localDay() && currentRomeMinute(new Date(clockTick)) >= 18 * 60 + 30);

  const submit = async (action: "SAVE" | "SUBMIT" | "APPROVE" | "REQUEST_CORRECTION") => {
    setSaving(action);
    setMessage(null);
    try {
      const response = await fetch("/api/shift-reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, date: day, reportId: report?.id, reportData: form, managerNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Operazione non completata");
      setMessage({ tone: "ok", text: action === "SAVE" ? "Bozza salvata." : action === "SUBMIT" ? "Report inviato allo Store Manager." : action === "APPROVE" ? "Report approvato definitivamente." : "Correzione richiesta al Responsabile." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Operazione non completata" });
    } finally {
      setSaving(null);
    }
  };

  const updateClientCheck = (id: string, patch: Partial<ShiftReportData["clientChecks"][string]>) => {
    setForm((current) => {
      const previous = current.clientChecks[id] ?? { status: "" as const, problem: "", solution: "", resolved: null, escalated: false, note: "" };
      return { ...current, clientChecks: { ...current.clientChecks, [id]: { ...previous, ...patch } } };
    });
  };

  const updateCheck = (key: keyof ShiftReportData["checks"], value: boolean) => {
    setForm((current) => ({ ...current, checks: { ...current.checks, [key]: value } }));
  };

  const markAllClientsOk = () => {
    if (!automatic?.clientTimeline) return;
    setForm((current) => ({
      ...current,
      clientChecks: Object.fromEntries(automatic.clientTimeline.map((client) => {
        const existing = current.clientChecks[client.id];
        return [client.id, existing?.status ? existing : { status: "OK" as const, problem: "", solution: "", resolved: true, escalated: false, note: "" }];
      })),
    }));
  };

  const toggleFinishedProduct = (product: Product) => {
    setForm((current) => {
      const selected = current.finishedProducts.some((item) => item.id === product.id);
      return { ...current, finishedProducts: selected ? current.finishedProducts.filter((item) => item.id !== product.id) : [...current.finishedProducts, { id: product.id, name: product.name }] };
    });
  };

  const updateCatalog = async (action: "CREATE_PRODUCT" | "TOGGLE_PRODUCT", productId?: string) => {
    setSaving(action);
    setMessage(null);
    try {
      const response = await fetch("/api/shift-reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, productId, name: productName, category: productCategory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Catalogo non aggiornato");
      setProductName("");
      setProductCategory("");
      setMessage({ tone: "ok", text: action === "CREATE_PRODUCT" ? "Prodotto aggiunto al catalogo." : "Disponibilità prodotto aggiornata." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Catalogo non aggiornato" });
    } finally {
      setSaving(null);
    }
  };

  const selectedReports = useMemo(() => data?.reports ?? [], [data?.reports]);

  return (
    <div className="space-y-3 pb-20 sm:space-y-5 sm:pb-24">
      <section className="overflow-hidden rounded-[20px] border border-black/5 bg-[#1d1921] text-white shadow-[0_20px_70px_rgba(43,24,35,0.16)] sm:rounded-[28px]">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:px-7 sm:py-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f49acd]">Responsabile di Turno</p>
            <h1 className="mt-1 text-xl font-black sm:mt-2 sm:text-3xl">Report della giornata</h1>
            <p className="mt-1 max-w-2xl text-xs text-white/55 sm:mt-2 sm:text-sm">Dati operativi, andamento clienti e verifica finale dello Store Manager.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 sm:py-2">
              <span className="block text-[9px] font-black uppercase tracking-wider text-white/40">Giorno</span>
              <input type="date" value={day} max={localDay()} onChange={(event) => setDay(event.target.value)} className="mt-1 bg-transparent text-xs font-black text-white outline-none" />
            </label>
            {data?.manager ? <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 sm:py-2">
              <span className="block text-[9px] font-black uppercase tracking-wider text-white/40">Sede</span>
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="mt-1 bg-[#1d1921] text-xs font-black text-white outline-none">
                {data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label> : null}
          </div>
        </div>
        {report ? <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-3 sm:px-7">
          <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black uppercase", statusTone(report.status))}>{shiftReportStatusLabel(report.status)}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase text-white/65">Turno {report.status === "DRAFT" || report.status === "DA_CORREGGERE" ? "attivo" : "chiuso"}</span>
          <span className="text-xs font-bold text-white/55">{report.responsible.name} · {report.location.name}</span>
          {report.approved_by ? <span className="ml-auto text-xs font-bold text-emerald-300">Approvato da {report.approved_by.name} · {dateTimeLabel(report.approved_at)}</span> : null}
        </div> : null}
      </section>

      {message ? <div className={cn("rounded-2xl border px-4 py-3 text-sm font-bold", message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>{message.text}</div> : null}
      {report?.status === "DA_CORREGGERE" && report.manager_notes ? <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="text-xs font-black uppercase">Correzione richiesta</p><p className="mt-1 text-sm font-semibold">{report.manager_notes}</p></div></div> : null}

      {loading ? <div className="grid min-h-64 place-items-center rounded-[28px] border border-black/5 bg-white"><Loader2 className="size-7 animate-spin text-[#e77fba]" /></div> : (
        <div className={cn("grid gap-3 sm:gap-5", data?.manager && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
          <div className="space-y-3 sm:space-y-5">
            {!data?.manager || report ? <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d95e9f] sm:text-[10px]">Presenze / ritardi</p>
              <h2 className="mt-0.5 text-lg font-black sm:text-xl">Dichiarazione del Responsabile</h2>
              <p className="mt-1 text-[10px] font-semibold text-black/40 sm:text-xs">Compila in base a quanto avvenuto nel turno. I dati automatici sotto servono solo come riscontro.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <YesNoSelect label="Tutti presenti" value={reportData.attendanceAllPresent ?? null} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, attendanceAllPresent: value }))} />
                <TextArea label="Ritardi — nome, orario e minuti" value={reportData.reportedLate || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, reportedLate: value }))} />
                <TextArea label="Assenze — nome ed eventuale motivo" value={reportData.reportedAbsences || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, reportedAbsences: value }))} />
              </div>
            </section> : null}

            {automatic ? <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d95e9f] sm:text-[10px]">Riscontro automatico</p><h2 className="mt-0.5 text-lg font-black sm:mt-1 sm:text-xl">Timbrature rilevate</h2></div><Sparkles className="size-4 text-[#e77fba] sm:size-5" /></div>
              <div className="mt-3 grid grid-cols-5 divide-x divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-[#fff9fc] sm:mt-4 sm:gap-2 sm:divide-x-0 sm:overflow-visible sm:border-0 sm:bg-transparent">
                {[{ label: "Previsti", value: automatic.totals.expected }, { label: "Presenti", value: automatic.totals.present }, { label: "Ritardi", value: automatic.totals.late }, { label: "Assenti", value: automatic.totals.absent }, { label: "Clienti", value: automatic.totals.clients }].map((metric) => <div key={metric.label} className="min-w-0 px-1 py-2 text-center sm:rounded-2xl sm:border sm:border-black/5 sm:bg-[#fff8fc] sm:p-3 sm:text-left"><p className="truncate text-[7px] font-black uppercase tracking-[-0.02em] text-black/40 sm:text-[9px] sm:tracking-normal">{metric.label}</p><p className="mt-0.5 text-lg font-black leading-none tabular-nums sm:mt-1 sm:text-2xl sm:leading-normal">{metric.value}</p></div>)}
              </div>
              <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
                <FactList title="Presenze" icon={<UserCheck className="size-4" />} items={automatic.present.map((item) => `${item.name} · ${item.time}`)} empty="Nessuna entrata" />
                <FactList title="Ritardi" icon={<Clock3 className="size-4" />} items={automatic.late.map((item) => `${item.name} · ${item.planned} → ${item.actual} · +${item.minutes} min`)} empty="Nessun ritardo" warning />
                <FactList title="Assenze" icon={<Users className="size-4" />} items={automatic.absences.map((item) => `${item.name}${item.schedule ? ` · ${item.schedule}` : ""}`)} empty="Nessuna assenza" warning />
              </div>
            </section> : null}

            {!data?.manager || report ? <>
              <section className="rounded-[20px] border border-black/5 bg-[#fbfaf7] p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <div className="border-b border-black/8 pb-2.5 sm:pb-4"><p className="font-serif text-[9px] font-bold uppercase tracking-[0.2em] text-black/45 sm:text-[11px] sm:tracking-[0.24em]">Standard del turno</p><h2 className="mt-0.5 font-serif text-xl font-semibold tracking-tight sm:mt-1 sm:text-2xl">Presentabilità e ordine</h2></div>
                <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-black/6 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d95e9f]">Presentabilità staff</p>
                    <div className="mt-2"><YesNoSelect label="Tutti conformi" value={reportData.checks?.staffPresentable ?? null} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, checks: { ...current.checks, clothingCompliant: value, staffPresentable: value } }))} /></div>
                    <div className="mt-2"><TextArea label="Eventuali note" value={reportData.staffPresentation || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, staffPresentation: value }))} /></div>
                  </div>
                  <div className="rounded-xl border border-black/6 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d95e9f]">Ordine / pulizia</p>
                    <div className="mt-2"><YesNoSelect label="Tutto in ordine" value={reportData.checks?.salonClean ?? null} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, checks: { ...current.checks, salonClean: value, stationsOrdered: value, commonAreasOrdered: value } }))} /></div>
                    <div className="mt-2"><TextArea label="Eventuali anomalie" value={reportData.cleanliness || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, cleanliness: value }))} /></div>
                  </div>
                </div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d95e9f]">Pause staff</p><h2 className="mt-1 text-xl font-black">Registro della giornata</h2>
                <div className="mt-3 space-y-2 sm:mt-4">{automatic?.pauseTimeline?.length ? automatic.pauseTimeline.map((pause, pauseIndex) => {
                  const pauseNumber = automatic.pauseTimeline.slice(0, pauseIndex + 1).filter((item) => item.userId === pause.userId).length;
                  const start = pause.start.slice(0, 5);
                  const end = pause.end?.slice(0, 5) || null;
                  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
                  const duration = end ? Math.max(0, toMinutes(end) - toMinutes(start)) : null;
                  return <div key={pause.id} className="grid gap-3 rounded-2xl border border-black/6 bg-[#fffafd] p-3 sm:grid-cols-[1.2fr_1fr_1.5fr] sm:items-center">
                    <div><p className="text-xs font-black">{pause.name}</p><span className="mt-1 inline-flex rounded-full bg-[#f6e7ef] px-2 py-0.5 text-[8px] font-black uppercase text-[#a94d7e]">Pausa {pauseNumber}</span></div>
                    <div><p className="text-xs font-black text-black/70">{start} → {end || "In corso"}</p><p className="mt-0.5 text-[9px] font-bold text-black/35">{duration === null ? "Pausa non conclusa" : `Durata ${duration} minuti`}</p></div>
                    <input disabled={!editable} value={reportData.pauseNotes?.[pause.id] || reportData.pauseNotes?.[pause.userId] || ""} onChange={(event) => setForm((current) => ({ ...current, pauseNotes: { ...current.pauseNotes, [pause.id]: event.target.value } }))} placeholder="Aggiungi una nota a questa pausa…" className="h-10 rounded-xl border border-black/8 bg-white px-3 text-[10px] font-semibold outline-none focus:border-[#e77fba] disabled:bg-transparent" />
                  </div>;
                }) : <p className="rounded-xl border border-dashed border-black/10 py-4 text-center text-[11px] font-semibold text-black/35 sm:rounded-2xl sm:py-6 sm:text-xs">Nessuna pausa registrata.</p>}</div>
                <div className="mt-3"><TextArea label="Note sulle pause" value={reportData.breaks || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, breaks: value }))} /></div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Materiali</p><h2 className="mt-1 text-xl font-black">Disponibilità e prodotti terminati</h2></div></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2"><YesNoSelect label="Tutto disponibile" value={reportData.checks?.materialsAvailable ?? null} disabled={!editable} onChange={(value) => updateCheck("materialsAvailable", value)} /><TextArea label="Materiali mancanti / in esaurimento" value={reportData.materials || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, materials: value }))} /></div>
                <p className="mt-3 text-xs font-semibold text-black/40">{editable ? "Seleziona i prodotti finiti durante il turno." : "Prodotti dichiarati terminati nel report."}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                  {data?.products.filter((product) => product.active || reportData.finishedProducts?.some((item) => item.id === product.id)).map((product) => {
                    const selected = reportData.finishedProducts?.some((item) => item.id === product.id);
                    return <button key={product.id} type="button" disabled={!editable} onClick={() => toggleFinishedProduct(product)} className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:cursor-default", selected ? "border-rose-300 bg-rose-50 text-rose-700" : "border-black/8 bg-[#fffafd] text-black/55")}><span className={cn("grid size-4 place-items-center rounded border", selected ? "border-rose-500 bg-rose-500 text-white" : "border-black/15 bg-white")}>{selected ? <Check className="size-3" /> : null}</span>{product.name}{product.category ? <small className="font-bold opacity-45">{product.category}</small> : null}</button>;
                  })}
                  {!data?.products.filter((product) => product.active || reportData.finishedProducts?.some((item) => item.id === product.id)).length ? <p className="text-xs font-semibold text-black/35">L’amministrazione non ha ancora inserito prodotti.</p> : null}
                </div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Riepilogo del Responsabile</p>
                <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-[1fr_180px] sm:gap-4">
                  <label><span className="text-xs font-black sm:text-sm">Com’è andata la giornata?</span><textarea disabled={!editable} value={reportData.daySummary} onChange={(event) => setForm((current) => ({ ...current, daySummary: event.target.value }))} rows={4} placeholder="Risultati, clima del team e fatti importanti…" className="mt-1.5 h-16 w-full resize-none rounded-xl border border-black/10 bg-[#fffafd] p-2.5 text-xs font-semibold outline-none focus:border-[#e77fba] disabled:opacity-70 sm:mt-2 sm:h-auto sm:rounded-2xl sm:p-3 sm:text-sm" /></label>
                  <label><span className="text-xs font-black sm:text-sm">Valutazione</span><select disabled={!editable} value={reportData.dayRating} onChange={(event) => setForm((current) => ({ ...current, dayRating: Number(event.target.value) }))} className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-[#fffafd] px-3 text-xs font-black outline-none disabled:opacity-70 sm:mt-2 sm:h-12 sm:rounded-2xl sm:text-sm">{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label>
                </div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-[#fde9f4] text-[#c64f90]"><MessageSquareText className="size-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Timeline clienti</p><h2 className="text-xl font-black">Com’è andata con ogni cliente?</h2></div></div>{editable && automatic?.clientTimeline.length ? <button type="button" onClick={markAllClientsOk} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black text-emerald-700"><CheckCircle2 className="size-4" /> Segna tutte: Tutto OK</button> : null}</div>
                {automatic?.clientTimeline.length ? <p className="mt-3 text-[10px] font-bold text-black/45">Verificate {automatic.clientTimeline.filter((client) => reportData.clientChecks?.[client.id]?.status).length} di {automatic.clientTimeline.length} clienti.</p> : null}
                <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
                  {automatic?.clientTimeline.length ? automatic.clientTimeline.map((client) => {
                    const storedCheck = reportData.clientChecks?.[client.id];
                    const check = {
                      status: storedCheck?.status ?? "" as const,
                      problem: storedCheck?.problem ?? "",
                      solution: storedCheck?.solution ?? "",
                      resolved: typeof storedCheck?.resolved === "boolean" ? storedCheck.resolved : null,
                      escalated: storedCheck?.escalated === true,
                      note: storedCheck?.note ?? "",
                    };
                    return <div key={client.id} className={cn("rounded-2xl border p-3", check.status === "PROBLEM" ? "border-rose-200 bg-rose-50/40" : check.status === "OK" ? "border-emerald-100 bg-emerald-50/20" : "border-amber-300 bg-amber-50/50 ring-2 ring-amber-100")}>
                      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black">{client.client}</p><p className="mt-0.5 text-[10px] font-bold text-black/45">{dateTimeLabel(client.at)}{client.service ? ` · ${client.service}` : ""}{client.shopifyOrder ? ` · Shopify ${client.shopifyOrder}` : ""}</p></div>{client.staff.length ? <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-black/55">{client.staff.join(", ")}</span> : null}</div>
                      {client.notes.length ? <div className="mt-2 rounded-xl border border-[#f1d8e5] bg-white px-3 py-2"><p className="text-[9px] font-black uppercase text-[#b14d82]">Note Shopify / Controllo Cliente</p>{client.notes.map((note, index) => <p key={index} className="mt-1 text-xs font-semibold text-black/65">{note}</p>)}</div> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[10px] font-black uppercase text-black/45">Esito:</span>
                        {(["OK", "PROBLEM"] as const).map((status) => <button key={status} type="button" disabled={!editable} onClick={() => updateClientCheck(client.id, { status })} className={cn("rounded-full border px-3 py-1.5 text-[10px] font-black transition disabled:cursor-default", check.status === status ? status === "OK" ? "border-emerald-500 bg-emerald-500 text-white" : "border-rose-500 bg-rose-500 text-white" : "border-black/10 bg-white text-black/50")}>{status === "OK" ? "Tutto OK" : "Problema"}</button>)}
                      </div>
                      {check.status === "PROBLEM" || check.problem || check.solution ? <div className="mt-2 grid gap-2 sm:grid-cols-3"><textarea disabled={!editable} value={check.problem} onChange={(event) => updateClientCheck(client.id, { problem: event.target.value })} rows={2} placeholder="Problema" className="w-full resize-none rounded-xl border border-rose-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-rose-400 disabled:bg-transparent" /><textarea disabled={!editable} value={check.solution} onChange={(event) => updateClientCheck(client.id, { solution: event.target.value })} rows={2} placeholder="Soluzione adottata" className="w-full resize-none rounded-xl border border-emerald-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-emerald-400 disabled:bg-transparent" /><YesNoSelect label="Risolto" value={check.resolved} disabled={!editable} onChange={(value) => updateClientCheck(client.id, { resolved: value })} /></div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" disabled={!editable} onClick={() => updateClientCheck(client.id, { escalated: !check.escalated })} className={cn("rounded-full border px-3 py-1.5 text-[9px] font-black uppercase", check.escalated ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/45")}>Escalation a Leydi {check.escalated ? "attiva" : "no"}</button></div>
                      {(editable || check.note) ? <textarea disabled={!editable} value={check.note} onChange={(event) => updateClientCheck(client.id, { note: event.target.value })} rows={2} placeholder="Nota finale facoltativa…" className="mt-2 w-full resize-none rounded-xl border border-black/8 bg-white p-2.5 text-xs font-semibold outline-none focus:border-[#e77fba] disabled:bg-transparent" /> : null}
                    </div>;
                  }) : <div className="rounded-xl border border-dashed border-black/10 py-5 text-center text-xs font-semibold text-black/35 sm:rounded-2xl sm:py-8 sm:text-sm">Nessun Controllo Cliente completato in questa giornata.</div>}
                </div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Servizi rifiutati / non eseguiti</p>
                <h2 className="mt-1 text-xl font-black">Dettaglio della decisione</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/55 sm:text-[10px]">Servizio</span><input disabled={!editable} value={reportData.refusedServices || ""} onChange={(event) => setForm((current) => ({ ...current, refusedServices: event.target.value }))} placeholder="Nessun servizio rifiutato" className="mt-1.5 h-11 w-full rounded-lg border border-black/8 bg-white px-3 text-[11px] font-semibold outline-none focus:border-[#e77fba] disabled:opacity-70 sm:rounded-xl sm:text-xs" /></label>
                  <TextArea label="Motivo" value={reportData.refusedServiceReason || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, refusedServiceReason: value }))} />
                  <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/55 sm:text-[10px]">Decisione presa da</span><select disabled={!editable} value={reportData.refusedServiceDecision || ""} onChange={(event) => setForm((current) => ({ ...current, refusedServiceDecision: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-black/8 bg-white px-3 text-[11px] font-semibold outline-none focus:border-[#e77fba] disabled:opacity-70 sm:rounded-xl sm:text-xs"><option value="">Seleziona</option><option value="Responsabile di turno">Responsabile di turno</option><option value="Leydi">Leydi</option>{automatic?.present.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label>
                </div>
              </section>

              <section className="rounded-[20px] border border-black/5 bg-[#1d1921] p-3 text-white shadow-xl sm:rounded-[28px] sm:p-6">
                <p className="font-serif text-[9px] font-bold uppercase tracking-[0.2em] text-[#f49acd] sm:text-[10px] sm:tracking-[0.24em]">Closing notes</p><h2 className="mt-0.5 font-serif text-xl font-semibold sm:mt-1 sm:text-2xl">Recap fine turno</h2>
                <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                  <TextArea dark label="Problematiche ancora aperte" value={reportData.openProblems || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, openProblems: value }))} />
                  <TextArea dark label="Situazioni da monitorare" value={reportData.monitorSituations || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, monitorSituations: value }))} />
                  <TextArea dark label="Task da creare" value={reportData.tasksToCreate || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, tasksToCreate: value }))} />
                  <TextArea dark label="Note per Leydi" value={reportData.notesForLeydi || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, notesForLeydi: value }))} />
                  <div className="sm:col-span-2"><TextArea dark label="Lavori complessi e supporto dato allo staff" value={reportData.complexWorkSupport || ""} disabled={!editable} onChange={(value) => setForm((current) => ({ ...current, complexWorkSupport: value }))} /></div>
                </div>
              </section>
            </> : <div className="rounded-[28px] border border-dashed border-black/10 bg-white py-20 text-center"><ShieldCheck className="mx-auto size-9 text-black/15" /><p className="mt-3 font-black">Nessun report inviato per questa sede e data.</p></div>}

            {editable ? <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-black/8 bg-white/90 p-3 shadow-xl backdrop-blur-xl"><p className="mr-auto text-[10px] font-bold text-black/40">Le modifiche restano in bozza finché non invii il report.</p><button type="button" onClick={() => void submit("SAVE")} disabled={Boolean(saving)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 px-4 text-xs font-black disabled:opacity-50">{saving === "SAVE" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salva modifiche</button>{submitAvailable ? <button type="button" onClick={() => setConfirmSubmitOpen(true)} disabled={Boolean(saving)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e77fba] px-5 text-xs font-black text-white shadow-lg disabled:opacity-50"><Send className="size-4" /> Invia report</button> : <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-[10px] font-black text-amber-800"><Clock3 className="size-4" /> Invio disponibile dalle 18:30</span>}</div> : null}

            {data?.manager && report?.status === "DA_VERIFICARE" ? <section className="rounded-[28px] border border-[#ead7e2] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="size-6 text-[#d95e9f]" /><div><h2 className="text-lg font-black">Verifica Store Manager</h2><p className="text-xs font-semibold text-black/45">L’approvazione rende il report definitivo per KPI e analisi.</p></div></div><label className="mt-4 block text-xs font-black">Note Store Manager<textarea value={managerNote} onChange={(event) => setManagerNote(event.target.value)} rows={4} placeholder="Nota facoltativa per l’approvazione, obbligatoria se richiedi correzioni…" className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-[#fffafd] p-3 text-sm font-semibold outline-none focus:border-[#e77fba]" /></label><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void submit("REQUEST_CORRECTION")} disabled={Boolean(saving)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle className="size-4" /> Richiedi correzione</button><button type="button" onClick={() => void submit("APPROVE")} disabled={Boolean(saving)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white shadow-lg disabled:opacity-50"><CheckCircle2 className="size-4" /> Approva report</button></div></section> : null}

            {report?.revisions?.length ? <section className="rounded-[28px] border border-black/5 bg-white p-5"><div className="flex items-center gap-2"><History className="size-5 text-[#d95e9f]" /><h2 className="font-black">Storico verifiche</h2></div><div className="mt-4 space-y-3">{report.revisions.map((revision) => <div key={revision.id} className="flex gap-3 border-l-2 border-[#f2c9df] pl-3"><div className="min-w-0 flex-1"><p className="text-xs font-black">{revision.actor.name} · {shiftReportStatusLabel(revision.status)}</p><p className="mt-0.5 text-[10px] font-bold text-black/40">{dateTimeLabel(revision.created_at)} · {revision.action.replaceAll("_", " ")}</p>{revision.note ? <p className="mt-1 text-xs font-semibold text-black/65">{revision.note}</p> : null}</div></div>)}</div></section> : null}
          </div>

          {data?.manager ? <aside className="h-fit space-y-4 xl:sticky xl:top-5">
            <section className="rounded-[28px] border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Catalogo prodotti</p>
              <p className="mt-1 text-xs font-semibold text-black/40">Crea la lista usata dai Responsabili.</p>
              <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Nome prodotto" className="mt-3 h-10 w-full rounded-xl border border-black/10 px-3 text-xs font-bold outline-none focus:border-[#e77fba]" />
              <input value={productCategory} onChange={(event) => setProductCategory(event.target.value)} placeholder="Categoria (facoltativa)" className="mt-2 h-10 w-full rounded-xl border border-black/10 px-3 text-xs font-bold outline-none focus:border-[#e77fba]" />
              <button type="button" disabled={!productName.trim() || Boolean(saving)} onClick={() => void updateCatalog("CREATE_PRODUCT")} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#e77fba] px-3 text-xs font-black text-white disabled:opacity-50">{saving === "CREATE_PRODUCT" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Aggiungi prodotto</button>
              <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">{data.products.map((product) => <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/6 px-2.5 py-2"><div className="min-w-0"><p className={cn("truncate text-[11px] font-black", !product.active && "line-through opacity-40")}>{product.name}</p>{product.category ? <p className="text-[9px] font-semibold text-black/35">{product.category}</p> : null}</div><button type="button" onClick={() => void updateCatalog("TOGGLE_PRODUCT", product.id)} disabled={Boolean(saving)} className={cn("rounded-full px-2 py-1 text-[8px] font-black uppercase", product.active ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>{product.active ? "Disattiva" : "Riattiva"}</button></div>)}</div>
            </section>
            <section className="rounded-[28px] border border-black/5 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d95e9f]">Elenco report</p><div className="mt-3 space-y-2">{selectedReports.map((item) => <button key={item.id} type="button" onClick={() => { setDay(item.date.slice(0, 10)); setLocationId(item.location.id); }} className={cn("w-full rounded-2xl border p-3 text-left transition", report?.id === item.id ? "border-[#e77fba] bg-[#fff2f9]" : "border-black/6 hover:border-[#e77fba]/40")}><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black">{item.location.name}</p><p className="mt-0.5 text-[10px] font-semibold text-black/45">{dateLabel(item.date)} · {item.responsible.name}</p></div><ChevronRight className="size-4 text-black/25" /></div><span className={cn("mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase", statusTone(item.status))}>{shiftReportStatusLabel(item.status)}</span></button>)}{!selectedReports.length ? <p className="py-8 text-center text-xs font-semibold text-black/35">Nessun report disponibile.</p> : null}</div></section>
          </aside> : null}
        </div>
      )}
      {confirmSubmitOpen ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-shift-report-title"><div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#fbfaf7] shadow-[0_30px_100px_rgba(0,0,0,0.4)]"><div className="border-b border-black/8 px-6 py-5"><p className="font-serif text-[10px] font-bold uppercase tracking-[0.22em] text-[#b44f84]">Chiusura del turno</p><h2 id="confirm-shift-report-title" className="mt-2 font-serif text-2xl font-semibold">Sei sicura di voler inviare?</h2></div><div className="px-6 py-5"><p className="text-sm font-semibold leading-relaxed text-black/60">Controlla che clienti, pause, prodotti, anomalie e recap siano completi. Dopo l’invio il report passerà allo Store Manager e non potrai modificarlo, salvo richiesta di correzione.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmSubmitOpen(false)} disabled={Boolean(saving)} className="min-h-12 rounded-xl border border-black/10 bg-white text-xs font-black">Torna al report</button><button type="button" onClick={() => { setConfirmSubmitOpen(false); void submit("SUBMIT"); }} disabled={Boolean(saving)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black text-xs font-black text-white"><Send className="size-4" /> Sì, invia</button></div></div></div></div> : null}
    </div>
  );
}

function FactList({ title, icon, items, empty, warning = false }: { title: string; icon: React.ReactNode; items: string[]; empty: string; warning?: boolean }) {
  return <div className={cn("rounded-xl border p-2.5 sm:rounded-2xl sm:p-3", warning && items.length ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white")}><div className="flex items-center gap-1.5 text-[11px] font-black sm:gap-2 sm:text-xs">{icon}{title}</div><div className="mt-1.5 space-y-0.5 sm:mt-2 sm:space-y-1">{items.length ? items.map((item, index) => <p key={`${item}-${index}`} className="text-[9px] font-bold text-black/60 sm:text-[10px]">{item}</p>) : <p className="text-[9px] font-semibold text-black/30 sm:text-[10px]">{empty}</p>}</div></div>;
}

function YesNoSelect({ label, value, disabled, onChange }: { label: string; value: boolean | null; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/55 sm:text-[10px]">{label}</span><select disabled={disabled} value={value === null ? "" : value ? "YES" : "NO"} onChange={(event) => onChange(event.target.value === "YES")} className="mt-1.5 h-11 w-full rounded-lg border border-black/8 bg-white px-3 text-[11px] font-black outline-none focus:border-[#e77fba] disabled:opacity-70 sm:rounded-xl sm:text-xs"><option value="">Seleziona</option><option value="YES">Sì</option><option value="NO">No</option></select></label>;
}

function TextArea({ label, value, disabled, onChange, dark = false }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; dark?: boolean }) {
  return <label className="block"><span className={cn("text-[9px] font-black uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.12em]", dark ? "text-white/55" : "text-black/55")}>{label}</span><textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder="Nessuna segnalazione" className={cn("mt-1.5 h-14 w-full resize-none rounded-lg border p-2 text-[11px] font-semibold outline-none disabled:opacity-70 sm:mt-2 sm:h-auto sm:rounded-xl sm:p-3 sm:text-xs", dark ? "border-white/10 bg-white/5 text-white placeholder:text-white/20 focus:border-[#f49acd]" : "border-black/8 bg-white text-black focus:border-black/30")} /></label>;
}
