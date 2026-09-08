"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, CheckCircle2, ClipboardCheck, Clock3, MessageCircle, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { END_OF_DAY_CHANNELS, END_OF_DAY_CONFIRMATIONS, END_OF_DAY_COUNT_FIELDS, endOfDayAnomalyCount } from "@/lib/end-of-day-checklist";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Person = { id: string; name: string; photoUrl: string | null };
type ChecklistComment = { id: string; body: string; createdAt: string; author: Person };
type ChecklistEntry = {
  id: string;
  operationalDate: string;
  counts: Record<string, number>;
  channels: Record<string, boolean>;
  confirmations: Record<string, "YES" | "NO">;
  confirmationNotes: Record<string, string>;
  notes: string;
  operatorOneName: string;
  operatorTwoName: string;
  managerName: string;
  submittedAt: string;
  updatedAt: string;
  submittedBy: Person;
  comments: ChecklistComment[];
};

function todayInRome() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function formatDay(day: string, weekday = false) {
  return new Intl.DateTimeFormat("it-IT", { weekday: weekday ? "long" : undefined, day: "numeric", month: "long", year: "numeric" }).format(new Date(`${day}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function Avatar({ person, size = "size-9" }: { person: Person; size?: string }) {
  const photo = resolveDrivePhotoUrl(person.photoUrl || "");
  return <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#FCE5F3] text-[10px] font-black text-[#B83D7F] ring-1 ring-[#F3B5D4]`}>{photo ? <img src={photo} alt={person.name} className="size-full object-cover" /> : initials(person.name)}</span>;
}

function emptyDraft(viewerName: string) {
  return {
    date: todayInRome(),
    counts: Object.fromEntries(END_OF_DAY_COUNT_FIELDS.map((field) => [field.key, 0])) as Record<string, number>,
    channels: Object.fromEntries(END_OF_DAY_CHANNELS.map((channel) => [channel.key, false])) as Record<string, boolean>,
    confirmations: {} as Record<string, "YES" | "NO">,
    confirmationNotes: {} as Record<string, string>,
    notes: "",
    operatorOneName: "",
    operatorTwoName: "",
    managerName: viewerName,
  };
}

export function EndOfDayChecklistClient({ initialEntries, initialEntryId, viewer }: { initialEntries: ChecklistEntry[]; initialEntryId: string | null; viewer: Person }) {
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState(() => emptyDraft(viewer.name));
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initialEntryId);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const today = todayInRome();
  const todayEntry = entries.find((entry) => entry.operationalDate === today);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const totalComments = entries.reduce((sum, entry) => sum + entry.comments.length, 0);
  const entriesWithAnomalies = entries.filter((entry) => endOfDayAnomalyCount(entry) > 0).length;
  const completedChannels = Object.values(draft.channels).filter(Boolean).length;
  const completedConfirmations = Object.keys(draft.confirmations).length;
  const progress = Math.round(((completedChannels + completedConfirmations) / (END_OF_DAY_CHANNELS.length + END_OF_DAY_CONFIRMATIONS.length)) * 100);

  useEffect(() => {
    const modalOpen = formOpen || Boolean(selected);
    document.body.style.overflow = modalOpen ? "hidden" : "";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (selected) setSelectedId(null);
      else setFormOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [formOpen, selected]);

  function openForm(entry?: ChecklistEntry) {
    setStatus("");
    setDraft(entry ? {
      date: entry.operationalDate,
      counts: { ...entry.counts },
      channels: { ...entry.channels },
      confirmations: { ...entry.confirmations },
      confirmationNotes: { ...entry.confirmationNotes },
      notes: entry.notes,
      operatorOneName: entry.operatorOneName,
      operatorTwoName: entry.operatorTwoName,
      managerName: entry.managerName,
    } : emptyDraft(viewer.name));
    setFormOpen(true);
  }

  async function submitChecklist(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/end-of-day-checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SAVE", ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checklist non salvata.");
      const entry = normalizeApiEntry(data.entry);
      setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort((a, b) => b.operationalDate.localeCompare(a.operationalDate)));
      setFormOpen(false);
      setSelectedId(entry.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checklist non salvata.");
    } finally {
      setSaving(false);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    setCommenting(true);
    setStatus("");
    try {
      const response = await fetch("/api/end-of-day-checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMMENT", checklistId: selected.id, body: comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Commento non inviato.");
      const savedComment: ChecklistComment = { id: data.comment.id, body: data.comment.body, createdAt: data.comment.created_at, author: { id: data.comment.author.id, name: data.comment.author.name, photoUrl: data.comment.author.photo_url ?? null } };
      setEntries((current) => current.map((entry) => entry.id === selected.id ? { ...entry, comments: [...entry.comments, savedComment] } : entry));
      setComment("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Commento non inviato.");
    } finally {
      setCommenting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#F3B5D4]/70 bg-[linear-gradient(135deg,#FFF9FC_0%,#FCE5F3_55%,#F8D6E7_100%)] p-5 shadow-[0_24px_70px_rgba(121,51,85,0.12)] sm:p-7">
        <div className="absolute -right-16 -top-16 size-52 rounded-full bg-white/50 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#A93C73] shadow-sm"><Sparkles className="size-3.5" />Assistenza Clienti</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#281B22] sm:text-4xl">Checklist di fine giornata</h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#6E5361]">Registra i dati rilevati dai sistemi, conferma i controlli e lascia un passaggio di consegne chiaro agli altri amministratori.</p>
          </div>
          <button type="button" onClick={() => openForm(todayEntry)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#C84F89] px-6 text-sm font-black text-white shadow-[0_12px_30px_rgba(184,61,127,0.28)] transition hover:-translate-y-0.5 hover:bg-[#B83D7F] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D96B94]/30">
            <ClipboardCheck className="size-5" />{todayEntry ? "Aggiorna la giornata" : "Compila fine giornata"}
          </button>
        </div>
      </section>

      {status && !formOpen && !selected ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{status}</p> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<CheckCircle2 className="size-5" />} label="Oggi" value={todayEntry ? "Completata" : "Da compilare"} detail={todayEntry ? `Aggiornata alle ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(todayEntry.updatedAt))}` : "Nessuna checklist salvata"} tone={todayEntry ? "green" : "pink"} />
        <SummaryCard icon={<AlertTriangle className="size-5" />} label="Con anomalie" value={String(entriesWithAnomalies)} detail="nelle ultime 90 giornate" tone="amber" />
        <SummaryCard icon={<MessageCircle className="size-5" />} label="Commenti" value={String(totalComments)} detail="condivisi tra amministratori" tone="pink" />
      </section>

      <section className="rounded-[26px] border border-[#F1E1E8] bg-white p-4 shadow-[0_14px_45px_rgba(87,51,68,0.06)] sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] pb-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B83D7F]">Archivio amministrativo</p><h2 className="mt-1 text-xl font-black text-[#281B22]">Giornate registrate</h2></div>
          <span className="rounded-full bg-[#FFF0F7] px-3 py-1.5 text-xs font-black text-[#B83D7F]">{entries.length}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {entries.length ? entries.map((entry) => {
            const anomalies = endOfDayAnomalyCount(entry);
            return <button key={entry.id} type="button" onClick={() => setSelectedId(entry.id)} className="group rounded-[22px] border border-black/[0.07] bg-[#FCFAFB] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#ECA6C9] hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D96B94]/20">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Avatar person={entry.submittedBy} /><div><p className="text-sm font-black capitalize text-[#281B22]">{formatDay(entry.operationalDate, true)}</p><p className="mt-0.5 text-[10px] font-semibold text-neutral-400">Compilata da {entry.submittedBy.name}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${anomalies ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{anomalies ? `${anomalies} anomalie` : "Completa"}</span></div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/[0.05] pt-3 text-[10px] font-bold text-neutral-500"><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{formatDateTime(entry.updatedAt)}</span><span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" />{entry.comments.length} commenti</span><span className="ml-auto text-[#B83D7F] transition group-hover:translate-x-0.5">Apri dettaglio →</span></div>
            </button>;
          }) : <div className="rounded-[22px] border border-dashed border-black/10 p-10 text-center lg:col-span-2"><ClipboardCheck className="mx-auto size-8 text-[#D96B94]" /><p className="mt-3 text-sm font-bold text-neutral-600">Nessuna giornata registrata</p><p className="mt-1 text-xs text-neutral-400">La prima checklist comparirà qui dopo il salvataggio.</p></div>}
        </div>
      </section>

      {formOpen ? createPortal(<ChecklistFormModal draft={draft} setDraft={setDraft} progress={progress} saving={saving} status={status} onClose={() => setFormOpen(false)} onSubmit={submitChecklist} />, document.body) : null}
      {selected ? createPortal(<ChecklistDetailModal entry={selected} status={status} comment={comment} commenting={commenting} onCommentChange={setComment} onComment={submitComment} onEdit={() => { setSelectedId(null); openForm(selected); }} onClose={() => { setSelectedId(null); setStatus(""); }} />, document.body) : null}
    </div>
  );
}

function SummaryCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "green" | "amber" | "pink" }) {
  const colors = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-[#FFF0F7] text-[#B83D7F]";
  return <article className="rounded-[22px] border border-black/[0.06] bg-white p-4 shadow-sm"><div className={`grid size-10 place-items-center rounded-2xl ${colors}`}>{icon}</div><p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">{label}</p><p className="mt-1 text-xl font-black text-[#281B22]">{value}</p><p className="mt-1 text-[11px] font-medium text-neutral-400">{detail}</p></article>;
}

function ChecklistFormModal({ draft, setDraft, progress, saving, status, onClose, onSubmit }: { draft: ReturnType<typeof emptyDraft>; setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyDraft>>>; progress: number; saving: boolean; status: string; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-[9999] bg-[#FDF9FB]" role="dialog" aria-modal="true" aria-label="Compila checklist di fine giornata">
    <form onSubmit={onSubmit} className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-black/[0.08] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex max-w-6xl items-center gap-4"><button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full bg-black/[0.05] text-neutral-700" aria-label="Chiudi"><X className="size-5" /></button><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#B83D7F]">Assistenza Clienti</p><h2 className="truncate text-lg font-black text-[#281B22]">Checklist di fine giornata</h2></div><div className="hidden items-center gap-3 sm:flex"><span className="text-xs font-black text-[#B83D7F]">{progress}%</span><div className="h-2 w-32 overflow-hidden rounded-full bg-[#F4E3EA]"><div className="h-full rounded-full bg-[#D96B94] transition-all" style={{ width: `${progress}%` }} /></div></div></div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7 sm:py-8"><div className="mx-auto max-w-6xl space-y-7">
        <div className="grid gap-4 rounded-[24px] border border-[#F3B5D4] bg-[#FFF5FA] p-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-xs font-black uppercase tracking-wider text-[#A93C73]">Data della compilazione</p><p className="mt-1 text-xs text-[#806270]">Una sola checklist per giornata. Puoi aggiornare quella già salvata.</p></div><input type="date" max={todayInRome()} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required className="min-h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-bold" /></div>
        <FormSection number="01" title="Numeri rilevati dai sistemi" subtitle="Inserisci i valori reali mostrati dai sistemi, non a memoria."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{END_OF_DAY_COUNT_FIELDS.map((field) => <label key={field.key} className="rounded-2xl border border-black/[0.07] bg-[#FCFAFB] p-3"><span className="block min-h-8 text-[10px] font-black uppercase leading-4 text-neutral-500">{field.label}</span><input type="number" min={0} max={99999} required value={draft.counts[field.key]} onChange={(event) => setDraft((current) => ({ ...current, counts: { ...current.counts, [field.key]: Number(event.target.value) } }))} className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-xl font-black text-[#281B22] outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20" /></label>)}</div></FormSection>
        <FormSection number="02" title="Canali controllati e verificati oggi" subtitle="Spunta ogni canale dopo aver concluso il controllo."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{END_OF_DAY_CHANNELS.map((channel) => { const checked = draft.channels[channel.key]; return <label key={channel.key} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${checked ? "border-emerald-300 bg-emerald-50" : "border-black/[0.08] bg-white hover:border-[#ECA6C9]"}`}><input type="checkbox" checked={checked} onChange={(event) => setDraft((current) => ({ ...current, channels: { ...current.channels, [channel.key]: event.target.checked } }))} className="sr-only" /><span className={`grid size-7 place-items-center rounded-full ${checked ? "bg-emerald-500 text-white" : "bg-neutral-100 text-transparent"}`}><Check className="size-4" /></span><span className="text-sm font-bold text-[#382B32]">{channel.label}</span></label>; })}</div><p className="mt-4 rounded-2xl bg-[#FFF4D9] px-4 py-3 text-xs font-medium leading-5 text-[#795A13]"><strong>PayMeGPT:</strong> ogni conversazione non gestita dal bot deve avere la riga corrispondente nel registro. Se manca, inseriscila a mano e comunica il numero di pratica.</p></FormSection>
        <FormSection number="03" title="Conferme" subtitle="Se scegli NO, descrivi subito il problema e l’azione svolta."><div className="space-y-4">{END_OF_DAY_CONFIRMATIONS.map((confirmation, index) => { const answer = draft.confirmations[confirmation.key]; return <article key={confirmation.key} className="rounded-[20px] border border-black/[0.07] bg-[#FCFAFB] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#FCE5F3] text-[10px] font-black text-[#B83D7F]">{index + 1}</span><p className="pt-1 text-sm font-bold leading-5 text-[#382B32]">{confirmation.label}</p></div><div className="grid grid-cols-2 gap-2 sm:w-44">{(["YES", "NO"] as const).map((value) => <button key={value} type="button" onClick={() => setDraft((current) => ({ ...current, confirmations: { ...current.confirmations, [confirmation.key]: value }, confirmationNotes: value === "YES" ? { ...current.confirmationNotes, [confirmation.key]: "" } : current.confirmationNotes }))} aria-pressed={answer === value} className={`min-h-11 rounded-xl border text-xs font-black ${answer === value ? value === "YES" ? "border-emerald-500 bg-emerald-500 text-white" : "border-rose-500 bg-rose-500 text-white" : "border-black/10 bg-white text-neutral-500"}`}>{value === "YES" ? "SÌ" : "NO"}</button>)}</div></div>{answer === "NO" ? <textarea required maxLength={1200} rows={3} value={draft.confirmationNotes[confirmation.key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, confirmationNotes: { ...current.confirmationNotes, [confirmation.key]: event.target.value } }))} placeholder="Che cosa non è stato completato? Perché? Quale azione è stata svolta?" className="mt-4 w-full resize-y rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200" /> : null}</article>; })}</div></FormSection>
        <FormSection number="04" title="Note sulla giornata" subtitle="Obbligatorie se un canale non è stato controllato o una conferma è NO."><textarea maxLength={4000} rows={5} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Scrivi che cosa è successo, perché e che cosa deve sapere chi prosegue il lavoro…" className="w-full resize-y rounded-2xl border border-black/10 bg-[#FCFAFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20" /></FormSection>
        <FormSection number="05" title="Presa visione e accettazione" subtitle="La checklist è unica: inserisci i nomi delle due addette e del responsabile che la verifica."><div className="grid gap-3 md:grid-cols-3"><NameField label="Prima addetta" value={draft.operatorOneName} onChange={(value) => setDraft((current) => ({ ...current, operatorOneName: value }))} /><NameField label="Seconda addetta" value={draft.operatorTwoName} onChange={(value) => setDraft((current) => ({ ...current, operatorTwoName: value }))} /><NameField label="Vista responsabile" value={draft.managerName} onChange={(value) => setDraft((current) => ({ ...current, managerName: value }))} /></div></FormSection>
        {status ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{status}</p> : null}
      </div></main>
      <footer className="shrink-0 border-t border-black/[0.08] bg-white px-4 py-3 sm:px-7"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><p className="hidden text-xs font-semibold text-neutral-400 sm:block">Gli altri amministratori riceveranno una notifica.</p><div className="ml-auto flex gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-black/10 bg-white px-5 text-sm font-bold text-neutral-600">Annulla</button><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#C84F89] px-5 text-sm font-black text-white disabled:opacity-50"><ShieldCheck className="size-4" />{saving ? "Salvataggio…" : "Salva e notifica"}</button></div></div></footer>
    </form>
  </div>;
}

function FormSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-[26px] border border-black/[0.07] bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[#FCE5F3] text-[10px] font-black text-[#B83D7F]">{number}</span><div><h3 className="text-base font-black text-[#281B22]">{title}</h3><p className="mt-1 text-xs leading-5 text-neutral-400">{subtitle}</p></div></div>{children}</section>;
}

function NameField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</span><input required maxLength={120} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Nome e cognome" className="min-h-11 w-full rounded-2xl border border-black/10 bg-[#FCFAFB] px-4 text-sm font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20" /></label>;
}

function ChecklistDetailModal({ entry, status, comment, commenting, onCommentChange, onComment, onEdit, onClose }: { entry: ChecklistEntry; status: string; comment: string; commenting: boolean; onCommentChange: (value: string) => void; onComment: (event: FormEvent) => void; onEdit: () => void; onClose: () => void }) {
  const anomalies = endOfDayAnomalyCount(entry);
  return <div className="fixed inset-0 z-[9999] flex flex-col bg-[#FDF9FB]" role="dialog" aria-modal="true" aria-label={`Dettaglio fine giornata ${formatDay(entry.operationalDate)}`}>
    <header className="shrink-0 border-b border-black/[0.08] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-7"><div className="mx-auto flex max-w-6xl items-center gap-4"><button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full bg-black/[0.05]" aria-label="Chiudi"><X className="size-5" /></button><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#B83D7F]">Fine giornata</p><h2 className="truncate text-lg font-black capitalize text-[#281B22]">{formatDay(entry.operationalDate, true)}</h2></div><button type="button" onClick={onEdit} className="min-h-10 rounded-2xl border border-[#F3B5D4] bg-[#FFF5FA] px-4 text-xs font-black text-[#B83D7F]">Modifica</button></div></header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7"><div className="mx-auto grid max-w-6xl gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <section className="rounded-[24px] border border-black/[0.07] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar person={entry.submittedBy} size="size-11" /><div><p className="text-sm font-black text-[#281B22]">{entry.submittedBy.name}</p><p className="text-[10px] text-neutral-400">Ultimo salvataggio {formatDateTime(entry.updatedAt)}</p></div></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${anomalies ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{anomalies ? `${anomalies} anomalie` : "Tutto completato"}</span></div></section>
        <DetailSection title="Numeri rilevati"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{END_OF_DAY_COUNT_FIELDS.map((field) => <div key={field.key} className="rounded-2xl bg-[#FCFAFB] p-3"><p className="text-[9px] font-black uppercase leading-4 text-neutral-400">{field.label}</p><p className="mt-2 text-2xl font-black text-[#281B22]">{entry.counts[field.key] ?? 0}</p></div>)}</div></DetailSection>
        <DetailSection title="Canali verificati"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{END_OF_DAY_CHANNELS.map((channel) => <div key={channel.key} className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold ${entry.channels[channel.key] ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{entry.channels[channel.key] ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}{channel.label}</div>)}</div></DetailSection>
        <DetailSection title="Conferme"><div className="space-y-3">{END_OF_DAY_CONFIRMATIONS.map((confirmation) => <div key={confirmation.key} className="rounded-2xl border border-black/[0.06] p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#382B32]">{confirmation.label}</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${entry.confirmations[confirmation.key] === "YES" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{entry.confirmations[confirmation.key] === "YES" ? "SÌ" : "NO"}</span></div>{entry.confirmationNotes[confirmation.key] ? <p className="mt-3 whitespace-pre-wrap rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">{entry.confirmationNotes[confirmation.key]}</p> : null}</div>)}</div></DetailSection>
        <DetailSection title="Note sulla giornata"><p className="whitespace-pre-wrap text-sm leading-6 text-neutral-600">{entry.notes || "Nessuna nota aggiunta."}</p></DetailSection>
        <DetailSection title="Presa visione"><div className="grid gap-3 sm:grid-cols-3"><Signature label="Prima addetta" name={entry.operatorOneName} /><Signature label="Seconda addetta" name={entry.operatorTwoName} /><Signature label="Responsabile" name={entry.managerName} /></div></DetailSection>
      </div>
      <aside className="xl:sticky xl:top-4 xl:self-start"><section className="rounded-[24px] border border-[#F1E1E8] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B83D7F]">Confronto amministrativo</p><h3 className="mt-1 text-lg font-black text-[#281B22]">Commenti</h3></div><span className="rounded-full bg-[#FFF0F7] px-2.5 py-1 text-[10px] font-black text-[#B83D7F]">{entry.comments.length}</span></div><div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto pr-1">{entry.comments.length ? entry.comments.map((item) => <article key={item.id} className="rounded-2xl bg-[#FCFAFB] p-3"><div className="flex items-center gap-2"><Avatar person={item.author} /><div><p className="text-xs font-black text-[#382B32]">{item.author.name}</p><p className="text-[9px] text-neutral-400">{formatDateTime(item.createdAt)}</p></div></div><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{item.body}</p></article>) : <p className="rounded-2xl border border-dashed border-black/10 p-5 text-center text-xs text-neutral-400">Nessun commento. Puoi lasciare il primo aggiornamento.</p>}</div><form onSubmit={onComment} className="mt-4 border-t border-black/[0.06] pt-4"><textarea required maxLength={3000} rows={4} value={comment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Lascia un commento sulla giornata…" className="w-full resize-y rounded-2xl border border-black/10 bg-[#FCFAFB] px-3 py-3 text-sm outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20" />{status ? <p className="mt-2 text-xs font-bold text-rose-700">{status}</p> : null}<button disabled={commenting || !comment.trim()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#C84F89] px-4 text-sm font-black text-white disabled:opacity-40"><Send className="size-4" />{commenting ? "Invio…" : "Commenta e notifica"}</button></form></section></aside>
    </div></main>
  </div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[24px] border border-black/[0.07] bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 text-sm font-black uppercase tracking-wider text-[#382B32]">{title}</h3>{children}</section>; }
function Signature({ label, name }: { label: string; name: string }) { return <div className="rounded-2xl bg-[#FCFAFB] p-4"><p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-4 border-b border-black/20 pb-2 text-sm font-bold text-[#382B32]">{name}</p></div>; }

function normalizeApiEntry(entry: any): ChecklistEntry {
  return {
    id: entry.id,
    operationalDate: String(entry.operational_date).slice(0, 10),
    counts: entry.counts ?? {}, channels: entry.channels ?? {}, confirmations: entry.confirmations ?? {}, confirmationNotes: entry.confirmation_notes ?? {}, notes: entry.notes ?? "",
    operatorOneName: entry.operator_one_name, operatorTwoName: entry.operator_two_name, managerName: entry.manager_name,
    submittedAt: entry.submitted_at, updatedAt: entry.updated_at,
    submittedBy: { id: entry.submitted_by.id, name: entry.submitted_by.name, photoUrl: entry.submitted_by.photo_url ?? null },
    comments: (entry.comments ?? []).map((item: any) => ({ id: item.id, body: item.body, createdAt: item.created_at, author: { id: item.author.id, name: item.author.name, photoUrl: item.author.photo_url ?? null } })),
  };
}
