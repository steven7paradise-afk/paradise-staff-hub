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
  Trash2,
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
  collection_id: string | null;
  details: Record<string, string> | null;
  format: string;
  print_count: number;
  last_printed_at: string | null;
  created_at: string;
  created_by: { name: string };
  collection: { id: string; name: string; fields: CollectionField[] } | null;
};

type CollectionField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type?: "text" | "buttons";
  options?: string[];
};

type BarcodeCollection = {
  id: string;
  name: string;
  fields: CollectionField[];
  is_default: boolean;
};

type PrintMode = "barcode" | "both" | "info";

type CustomQuestion = {
  id: string;
  label: string;
  type: "text" | "buttons";
  options: string;
};

const collectionQuestionOptions = [
  { key: "color", label: "Colore" },
  { key: "weight", label: "Peso" },
  { key: "length", label: "Lunghezza" },
  { key: "productCode", label: "Codice" },
  { key: "typology", label: "Tipologia" },
  { key: "bands", label: "Fasce" },
  { key: "price", label: "Prezzo" },
] as const;

const legacyFields: CollectionField[] = collectionQuestionOptions.slice(0, 5).map((field) => ({
  ...field,
  placeholder: "",
  required: true,
  type: "text",
}));

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
  const [collections, setCollections] = useState<BarcodeCollection[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [detailValues, setDetailValues] = useState<Record<string, string>>({});
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [printMode, setPrintMode] = useState<PrintMode>("both");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionFields, setNewCollectionFields] = useState<string[]>(["color", "weight", "length", "productCode", "typology"]);
  const [newCustomQuestions, setNewCustomQuestions] = useState<CustomQuestion[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewError, setPreviewError] = useState("");

  async function loadLabels() {
    setLoading(true);
    setError("");
    try {
      let data: { labels?: BarcodeLabel[]; collections?: BarcodeCollection[] } | null = null;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(`/api/barcode-labels?refresh=${Date.now()}`, { cache: "no-store" });
          const result = await response.json().catch(() => null);
          if (!response.ok) throw new Error(result?.error || "Non riesco a caricare le etichette.");
          if (!Array.isArray(result?.collections) || !result.collections.length) {
            throw new Error("Le collezioni non sono ancora disponibili.");
          }
          data = result;
          break;
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error("Non riesco a caricare le etichette.");
          if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 800));
        }
      }
      if (!data) throw lastError || new Error("Non riesco a caricare le etichette.");
      setLabels(Array.isArray(data?.labels) ? data.labels : []);
      const loadedCollections = Array.isArray(data?.collections) ? data.collections as BarcodeCollection[] : [];
      setCollections(loadedCollections);
      const initialCollection = loadedCollections.find((collection) => collection.name === "Tessitura") || loadedCollections[0];
      setSelectedCollectionId((current) => current || initialCollection?.id || "");
      setDetailValues((current) => Object.keys(current).length ? current : initialCollection ? { typology: initialCollection.name } : {});
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
    return labels.filter((label) => {
      if (collectionFilter !== "all" && label.collection_id !== collectionFilter) return false;
      if (!cleanQuery) return true;
      return `${label.code} ${label.title || ""} ${label.color || ""} ${label.product_code || ""} ${label.typology || ""}`
          .toLocaleLowerCase("it")
          .includes(cleanQuery);
    });
  }, [collectionFilter, labels, query]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) || null,
    [collections, selectedCollectionId],
  );

  const selectedLabels = useMemo(() => {
    const selected = new Set(selectedIds);
    return labels.filter((label) => selected.has(label.id));
  }, [labels, selectedIds]);

  const allVisibleSelected = Boolean(
    filteredLabels.length && filteredLabels.every((label) => selectedIds.includes(label.id)),
  );

  const requiredDetailsComplete = Boolean(
    selectedCollection
    && selectedCollection.fields.length
    && selectedCollection.fields.every((field) => detailValues[field.key]?.trim()),
  );

  function chooseCollection(collectionId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    setSelectedCollectionId(collectionId);
    setDetailValues(collection ? { typology: collection.name } : {});
  }

  function addCustomQuestion() {
    setNewCustomQuestions((current) => [
      ...current,
      { id: `question-${Date.now()}-${current.length}`, label: "", type: "text", options: "" },
    ]);
  }

  async function createCollection() {
    setSavingCollection(true);
    setError("");
    try {
      const response = await fetch("/api/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createCollection",
          name: newCollectionName,
          fieldKeys: newCollectionFields,
          customFields: newCustomQuestions.map(({ label, type, options }) => ({ label, type, options })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Non riesco a creare la collezione.");
      const collection = data.collection as BarcodeCollection;
      setCollections((current) => [...current, collection].sort((a, b) => a.name.localeCompare(b.name, "it")));
      setNewCollectionName("");
      setNewCustomQuestions([]);
      setNewCollectionOpen(false);
      setSelectedCollectionId(collection.id);
      setDetailValues({ typology: collection.name });
      setSuccess(`Collezione ${collection.name} creata.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non riesco a creare la collezione.");
    } finally {
      setSavingCollection(false);
    }
  }

  async function createLabel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode || previewError || !selectedCollection) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: cleanCode,
          title: title.trim(),
          collectionId: selectedCollection.id,
          details: detailValues,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Non riesco a salvare l’etichetta.");
      setLabels((current) => [data.label, ...current.filter((label) => label.id !== data.label.id)]);
      setSelectedIds([data.label.id]);
      setCode("");
      setTitle("");
      setDetailValues({ typology: selectedCollection.name });
      setCreateOpen(false);
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
      const sections = printable.flatMap(({ label, svg }) => {
        const fields = label.collection?.fields?.length ? label.collection.fields : legacyFields;
        const legacyValues: Record<string, string | null> = {
          color: label.color,
          weight: label.weight,
          length: label.length,
          productCode: label.product_code,
          typology: label.typology,
        };
        const backRows = fields.map((field) => `
          <div><dt>${escapeHtml(field.label)}:</dt><dd>${escapeHtml(label.details?.[field.key] || legacyValues[field.key] || "—")}</dd></div>
        `).join("");
        const pages: string[] = [];
        if (printMode !== "info") pages.push(`
          <section class="label label-front">
            <div class="barcode">${svg}</div>
            <div class="caption">${escapeHtml(label.title || label.code)}</div>
          </section>
        `);
        if (printMode !== "barcode") pages.push(`
          <section class="label label-back">
            <div class="back-title">PARADISE BEAUTY</div>
            <dl class="${fields.length > 5 ? "compact" : ""}">${backRows}</dl>
          </section>
        `);
        return pages;
      }).join("");

      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etichette barcode</title><style>
        @page{size:50.8mm 25.4mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:50.8mm;height:25.4mm;padding:1.5mm 2mm;overflow:hidden;page-break-after:always;break-after:page}.label:last-child{page-break-after:auto;break-after:auto}.label-front{display:flex;flex-direction:column}.barcode{min-height:0;flex:1}.barcode svg{display:block;width:100%;height:100%}.caption{overflow:hidden;text-align:center;font-size:9px;font-weight:800;line-height:3.5mm;white-space:nowrap;text-overflow:ellipsis}.label-back{display:flex;flex-direction:column;padding:1.5mm 3mm}.back-title{text-align:center;font-size:7px;font-weight:900;line-height:2.8mm;letter-spacing:.8px}.label-back dl{width:100%;margin:.3mm 0 0;font-size:7.5px;font-weight:700;line-height:3.25mm}.label-back dl.compact{font-size:6.5px;line-height:2.55mm}.label-back dl div{display:grid;grid-template-columns:16mm 1fr;gap:1mm}.label-back dt,.label-back dd{overflow:hidden;margin:0;white-space:nowrap;text-overflow:ellipsis}.label-back dt{font-weight:800}.label-back dd{font-weight:700}@media screen{body{display:flex;flex-direction:column;align-items:center;gap:6mm;padding:10mm}.label{border:1px dashed #bbb;box-shadow:0 3mm 8mm rgba(0,0,0,.08)}}
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
      const modeLabel = printMode === "both" ? "fronte e retro" : printMode === "barcode" ? "solo barcode" : "solo informazioni";
      setSuccess(`${printable.length} ${printable.length === 1 ? "etichetta pronta" : "etichette pronte"} (${modeLabel}).`);
    } catch (cause) {
      if (printWindow && !printWindow.closed && !printWindow.document.body?.children.length) printWindow.close();
      setError(cause instanceof Error ? cause.message : "Stampa non riuscita.");
    } finally {
      setPrinting(false);
    }
  }

  async function deleteLabels(items: BarcodeLabel[]) {
    if (!items.length) return;
    const description = items.length === 1
      ? `l’etichetta ${items[0].code}`
      : `${items.length} etichette selezionate`;
    if (!window.confirm(`Conferma 1 di 3: vuoi eliminare ${description}?`)) return;
    if (!window.confirm(`Conferma 2 di 3: ${description} non sarà più disponibile nell’archivio. Continuare?`)) return;
    if (!window.confirm(`Conferma 3 di 3: eliminare definitivamente ${description}? Questa operazione non può essere annullata.`)) return;

    setDeleting(true);
    setError("");
    setSuccess("");
    try {
      const ids = items.map((label) => label.id);
      const response = await fetch("/api/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Non riesco a eliminare le etichette.");
      const deletedIds = new Set<string>(Array.isArray(data?.ids) ? data.ids : ids);
      setLabels((current) => current.filter((label) => !deletedIds.has(label.id)));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setSuccess(`${data.deleted} ${data.deleted === 1 ? "etichetta eliminata" : "etichette eliminate"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non riesco a eliminare le etichette.");
    } finally {
      setDeleting(false);
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black">
                <Barcode className="size-4 text-[#F3A0C8]" /> CODE 128 · 2 × 1 pollici
              </span>
              <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F080B7] px-5 text-sm font-black text-[#25141D] transition hover:bg-[#F3A0C8]">
                <Plus className="size-5" /> Aggiungi prodotto
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          {createOpen ? <button type="button" onClick={() => setCreateOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/55 backdrop-blur-sm" aria-label="Chiudi pop-up" /> : null}
          <form onSubmit={createLabel} role="dialog" aria-modal="true" aria-labelledby="new-barcode-title" className={`${createOpen ? "fixed left-1/2 top-1/2 z-50 block max-h-[92vh] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto" : "hidden"} rounded-[28px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_80px_rgba(20,10,15,0.3)] dark:border-white/10 dark:bg-[#1D1D22] sm:p-7`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B83D7F] dark:text-[#F080B7]">Nuova etichetta</p>
                <h2 id="new-barcode-title" className="mt-1 text-2xl font-black">Aggiungi prodotto</h2>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FFF0F6] text-[#B83D7F] transition hover:bg-[#FBE1EC] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]" aria-label="Chiudi"><X className="size-6" /></button>
            </div>

            {error ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200"><span>{error}</span><button type="button" onClick={() => void loadLabels()} className="shrink-0 rounded-lg border border-current px-3 py-2 font-black">Riprova</button></div> : null}

            <div className="mt-6 rounded-[22px] border border-[#E9D8E1] bg-[#FCFAFB] p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-end gap-3">
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-black/50 dark:text-white/55">Collezione *</span>
                  <select value={selectedCollectionId} onChange={(event) => chooseCollection(event.target.value)} required className="mt-2 h-12 w-full rounded-xl border border-[#E6D8DF] bg-white px-3 text-sm font-black outline-none focus:border-[#B83D7F] dark:border-white/10 dark:bg-[#24242A]">
                    <option value="">Scegli una collezione</option>
                    {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => setNewCollectionOpen((value) => !value)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#E7B6CD] bg-white px-4 text-xs font-black text-[#A93469] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F3A0C8]">
                  <Plus className="size-4" /> Nuova collezione
                </button>
              </div>
              {newCollectionOpen ? (
                <div className="mt-4 rounded-xl border border-[#E8D7DF] bg-white p-4 dark:border-white/10 dark:bg-black/10">
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-black/50 dark:text-white/55">Nome collezione</label>
                  <input value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} maxLength={60} className="mt-1.5 h-11 w-full rounded-xl border border-[#E6D8DF] bg-white px-3 text-sm font-bold outline-none focus:border-[#B83D7F] dark:border-white/10 dark:bg-white/[0.055]" placeholder="Esempio: Curly" />
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-black/50 dark:text-white/55">Domande da mostrare</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {collectionQuestionOptions.map((field) => {
                      const checked = newCollectionFields.includes(field.key);
                      return <label key={field.key} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-black ${checked ? "border-[#D96B94] bg-[#FFF0F6] text-[#A93469] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]" : "border-black/10 text-black/50 dark:border-white/10 dark:text-white/50"}`}><input type="checkbox" checked={checked} onChange={(event) => setNewCollectionFields((current) => event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key))} className="sr-only" />{field.label}</label>;
                    })}
                  </div>
                  <div className="mt-4 border-t border-black/[0.07] pt-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/50 dark:text-white/55">Domande personalizzate</p>
                      <button type="button" onClick={addCustomQuestion} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E7B6CD] px-3 text-[11px] font-black text-[#A93469] dark:border-white/15 dark:text-[#F3A0C8]"><Plus className="size-3.5" /> Aggiungi domanda</button>
                    </div>
                    {newCustomQuestions.length ? (
                      <div className="mt-3 space-y-3">
                        {newCustomQuestions.map((question) => (
                          <div key={question.id} className="rounded-xl bg-[#F8F4F6] p-3 dark:bg-white/[0.04]">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                              <input value={question.label} onChange={(event) => setNewCustomQuestions((current) => current.map((item) => item.id === question.id ? { ...item, label: event.target.value } : item))} maxLength={60} className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-bold outline-none focus:border-[#B83D7F] dark:border-white/10 dark:bg-[#24242A]" placeholder="Esempio: Tipo di capello" />
                              <select value={question.type} onChange={(event) => setNewCustomQuestions((current) => current.map((item) => item.id === question.id ? { ...item, type: event.target.value as CustomQuestion["type"] } : item))} className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-black outline-none dark:border-white/10 dark:bg-[#24242A]">
                                <option value="text">Risposta scritta</option>
                                <option value="buttons">Scelta con bottoni</option>
                              </select>
                              <button type="button" onClick={() => setNewCustomQuestions((current) => current.filter((item) => item.id !== question.id))} className="grid size-10 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Elimina domanda"><Trash2 className="size-4" /></button>
                            </div>
                            {question.type === "buttons" ? <input value={question.options} onChange={(event) => setNewCustomQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: event.target.value } : item))} maxLength={240} className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs font-bold outline-none focus:border-[#B83D7F] dark:border-white/10 dark:bg-[#24242A]" placeholder="Risposte separate da virgola: Sì, No, Non applicabile" /> : null}
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-xs font-semibold text-black/35 dark:text-white/35">Puoi aggiungere domande con risposta scritta oppure scelte a bottone.</p>}
                  </div>
                  <button type="button" onClick={() => void createCollection()} disabled={savingCollection || !newCollectionName.trim() || (!newCollectionFields.length && !newCustomQuestions.some((question) => question.label.trim()))} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#21171D] px-4 text-xs font-black text-white disabled:opacity-40 dark:bg-[#F080B7] dark:text-[#25141D]">
                    {savingCollection ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Crea collezione
                  </button>
                </div>
              ) : null}
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
              {selectedCollection?.fields.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedCollection.fields.map((field) => (
                    <div key={field.key} className={field.type === "buttons" || field.key === "typology" ? "sm:col-span-2" : ""}>
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-black/50 dark:text-white/55">{field.label}{field.required ? " *" : ""}</span>
                      {field.type === "buttons" && field.options?.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {field.options.map((option) => {
                            const active = detailValues[field.key] === option;
                            return <button key={option} type="button" onClick={() => setDetailValues((current) => ({ ...current, [field.key]: option }))} className={`min-h-11 rounded-xl border px-4 text-xs font-black transition ${active ? "border-[#B83D7F] bg-[#B83D7F] text-white" : "border-[#E6D8DF] bg-white text-black/60 hover:border-[#D96B94] dark:border-white/10 dark:bg-white/[0.055] dark:text-white/65"}`}>{option}</button>;
                          })}
                        </div>
                      ) : (
                        <input required={field.required} value={detailValues[field.key] || ""} onChange={(event) => setDetailValues((current) => ({ ...current, [field.key]: event.target.value }))} maxLength={80} className="mt-1.5 h-11 w-full rounded-xl border border-[#E6D8DF] bg-white px-3 text-sm font-bold outline-none transition focus:border-[#B83D7F] focus:ring-4 focus:ring-[#D96B94]/15 dark:border-white/10 dark:bg-white/[0.055]" placeholder={field.placeholder || `Inserisci ${field.label.toLocaleLowerCase("it")}`} />
                      )}
                    </div>
                  ))}
                </div>
              ) : <div className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-xs font-bold text-black/40 dark:border-white/10 dark:text-white/40">Scegli prima una collezione.</div>}
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
                  <div className="mx-auto flex aspect-[2/1] w-full max-w-[300px] flex-col justify-center rounded-xl bg-white px-4 py-2 text-black shadow-sm ring-1 ring-black/5">
                    <p className="mb-1 text-center text-[8px] font-black uppercase tracking-[0.15em]">Paradise Beauty</p>
                    <dl className={`w-full font-bold leading-tight ${selectedCollection && selectedCollection.fields.length > 5 ? "text-[6px]" : "text-[8px]"}`}>
                      {(selectedCollection?.fields || []).map((field) => <div key={field.key} className="grid grid-cols-[72px_1fr] gap-1"><dt className="truncate font-black">{field.label}:</dt><dd className="truncate">{detailValues[field.key]?.trim() || "—"}</dd></div>)}
                    </dl>
                  </div>
                </div>
              </div>
              {previewError ? <p className="mt-3 text-center text-xs font-bold text-red-600">{previewError}</p> : null}
            </div>

            <button
              disabled={saving || !code.trim() || Boolean(previewError) || !requiredDetailsComplete}
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#B83D7F] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(184,61,127,0.24)] transition hover:bg-[#A83273] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D96B94] disabled:pointer-events-none disabled:opacity-45"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {saving ? "Salvataggio…" : "Salva etichetta"}
            </button>
          </form>

          <section className="min-w-0 rounded-[28px] border border-black/[0.07] bg-white shadow-[0_18px_55px_rgba(47,27,37,0.07)] dark:border-white/10 dark:bg-[#1D1D22] xl:col-span-2">
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

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filtra per collezione">
                <button type="button" onClick={() => { setCollectionFilter("all"); setSelectedIds([]); }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${collectionFilter === "all" ? "border-[#B83D7F] bg-[#B83D7F] text-white" : "border-black/10 bg-white text-black/55 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/60"}`}>Tutte <span className="ml-1 opacity-70">{labels.length}</span></button>
                {collections.map((collection) => {
                  const count = labels.filter((label) => label.collection_id === collection.id).length;
                  return <button key={collection.id} type="button" onClick={() => { setCollectionFilter(collection.id); setSelectedIds([]); }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${collectionFilter === collection.id ? "border-[#B83D7F] bg-[#B83D7F] text-white" : "border-black/10 bg-white text-black/55 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/60"}`}>{collection.name} <span className="ml-1 opacity-70">{count}</span></button>;
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#F8F4F6] p-3 dark:bg-black/15 sm:flex-row sm:items-center">
                <button type="button" onClick={toggleVisibleSelection} disabled={!filteredLabels.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-xs font-black text-black/65 transition hover:border-[#D96B94] hover:text-[#A93469] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70">
                  {allVisibleSelected ? <CheckSquare2 className="size-4" /> : <Square className="size-4" />}
                  {allVisibleSelected ? "Deseleziona visibili" : "Seleziona visibili"}
                </button>
                <label className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-black text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  <Printer className="size-4" /> Contenuto
                  <select value={printMode} onChange={(event) => setPrintMode(event.target.value as PrintMode)} className="h-8 min-w-36 rounded-lg border border-black/10 bg-white px-2 font-black text-black outline-none dark:border-white/15 dark:bg-[#24242A] dark:text-white" aria-label="Contenuto da stampare">
                    <option value="both">Barcode + info</option>
                    <option value="barcode">Solo barcode</option>
                    <option value="info">Solo informazioni</option>
                  </select>
                </label>
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
                <button type="button" onClick={() => void deleteLabels(selectedLabels)} disabled={!selectedLabels.length || deleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 dark:border-red-400/25 dark:bg-white/[0.04] dark:text-red-300 dark:hover:bg-red-500/10">
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Elimina selezionate
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
                          <span className="mt-1.5 inline-flex rounded-full bg-[#FFF0F6] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#A93469] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]">{label.collection?.name || label.typology || "Altro"}</span>
                          {label.color || label.weight || label.length || label.typology ? <p className="mt-1 truncate text-[10px] font-semibold text-black/40 dark:text-white/45">{[label.color, label.weight, label.length, label.typology].filter(Boolean).join(" · ")}</p> : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-black/35 dark:text-white/35">
                            <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> Creata {formatDate(label.created_at)}</span>
                            <span>{label.print_count} {label.print_count === 1 ? "stampa" : "stampe"}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void printLabels([label])} disabled={printing || deleting} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E7B6CD] bg-white px-4 text-xs font-black text-[#A93469] transition hover:bg-[#FFF0F6] disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#F3A0C8] dark:hover:bg-white/10">
                            <Printer className="size-4" /> Stampa
                          </button>
                          <button type="button" onClick={() => void deleteLabels([label])} disabled={printing || deleting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-400/25 dark:bg-white/[0.06] dark:text-red-300 dark:hover:bg-red-500/10" aria-label={`Elimina etichetta ${label.code}`}>
                            <Trash2 className="size-4" /> <span className="sm:hidden">Elimina</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-72 place-items-center px-6 text-center">
                  <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF0F6] text-[#B83D7F] dark:bg-[#F080B7]/15 dark:text-[#F3A0C8]"><Barcode className="size-7" /></span><p className="mt-4 text-sm font-black">{query || collectionFilter !== "all" ? "Nessuna etichetta trovata" : "Nessuna etichetta salvata"}</p><p className="mt-1 text-xs font-semibold text-black/40 dark:text-white/40">{query || collectionFilter !== "all" ? "Prova un’altra ricerca o collezione." : "La prima etichetta apparirà qui dopo il salvataggio."}</p></div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
