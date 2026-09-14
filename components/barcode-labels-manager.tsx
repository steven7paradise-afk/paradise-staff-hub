"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  Barcode,
  Check,
  CheckSquare2,
  Clock3,
  Copy,
  Loader2,
  Plus,
  Printer,
  Search,
  Square,
  X,
} from "lucide-react";

type BarcodeLabel = {
  id: string;
  code: string;
  title: string | null;
  color: string | null;
  weight: string | null;
  length: string | null;
  product_code: string | null;
  typology: string | null;
  format: string;
  print_count: number;
  last_printed_at: string | null;
  created_at: string;
  created_by: { name: string };
};

type BackDetails = {
  color: string;
  weight: string;
  length: string;
  productCode: string;
  typology: string;
};

const emptyBackDetails: BackDetails = {
  color: "",
  weight: "",
  length: "",
  productCode: "",
  typology: "",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatDate(value: string | null) {
  if (!value) return "Mai stampata";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function barcodeSvg(code: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, code, {
    format: "CODE128",
    displayValue: false,
    height: 58,
    width: 1.7,
    margin: 0,
  });
  svg.setAttribute("preserveAspectRatio", "none");
  return svg.outerHTML;
}

export function BarcodeLabelsManager() {
  const previewRef = useRef<SVGSVGElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [backDetails, setBackDetails] = useState<BackDetails>(emptyBackDetails);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewError, setPreviewError] = useState("");

  async function loadLabels() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/barcode-labels", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Non riesco a caricare le etichette.");
      setLabels(Array.isArray(data?.labels) ? data.labels : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non riesco a caricare le etichette.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLabels();
  }, []);

  useEffect(() => {
    const cleanCode = code.trim();
    if (!previewRef.current || !cleanCode) {
      setPreviewError("");
      if (previewRef.current) previewRef.current.replaceChildren();
      return;
    }
    try {
      JsBarcode(previewRef.current, cleanCode, {
        format: "CODE128",
        displayValue: false,
        height: 72,
        width: 2,
        margin: 0,
      });
      setPreviewError("");
    } catch {
      previewRef.current.replaceChildren();
      setPreviewError("Il codice contiene caratteri non supportati.");
    }
  }, [code]);

  const filteredLabels = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase("it");
    if (!cleanQuery) return labels;
    return labels.filter((label) =>
      `${label.code} ${label.title || ""} ${label.color || ""} ${label.product_code || ""} ${label.typology || ""}`
        .toLocaleLowerCase("it")
        .includes(cleanQuery),
    );
  }, [labels, query]);

  const selectedLabels = useMemo(() => {
    const selected = new Set(selectedIds);
    return labels.filter((label) => selected.has(label.id));
  }, [labels, selectedIds]);

  const allVisibleSelected = Boolean(
    filteredLabels.length && filteredLabels.every((label) => selectedIds.includes(label.id)),
  );

  async function createLabel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode || previewError) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", code: cleanCode, title: title.trim(), ...backDetails }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Non riesco a salvare l’etichetta.");
      setLabels((current) => [data.label, ...current.filter((label) => label.id !== data.label.id)]);
      setSelectedIds([data.label.id]);
      setCode("");
      setTitle("");
      setBackDetails(emptyBackDetails);
      setSuccess(`Etichetta ${data.label.code} salvata. Ora puoi stamparla.`);
      window.setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non riesco a salvare l’etichetta.");
    } finally {
      setSaving(false);
    }
  }

  async function printLabels(items: BarcodeLabel[]) {
    if (!items.length) return;
    setError("");
    setSuccess("");

    let printWindow: Window | null = null;
    try {
      printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) throw new Error("Il browser ha bloccato la finestra di stampa.");

      const printable = items.flatMap((label) =>
        Array.from({ length: copies }, () => ({ label, svg: barcodeSvg(label.code) })),
      );
      const sections = printable.map(({ label, svg }) => `
        <section class="label label-front">
          <div class="barcode">${svg}</div>
          <div class="caption">${escapeHtml(label.title || label.code)}</div>
        </section>
        <section class="label label-back">
          <dl>
            <div><dt>Colore:</dt><dd>${escapeHtml(label.color || "—")}</dd></div>
            <div><dt>Peso:</dt><dd>${escapeHtml(label.weight || "—")}</dd></div>
            <div><dt>Lunghezza:</dt><dd>${escapeHtml(label.length || "—")}</dd></div>
            <div><dt>Codice:</dt><dd>${escapeHtml(label.product_code || "—")}</dd></div>
            <div><dt>Tipologia:</dt><dd>${escapeHtml(label.typology || "—")}</dd></div>
          </dl>
        </section>
      `).join("");

      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etichette barcode</title><style>
        @page{size:50.8mm 25.4mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:50.8mm;height:25.4mm;padding:1.5mm 2mm;overflow:hidden;page-break-after:always;break-after:page}.label:last-child{page-break-after:auto;break-after:auto}.label-front{display:flex;flex-direction:column}.barcode{min-height:0;flex:1}.barcode svg{display:block;width:100%;height:100%}.caption{overflow:hidden;text-align:center;font-size:9px;font-weight:800;line-height:3.5mm;white-space:nowrap;text-overflow:ellipsis}.label-back{display:grid;place-items:center;padding:2mm 3mm}.label-back dl{width:100%;margin:0;font-size:8px;font-weight:700;line-height:3.7mm}.label-back dl div{display:grid;grid-template-columns:16mm 1fr;gap:1mm}.label-back dt,.label-back dd{overflow:hidden;margin:0;white-space:nowrap;text-overflow:ellipsis}.label-back dt{font-weight:800}.label-back dd{font-weight:700}@media screen{body{display:flex;flex-direction:column;align-items:center;gap:6mm;padding:10mm}.label{border:1px dashed #bbb;box-shadow:0 3mm 8mm rgba(0,0,0,.08)}}
      </style></head><body>${sections}<script>window.onload=()=>window.print()</script></body></html>`);
      printWindow.document.close();

      setPrinting(true);
      const response = await fetch("/api/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recordPrint", ids: items.map((label) => label.id), copies }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "La stampa è partita, ma non ho aggiornato lo storico.");
      const updatedById = new Map<string, BarcodeLabel>(data.labels.map((label: BarcodeLabel) => [label.id, label]));
      setLabels((current) => current.map((label) => updatedById.get(label.id) || label));
      setSuccess(`${printable.length} ${printable.length === 1 ? "coppia fronte/retro pronta" : "coppie fronte/retro pronte"} per la stampa.`);
    } catch (cause) {
      if (printWindow && !printWindow.closed && !printWindow.document.body?.children.length) printWindow.close();
      setError(cause instanceof Error ? cause.message : "Stampa non riuscita.");
    } finally {
      setPrinting(false);
    }
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredLabels.map((label) => label.id);
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  return (
    <div className="min-h-screen bg-[#F7F3F5] px-4 py-6 text-[#221D20] dark:bg-[#121114] dark:text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[28px] bg-[linear-gradient(125deg,#24151D_0%,#4A1D33_55%,#B53D7A_145%)] px-5 py-7 text-white shadow-[0_24px_70px_rgba(80,24,51,0.18)] sm:px-8 sm:py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F3A0C8]">Strumenti operativi</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">Etichette barcode</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-white/65">Crea un codice, salvalo e stampalo. Tutte le etichette restano disponibili per le ristampe future.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black">
              <Barcode className="size-4 text-[#F3A0C8]" /> Fronte + retro · 2 × 1 pollici
            </span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          <form onSubmit={createLabel} className="rounded-[28px] border border-black/[0.07] bg-white p-5 shadow-[0_18px_55px_rgba(47,27,37,0.07)] dark:border-white/10 dark:bg-[#1D1D22] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B83D7F] dark:text-[#F080B7]">Nuova etichetta</p>
                <h2 className="mt-1 text-2xl font-black">Inserisci il codice</h2>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FFF0F6] text-[#B83D7F] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]"><Plus className="size-6" /></span>
            </div>

            <label className="mt-6 block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-black/50 dark:text-white/55">Codice barcode *</span>
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={80}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-14 w-full rounded-2xl border border-[#E6D8DF] bg-[#FCFAFB] px-4 font-mono text-lg font-black tracking-wide outline-none transition placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal focus:border-[#B83D7F] focus:ring-4 focus:ring-[#D96B94]/15 dark:border-white/10 dark:bg-white/[0.055]"
                placeholder="Esempio: PRD-000123"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-black/50 dark:text-white/55">Testo sotto il barcode · facoltativo</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="mt-2 h-12 w-full rounded-2xl border border-[#E6D8DF] bg-[#FCFAFB] px-4 text-sm font-bold outline-none transition focus:border-[#B83D7F] focus:ring-4 focus:ring-[#D96B94]/15 dark:border-white/10 dark:bg-white/[0.055]"
                placeholder="Esempio: 3 - Castano fondente"
              />
            </label>

            <fieldset className="mt-6 rounded-[22px] border border-[#E9D8E1] bg-[#FCFAFB] p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
              <legend className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#A93469] dark:text-[#F3A0C8]">Informazioni sul retro</legend>
              <p className="mb-4 text-xs font-semibold text-black/45 dark:text-white/45">Compila i dati che verranno stampati dietro l’etichetta.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["color", "Colore", "Castano fondente"],
                  ["weight", "Peso", "50 g"],
                  ["length", "Lunghezza", "55 cm"],
                  ["productCode", "Codice", "L"],
                  ["typology", "Tipologia", "Tessitura"],
                ] as const).map(([field, label, placeholder]) => (
                  <label key={field} className={field === "typology" ? "sm:col-span-2" : ""}>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-black/50 dark:text-white/55">{label} *</span>
                    <input
                      required
                      value={backDetails[field]}
                      onChange={(event) => setBackDetails((current) => ({ ...current, [field]: event.target.value }))}
                      maxLength={80}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#E6D8DF] bg-white px-3 text-sm font-bold outline-none transition focus:border-[#B83D7F] focus:ring-4 focus:ring-[#D96B94]/15 dark:border-white/10 dark:bg-white/[0.055]"
                      placeholder={placeholder}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 rounded-[22px] border border-dashed border-[#DDB8CA] bg-[#FFF9FC] p-5 dark:border-white/15 dark:bg-black/10">
              <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-[#A93469] dark:text-[#F3A0C8]">Anteprima fronte e retro</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-black/35 dark:text-white/40">Fronte</p>
                  <div className="mx-auto flex aspect-[2/1] w-full max-w-[300px] flex-col rounded-xl bg-white px-3 py-2 text-black shadow-sm ring-1 ring-black/5">
                    {code.trim() ? <svg ref={previewRef} className="min-h-0 w-full flex-1" aria-label={`Anteprima barcode ${code.trim()}`} /> : <div className="grid min-h-0 flex-1 place-items-center rounded-lg bg-black/[0.03] text-[10px] font-bold text-black/35">Il barcode apparirà qui</div>}
                    <p className="truncate text-center text-[10px] font-black">{title.trim() || code.trim() || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-center text-[9px] font-black uppercase tracking-[0.14em] text-black/35 dark:text-white/40">Retro</p>
                  <div className="mx-auto grid aspect-[2/1] w-full max-w-[300px] place-items-center rounded-xl bg-white px-4 py-2 text-black shadow-sm ring-1 ring-black/5">
                    <dl className="w-full space-y-0.5 text-[9px] font-bold leading-tight">
                      {([
                        ["Colore", backDetails.color],
                        ["Peso", backDetails.weight],
                        ["Lunghezza", backDetails.length],
                        ["Codice", backDetails.productCode],
                        ["Tipologia", backDetails.typology],
                      ] as const).map(([label, value]) => <div key={label} className="grid grid-cols-[72px_1fr] gap-1"><dt className="font-black">{label}:</dt><dd className="truncate">{value.trim() || "—"}</dd></div>)}
                    </dl>
                  </div>
                </div>
              </div>
              {previewError ? <p className="mt-3 text-center text-xs font-bold text-red-600">{previewError}</p> : null}
            </div>

            <button
              disabled={saving || !code.trim() || Boolean(previewError)}
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#B83D7F] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(184,61,127,0.24)] transition hover:bg-[#A83273] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D96B94] disabled:pointer-events-none disabled:opacity-45"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {saving ? "Salvataggio…" : "Salva etichetta"}
            </button>
          </form>

          <section className="min-w-0 rounded-[28px] border border-black/[0.07] bg-white shadow-[0_18px_55px_rgba(47,27,37,0.07)] dark:border-white/10 dark:bg-[#1D1D22]">
            <div className="border-b border-black/[0.06] p-5 dark:border-white/10 sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B83D7F] dark:text-[#F080B7]">Archivio permanente</p>
                  <h2 className="mt-1 text-2xl font-black">Tutte le etichette</h2>
                  <p className="mt-1 text-xs font-semibold text-black/45 dark:text-white/45">Seleziona quelle da stampare o ristampare.</p>
                </div>
                <label className="relative block min-w-0 lg:w-72">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35 dark:text-white/35" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-black/10 bg-[#FAF8F9] pl-11 pr-10 text-sm font-bold outline-none focus:border-[#B83D7F] dark:border-white/10 dark:bg-white/[0.055]" placeholder="Cerca codice, colore o tipo" />
                  {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-0 top-0 grid size-11 place-items-center text-black/35 dark:text-white/40" aria-label="Cancella ricerca"><X className="size-4" /></button> : null}
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#F8F4F6] p-3 dark:bg-black/15 sm:flex-row sm:items-center">
                <button type="button" onClick={toggleVisibleSelection} disabled={!filteredLabels.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-xs font-black text-black/65 transition hover:border-[#D96B94] hover:text-[#A93469] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70">
                  {allVisibleSelected ? <CheckSquare2 className="size-4" /> : <Square className="size-4" />}
                  {allVisibleSelected ? "Deseleziona visibili" : "Seleziona visibili"}
                </button>
                <label className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-black text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  <Copy className="size-4" /> Copie
                  <select value={copies} onChange={(event) => setCopies(Number(event.target.value))} className="h-8 rounded-lg border border-black/10 bg-white px-2 font-black text-black outline-none dark:border-white/15 dark:bg-[#24242A] dark:text-white" aria-label="Numero di copie">
                    {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => void printLabels(selectedLabels)} disabled={!selectedLabels.length || printing} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#21171D] px-4 text-xs font-black text-white transition hover:bg-black disabled:pointer-events-none disabled:opacity-40 dark:bg-[#F080B7] dark:text-[#25141D] dark:hover:bg-[#F3A0C8]">
                  {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                  Stampa {selectedLabels.length ? selectedLabels.length * copies : ""}
                </button>
              </div>
            </div>

            {error || success ? <div className="px-5 pt-5 sm:px-7"><p className={`rounded-2xl border px-4 py-3 text-xs font-bold ${error ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>{error || success}</p></div> : null}

            <div className="max-h-[720px] overflow-y-auto p-3 sm:p-5">
              {loading ? (
                <div className="grid min-h-72 place-items-center text-sm font-bold text-black/40 dark:text-white/40"><span className="inline-flex items-center gap-2"><Loader2 className="size-5 animate-spin" /> Caricamento etichette…</span></div>
              ) : filteredLabels.length ? (
                <div className="space-y-2">
                  {filteredLabels.map((label) => {
                    const selected = selectedIds.includes(label.id);
                    return (
                      <article key={label.id} className={`grid gap-3 rounded-2xl border p-4 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${selected ? "border-[#D96B94] bg-[#FFF3F8] ring-2 ring-[#D96B94]/10 dark:border-[#F080B7] dark:bg-[#F080B7]/10" : "border-black/[0.07] bg-white hover:border-[#E6B4CC] dark:border-white/10 dark:bg-white/[0.035]"}`}>
                        <label className="flex cursor-pointer items-center gap-3 sm:block">
                          <input type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? Array.from(new Set([...current, label.id])) : current.filter((id) => id !== label.id))} className="size-5 accent-[#B83D7F]" aria-label={`Seleziona ${label.code}`} />
                          <span className="font-mono text-sm font-black sm:hidden">{label.code}</span>
                        </label>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-black tracking-wide max-sm:hidden">{label.code}</p>
                          <p className="mt-1 truncate text-xs font-bold text-black/50 dark:text-white/55">{label.title || "Senza nome"}</p>
                          {label.color || label.weight || label.length || label.typology ? <p className="mt-1 truncate text-[10px] font-semibold text-black/40 dark:text-white/45">{[label.color, label.weight, label.length, label.typology].filter(Boolean).join(" · ")}</p> : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-black/35 dark:text-white/35">
                            <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> Creata {formatDate(label.created_at)}</span>
                            <span>{label.print_count} {label.print_count === 1 ? "stampa" : "stampe"}</span>
                          </p>
                        </div>
                        <button type="button" onClick={() => void printLabels([label])} disabled={printing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E7B6CD] bg-white px-4 text-xs font-black text-[#A93469] transition hover:bg-[#FFF0F6] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F3A0C8] dark:hover:bg-white/10">
                          <Printer className="size-4" /> Stampa
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-72 place-items-center px-6 text-center">
                  <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF0F6] text-[#B83D7F] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]"><Barcode className="size-7" /></span><p className="mt-4 text-sm font-black">{query ? "Nessuna etichetta trovata" : "Nessuna etichetta salvata"}</p><p className="mt-1 text-xs font-semibold text-black/40 dark:text-white/40">{query ? "Prova con un altro codice o nome." : "La prima etichetta apparirà qui dopo il salvataggio."}</p></div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
