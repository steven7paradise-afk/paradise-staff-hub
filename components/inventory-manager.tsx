"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  AlertTriangle, ArrowRight, ArrowUpFromLine, Boxes, CheckCircle2, Clock3, History, Loader2,
  Package, Plus, Printer, RotateCcw, ScanBarcode, Search, ShieldAlert, Store, Warehouse,
} from "lucide-react";

type Tab = "overview" | "scanner" | "products" | "labels" | "movements";
type Counts = Record<string, number>;
type Product = { id: string; name: string; sku: string; barcode?: string | null; category?: string | null; image_url?: string | null; minimum_stock: number; active: boolean; shopify_inventory_item_id?: string | null; counts: Counts };
type Catalog = { id: string; name: string; description?: string | null; cover_image_url?: string | null; active: boolean };
type Location = { id: string; name: string; code: string; kind: "WAREHOUSE" | "SALON"; shopify_location_id?: string | null; counts: Counts };
type Label = { id: string; label_code: string; barcode: string; lot_number?: string | null; status: string; print_count: number; created_at: string; product: Product; location: Location };
type Movement = { id: string; movement_type: string; notes?: string | null; created_at: string; product: Pick<Product, "name" | "sku">; label: Pick<Label, "label_code" | "barcode">; user: { name: string }; from_location?: { name: string } | null; to_location?: { name: string } | null };
type InventoryData = { products: Product[]; catalogs: Catalog[]; locations: Location[]; labels: Label[]; movements: Movement[]; totals: { available: number; reserved: number; sold: number; damaged: number } };
type ScanMovement = { id: string; inventory_label_id: string; movement_type: string; notes?: string | null; created_at: string; label: Pick<Label, "label_code" | "barcode">; user: { name: string }; from_location?: { name: string } | null; to_location?: { name: string } | null };
type ScanLabel = Label & { movements: ScanMovement[] };
type ProductLabel = Omit<Label, "product">;
type ScanProduct = Product & { labels: ProductLabel[]; movements: ScanMovement[] };
type ScanResult = { kind: "label"; label: ScanLabel; productLabels: ProductLabel[]; productMovements: ScanMovement[] } | { kind: "product"; product: ScanProduct };

const tabs: Array<{ id: Tab; label: string; icon: typeof Boxes }> = [
  { id: "overview", label: "Operazioni", icon: Boxes }, { id: "scanner", label: "Scansiona", icon: ScanBarcode },
  { id: "products", label: "Catalogo e carichi", icon: Package }, { id: "labels", label: "Barcode", icon: Printer },
  { id: "movements", label: "Storico", icon: History },
];

const statusLabel: Record<string, string> = { AVAILABLE: "Disponibile", RESERVED: "Riservata", SOLD: "Venduta", DAMAGED: "Danneggiata", LOST: "Smarrita", CANCELLED: "Annullata" };
const movementLabel: Record<string, string> = { IN: "Carico", OUT: "Uscita / vendita", TRANSFER: "Trasferimento", RETURN: "Reso", DAMAGED: "Danneggiata", ADJUSTMENT: "Rettifica" };

function dateTime(value: string) { return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function available(counts: Counts) { return counts.AVAILABLE ?? 0; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }

export function InventoryManager({ initialTab = "overview" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<InventoryData | null>(null);
  const [permissions, setPermissions] = useState({ manage: false, operate: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [globalCode, setGlobalCode] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scannedMissing, setScannedMissing] = useState("");
  const [operation, setOperation] = useState("OUT");
  const [destination, setDestination] = useState("");
  const [operationNotes, setOperationNotes] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [prefillProductId, setPrefillProductId] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/magazzino", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Impossibile caricare il magazzino.");
      setData(json.data); setPermissions(json.permissions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore di caricamento."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (tab === "scanner") window.setTimeout(() => scanRef.current?.focus(), 80); }, [tab, scanResult, busy]);

  const apiAction = async (payload: Record<string, unknown>) => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/magazzino", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Operazione non riuscita.");
      return json;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
      throw cause;
    } finally { setBusy(false); }
  };

  const scan = async (forced?: string) => {
    const code = (forced ?? scanCode).trim();
    if (!code) return;
    setBusy(true); setError(""); setSuccess(""); setScanResult(null); setScannedMissing("");
    try {
      const response = await fetch(`/api/magazzino?scan=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Scansione non riuscita.");
      setScanCode(json.scannedCode);
      if (json.result) setScanResult(json.result); else setScannedMissing(json.scannedCode);
      window.setTimeout(() => scanRef.current?.select(), 40);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Scansione non riuscita."); }
    finally { setBusy(false); }
  };

  const globalSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = globalCode.trim();
    if (!code) return;
    const normalized = code.toUpperCase();
    const exactLabel = data?.labels.some((label) => label.label_code.toUpperCase() === normalized || label.barcode.toUpperCase() === normalized);
    const exactProduct = data?.products.some((product) => product.sku.toUpperCase() === normalized || product.barcode?.toUpperCase() === normalized);
    if (exactLabel || exactProduct || normalized.startsWith("PB-")) {
      setScanCode(code);
      setTab("scanner");
      void scan(code);
      return;
    }
    setQuery(code);
    setTab("products");
  };

  const executeOperation = async () => {
    if (!scanResult || scanResult.kind !== "label") return;
    try {
      await apiAction({ action: "moveLabel", code: scanResult.label.label_code, operation, toLocationId: operation === "ADJUSTMENT" ? undefined : destination, status: operation === "ADJUSTMENT" ? destination : undefined, notes: operationNotes });
      setSuccess(`${movementLabel[operation]} registrata correttamente.`); setOperationNotes("");
      await Promise.all([scan(scanResult.label.label_code), load()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operazione non riuscita."); }
  };

  const printLabels = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const json = await apiAction({ action: "printLabels", labelIds: ids });
      const printable: Label[] = json.labels;
      const barcodes = printable.map((label) => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, label.barcode, { format: "CODE128", displayValue: false, height: 42, width: 1.45, margin: 0 });
        svg.setAttribute("preserveAspectRatio", "none");
        return svg.outerHTML;
      });
      const popup = window.open("", "_blank", "width=900,height=700");
      if (!popup) throw new Error("Il browser ha bloccato la finestra di stampa.");
      popup.document.write(`<html><head><title>Etichette Paradise</title><style>@page{size:50mm 30mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#000}.label{width:50mm;height:30mm;padding:2mm 2.5mm;display:flex;flex-direction:column;page-break-after:always;overflow:hidden}.name{height:4mm;overflow:hidden;font-size:8px;line-height:4mm;font-weight:700;white-space:nowrap;text-overflow:ellipsis}.meta{display:flex;justify-content:space-between;gap:2mm;font-size:6.5px;line-height:3mm}.barcode{width:100%;height:14mm;margin-top:1mm}.barcode svg{display:block;width:100%;height:100%}.code{text-align:center;font:700 8px/3mm monospace;letter-spacing:.4px}</style></head><body>${printable.map((label, index) => `<section class="label"><div class="name">${escapeHtml(label.product.name)}</div><div class="meta"><span>${escapeHtml(label.product.sku)}</span><span>${escapeHtml(label.location.name)}</span></div><div class="barcode">${barcodes[index]}</div><div class="code">${escapeHtml(label.label_code)}</div></section>`).join("")}<script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close(); setSelectedLabels([]); setSuccess("Barcode Code 128 pronto per la stampa. Il codice delle ristampe resta invariato."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stampa non riuscita."); }
  };

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? data?.products ?? [] : (data?.products ?? []).filter((item) => `${item.name} ${item.sku} ${item.barcode ?? ""}`.toLowerCase().includes(q));
  }, [data, query]);
  const filteredLabels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? data?.labels ?? [] : (data?.labels ?? []).filter((item) => `${item.label_code} ${item.barcode} ${item.product.name} ${item.product.sku} ${item.location.name}`.toLowerCase().includes(q));
  }, [data, query]);

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento magazzino…</div>;

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-[#f3f4f6] text-slate-950">
      <header className="bg-[#131b2b] text-white shadow-lg shadow-slate-950/10">
        <div className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 xl:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-fit items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Warehouse className="h-6 w-6 text-[#ffbd5b]" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-pink-300">Paradise Beauty</p><h1 className="text-xl font-black tracking-tight sm:text-2xl">Centro Magazzino</h1></div>
            </div>
            <form onSubmit={globalSearch} className="group flex min-h-12 min-w-0 flex-1 overflow-hidden rounded-xl bg-white ring-2 ring-transparent transition focus-within:ring-[#ffbd5b] lg:ml-5" role="search">
              <span className="flex items-center pl-4 text-slate-400"><Search className="h-5 w-5" /></span>
              <input value={globalCode} onChange={(event) => setGlobalCode(event.target.value)} className="min-w-0 flex-1 px-3 text-base font-semibold text-slate-950 outline-none" placeholder="Scansiona barcode o cerca SKU, codice, prodotto…" autoComplete="off" aria-label="Cerca nel magazzino" />
              {globalCode && <button type="button" onClick={() => setGlobalCode("")} className="px-3 text-sm font-bold text-slate-500 hover:text-slate-950" aria-label="Cancella ricerca">×</button>}
              <button disabled={busy} className="inline-flex min-w-14 items-center justify-center bg-[#ffbd5b] px-4 font-black text-slate-950 transition hover:bg-[#f3a92f] disabled:opacity-60" aria-label="Trova codice">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanBarcode className="h-5 w-5" />}</button>
            </form>
            <button onClick={() => { setTab("scanner"); window.setTimeout(() => scanRef.current?.focus(), 80); }} className="hidden min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-extrabold hover:bg-white/10 lg:inline-flex"><ScanBarcode className="h-5 w-5 text-[#ffbd5b]" /> Modalità scanner</button>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-[#1d293d]" aria-label="Sezioni magazzino">
          <div className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-3 sm:px-5 xl:px-7">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`relative flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm font-bold transition sm:px-4 ${tab === item.id ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-1 after:rounded-t-full after:bg-[#ffbd5b]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-[1680px] p-4 pb-24 sm:p-6 sm:pb-8 xl:p-8">

        {(error || success) && <div className={`mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}{error || success}</div>}

        {tab === "overview" && data && <Overview data={data} onTab={setTab} onOperation={(nextOperation) => { setOperation(nextOperation); setScanCode(""); setScanResult(null); setScannedMissing(""); setTab("scanner"); }} />}
        {tab === "scanner" && data && <ScannerPanel data={data} permissions={permissions} scanCode={scanCode} setScanCode={setScanCode} scan={scan} scanRef={scanRef} busy={busy} result={scanResult} missing={scannedMissing} operation={operation} setOperation={setOperation} destination={destination} setDestination={setDestination} notes={operationNotes} setNotes={setOperationNotes} execute={executeOperation} onCreate={() => { setPrefillProductId(""); setTab("products"); }} onProduct={(id: string) => { setPrefillProductId(id); setTab("products"); }} />}
        {tab === "products" && data && <ProductsPanel data={data} products={filteredProducts} query={query} setQuery={setQuery} permissions={permissions} missingCode={scannedMissing} prefillProductId={prefillProductId} action={apiAction} reload={load} onLoaded={(message: string) => setSuccess(message)} />}
        {tab === "labels" && data && <LabelsPanel labels={filteredLabels} query={query} setQuery={setQuery} selected={selectedLabels} setSelected={setSelectedLabels} print={printLabels} canPrint={permissions.operate} />}
        {tab === "movements" && data && <MovementsPanel movements={data.movements} />}
      </div>
      <button onClick={() => { setTab("scanner"); window.setTimeout(() => scanRef.current?.focus(), 80); }} className="fixed bottom-5 right-5 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#ffbd5b] px-5 font-black text-slate-950 shadow-xl ring-4 ring-white transition active:scale-95 lg:hidden"><ScanBarcode className="h-5 w-5" /> Scansiona</button>
    </div>
  );
}

function Overview({ data, onTab, onOperation }: { data: InventoryData; onTab: (tab: Tab) => void; onOperation: (operation: string) => void }) {
  const cards = [["Disponibili", data.totals.available, Boxes], ["Riservate", data.totals.reserved, Clock3], ["Uscite", data.totals.sold, ArrowUpFromLine], ["Danneggiate", data.totals.damaged, ShieldAlert]] as const;
  const low = data.products.filter((p) => p.minimum_stock > 0 && available(p.counts) <= p.minimum_stock);
  return <div className="space-y-5">
    <section className="flex flex-col justify-between gap-4 border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Situazione inventario</p><h2 className="mt-1 text-2xl font-black tracking-tight">Tutto il magazzino, a colpo d’occhio</h2><p className="mt-1 text-sm text-slate-500">Ultimo aggiornamento: adesso</p></div>
      <div className="flex gap-2"><a href="/magazzino/inventario-rapido" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-extrabold hover:bg-slate-50"><ScanBarcode className="h-4 w-4" /> Inventario rapido</a><button onClick={() => onTab("movements")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#131b2b] px-4 text-sm font-extrabold text-white hover:bg-slate-800">Registro <ArrowRight className="h-4 w-4" /></button></div>
    </section>
    <section className="border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-black">Cosa devi fare?</h2><p className="mt-1 text-sm text-slate-500">Scegli l’operazione, poi scansiona le confezioni.</p></div><div className="grid sm:grid-cols-2 xl:grid-cols-3">
      <OperationButton icon={Plus} title="Ricevi merce" description="Registra un nuovo carico e crea i barcode" tone="sky" onClick={() => onTab("products")} />
      <OperationButton icon={ArrowUpFromLine} title="Registra vendita" description="Segna una confezione come uscita" tone="amber" onClick={() => onOperation("OUT")} />
      <OperationButton icon={Store} title="Trasferisci" description="Sposta prodotti tra magazzino e saloni" tone="violet" onClick={() => onOperation("TRANSFER")} />
      <OperationButton icon={RotateCcw} title="Registra reso" description="Riporta una confezione nella sede scelta" tone="emerald" onClick={() => onOperation("RETURN")} />
      <OperationButton icon={ShieldAlert} title="Rettifica scorte" description="Correggi stato, danno o anomalia" tone="red" onClick={() => onOperation("ADJUSTMENT")} />
      <OperationButton icon={Printer} title="Stampa barcode" description="Stampa o ristampa etichette Code 128" tone="slate" onClick={() => onTab("labels")} />
    </div></section>
    <section className="grid overflow-hidden border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon], index) => <button key={label} onClick={() => onTab(index === 2 || index === 3 ? "movements" : "labels")} className="group flex items-center gap-4 border-b border-slate-200 p-5 text-left transition hover:bg-slate-50 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${index === 3 ? "bg-red-50 text-red-700" : index === 1 ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}><Icon className="h-5 w-5"/></span><span><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><span className="mt-0.5 block text-3xl font-black tabular-nums">{value.toLocaleString("it-IT")}</span></span><ArrowRight className="ml-auto h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700" /></button>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.7fr)]">
      <div className="border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-black">Disponibilità per sede</h2><p className="text-sm text-slate-500">Unità fisiche attualmente presenti</p></div><button className="text-sm font-extrabold text-sky-700 hover:underline" onClick={() => onTab("movements")}>Tutti i movimenti</button></div><div className="divide-y divide-slate-100">{data.locations.map((loc) => <div key={loc.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{loc.kind === "SALON" ? <Store className="h-5 w-5"/> : <Boxes className="h-5 w-5"/>}</span><div className="min-w-0"><p className="truncate font-extrabold">{loc.name}</p><p className="text-xs font-semibold text-slate-500">{loc.kind === "SALON" ? "Salone" : "Magazzino centrale"}</p></div></div><div className="text-right"><p className="text-2xl font-black tabular-nums">{available(loc.counts).toLocaleString("it-IT")}</p><p className="text-xs font-semibold text-slate-500">disponibili</p></div></div>)}</div></div>
      <div className="border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><AlertTriangle className={`h-5 w-5 ${low.length ? "text-amber-600" : "text-emerald-600"}`} /><h2 className="text-lg font-black">Scorte da controllare</h2></div><p className="mt-1 text-sm text-slate-500">Prodotti arrivati alla soglia minima</p></div><div className="divide-y divide-slate-100">{low.length ? low.slice(0, 8).map((p) => <button key={p.id} onClick={() => onTab("products")} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-amber-50"><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{p.name}</p><p className="truncate font-mono text-xs text-slate-500">{p.sku}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-900">{available(p.counts)}</span></button>) : <div className="flex flex-col items-center px-6 py-10 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></span><p className="font-black">Scorte sotto controllo</p><p className="mt-1 max-w-64 text-sm text-slate-500">Nessun prodotto ha raggiunto la soglia minima.</p></div>}</div></div>
    </section>
  </div>;
}

function OperationButton({ icon: Icon, title, description, tone, onClick }: { icon: typeof Boxes; title: string; description: string; tone: "sky" | "amber" | "violet" | "emerald" | "red" | "slate"; onClick: () => void }) {
  const tones = { sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-700" };
  return <button onClick={onClick} className="group flex min-h-28 items-center gap-4 border-b border-slate-200 p-5 text-left transition hover:bg-slate-50 sm:border-r xl:[&:nth-child(3n)]:border-r-0"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block font-black">{title}</span><span className="mt-1 block text-sm leading-snug text-slate-500">{description}</span></span><ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700" /></button>;
}

function ScannerPanel({ data, permissions, scanCode, setScanCode, scan, scanRef, busy, result, missing, operation, setOperation, destination, setDestination, notes, setNotes, execute, onCreate, onProduct }: any) {
  const label: ScanLabel | null = result?.kind === "label" ? result.label : null;
  const product: ScanProduct | Product | null = result?.kind === "product" ? result.product : label?.product ?? null;
  const productLabels: ProductLabel[] = result?.kind === "product" ? result.product.labels : result?.kind === "label" ? result.productLabels : [];
  const productMovements: ScanMovement[] = result?.kind === "product" ? result.product.movements : result?.kind === "label" ? result.productMovements : [];
  const statusCounts = productLabels.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), {});
  const locationCounts = productLabels.filter((item) => item.status === "AVAILABLE" || item.status === "RESERVED").reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.location.name]: (counts[item.location.name] ?? 0) + 1 }), {});

  return <div className="grid gap-5 xl:grid-cols-[minmax(340px,.58fr)_minmax(0,1.42fr)]">
    <section className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Postazione scanner</p><h2 className="mt-1 text-xl font-black">Scansiona e consulta</h2><p className="mt-1 text-sm text-slate-500">Leggi una confezione o il codice generale del prodotto.</p></div>
      <form className="p-5" onSubmit={(event) => { event.preventDefault(); void scan(); }}><label className="text-xs font-black uppercase tracking-wide text-slate-600" htmlFor="inventory-scan">Barcode o codice</label><div className="mt-2 flex overflow-hidden rounded-xl border-2 border-slate-300 bg-white focus-within:border-[#f3a92f] focus-within:ring-2 focus-within:ring-amber-100"><input id="inventory-scan" ref={scanRef} value={scanCode} onChange={(e) => setScanCode(e.target.value)} onFocus={(e) => e.currentTarget.select()} className="min-h-16 min-w-0 flex-1 px-4 font-mono text-lg font-bold outline-none" placeholder="PB-00000001" autoComplete="off"/><button disabled={busy} className="min-h-16 min-w-24 bg-[#ffbd5b] px-5 font-black text-slate-950 hover:bg-[#f3a92f]">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin"/> : "Cerca"}</button></div><div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={() => { setScanCode(""); window.setTimeout(() => scanRef.current?.focus(), 40); }} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"><RotateCcw className="h-4 w-4" /> Nuova scansione</button>{result && <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-700"><CheckCircle2 className="h-4 w-4"/> Letto</span>}</div></form>
      {missing && <div className="mx-5 mb-5 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4"><p className="font-black">Codice non registrato</p><p className="mt-1 font-mono text-sm">{missing}</p><p className="mt-2 text-sm text-amber-900">Controlla il codice oppure registra il nuovo articolo.</p>{permissions.manage && <button onClick={onCreate} className="mt-4 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Crea o associa prodotto</button>}</div>}
      {result?.kind === "product" && permissions.operate && <div className="border-t border-slate-200 p-5"><p className="text-sm font-bold text-slate-600">Per registrare vendita, trasferimento o reso devi leggere il barcode <strong>PB-…</strong> della singola confezione.</p><button onClick={() => onProduct(result.product.id)} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-sky-800 hover:underline">Registra nuovo carico <ArrowRight className="h-4 w-4" /></button></div>}
    </section>

    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {!product ? <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center"><span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ScanBarcode className="h-10 w-10"/></span><p className="text-lg font-black text-slate-700">In attesa di una scansione</p><p className="mt-1 max-w-sm text-sm text-slate-500">Prodotto, disponibilità e storia completa compariranno qui.</p></div> : <>
        <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 gap-4">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-24 w-24 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-cover sm:h-28 sm:w-28"/> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Package className="h-8 w-8 text-slate-400" /></span>}<div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">{label ? "Confezione identificata" : "Prodotto identificato"}</p><h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{product.name}</h2><p className="mt-2 break-all font-mono text-sm font-bold text-slate-500">{product.sku}</p>{label && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white">{label.label_code}</span><span className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Store className="h-4 w-4" /> {label.location.name}</span></div>}</div></div>{label && <StatusPill status={label.status}/>}</div></div>

        <div className="grid border-b border-slate-200 sm:grid-cols-4"><Metric label="Disponibili" value={statusCounts.AVAILABLE ?? 0} tone="emerald"/><Metric label="Riservate" value={statusCounts.RESERVED ?? 0} tone="amber"/><Metric label="Vendute" value={statusCounts.SOLD ?? 0} tone="slate"/><Metric label="Movimenti" value={productMovements.length} tone="sky"/></div>

        <div className="grid border-b border-slate-200 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <div className="p-5 sm:p-6"><Timeline movements={productMovements} selectedLabelId={label?.id}/></div>
          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 xl:border-l xl:border-t-0"><h3 className="flex items-center gap-2 font-black"><Warehouse className="h-5 w-5 text-sky-700"/> Disponibilità completa</h3><p className="mt-1 text-sm text-slate-500">Tutte le sedi, comprese quelle senza scorte.</p><div className="mt-4 space-y-2">{data.locations.map((location: Location) => { const count = locationCounts[location.name] ?? 0; return <div key={location.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="min-w-0 truncate text-sm font-bold">{location.name}</span><span className={`rounded-full px-2.5 py-1 text-sm font-black ${count ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{count}</span></div>; })}</div>{label && <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-sky-700">Questa confezione</p><p className="mt-1 font-mono text-sm font-black">{label.label_code}</p><p className="mt-1 text-sm text-slate-600">{label.movements.length} passaggi registrati</p></div>}</aside>
        </div>

        {label && permissions.operate && <details className="border-b border-slate-200 bg-slate-50"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-black hover:bg-slate-100 sm:px-6"><span>Registra un nuovo movimento</span><Plus className="h-5 w-5"/></summary><div className="grid gap-3 border-t border-slate-200 p-5 sm:grid-cols-2 sm:p-6"><label className="text-xs font-bold uppercase text-slate-500">Operazione<select value={operation} onChange={(e) => setOperation(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-600"><option value="OUT">Uscita / vendita</option><option value="TRANSFER">Trasferimento</option><option value="RETURN">Reso</option><option value="DAMAGED">Danneggiata</option><option value="ADJUSTMENT">Rettifica</option></select></label>{(operation === "TRANSFER" || operation === "RETURN") && <label className="text-xs font-bold uppercase text-slate-500">Destinazione<select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-600"><option value="">Seleziona…</option>{data.locations.map((loc: Location) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></label>}{operation === "ADJUSTMENT" && <label className="text-xs font-bold uppercase text-slate-500">Nuovo stato<select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-600"><option value="">Seleziona…</option>{Object.entries(statusLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>}<label className="text-xs font-bold uppercase text-slate-500 sm:col-span-2">Nota<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm normal-case text-slate-950 outline-none focus:border-sky-600" placeholder={operation === "ADJUSTMENT" ? "Scrivi il motivo della rettifica" : "Aggiungi una nota facoltativa"}/></label><button onClick={() => void execute()} disabled={busy} className="min-h-12 rounded-lg bg-[#131b2b] px-4 font-black text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-2">Conferma movimento</button></div></details>}
      </>}
    </section>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "slate" | "sky" }) {
  const tones = { emerald: "text-emerald-700", amber: "text-amber-700", slate: "text-slate-700", sky: "text-sky-700" };
  return <div className="border-b border-slate-200 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black tabular-nums ${tones[tone]}`}>{value.toLocaleString("it-IT")}</p></div>;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : status === "RESERVED" ? "bg-amber-100 text-amber-800 ring-amber-200" : status === "SOLD" ? "bg-slate-200 text-slate-800 ring-slate-300" : "bg-red-100 text-red-800 ring-red-200";
  return <span className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${tone}`}>{statusLabel[status] ?? status}</span>;
}

function Timeline({ movements, selectedLabelId }: { movements: ScanMovement[]; selectedLabelId?: string }) {
  return <div><div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><h3 className="flex items-center gap-2 font-black"><History className="h-5 w-5 text-sky-700"/> Storia completa del prodotto</h3><p className="mt-1 text-sm text-slate-500">Ogni passaggio, dal carico fino a vendita, trasferimento o reso.</p></div><span className="text-sm font-black text-slate-500">{movements.length} eventi</span></div><div className="max-h-[720px] space-y-0 overflow-y-auto pr-1">{movements.map((move, index) => { const selected = move.inventory_label_id === selectedLabelId; return <div key={move.id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4"><div className="relative"><span className={`absolute left-[13px] top-4 h-full w-px bg-slate-200 ${index === movements.length - 1 ? "hidden" : ""}`}/><span className={`relative block h-7 w-7 rounded-full border-[6px] ${selected ? "border-amber-200 bg-amber-600" : "border-sky-100 bg-sky-700"}`}/></div><div className={`rounded-xl border p-3 ${selected ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="font-black">{movementLabel[move.movement_type] ?? move.movement_type}</p><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">{move.label.label_code}</span>{selected && <span className="text-[10px] font-black uppercase tracking-wide text-amber-800">Scansionata</span>}</div><time className="text-xs font-bold text-slate-500">{dateTime(move.created_at)}</time></div><p className="mt-1 text-sm text-slate-700">{move.from_location?.name ?? "Ingresso"} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {move.to_location?.name ?? (move.movement_type === "OUT" ? "Cliente" : "—")}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{move.user.name}{move.notes ? ` · ${move.notes}` : ""}</p></div></div>; })}{!movements.length && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nessun movimento registrato.</p>}</div></div>;
}

function ProductsPanel({ data, products, query, setQuery, permissions, missingCode, prefillProductId, action, reload, onLoaded }: any) {
  const [productId, setProductId] = useState(prefillProductId || ""); const [locationId, setLocationId] = useState(""); const [quantity, setQuantity] = useState(1); const [lot, setLot] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeTool, setActiveTool] = useState<"" | "load" | "create" | "catalog" | "settings">(prefillProductId ? "load" : "");
  const categoryAlbums = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    for (const catalog of data.catalogs as Catalog[]) grouped.set(catalog.name, []);
    for (const product of data.products as Product[]) {
      const category = product.category?.trim() || "Senza categoria";
      grouped.set(category, [...(grouped.get(category) ?? []), product]);
    }
    return Array.from(grouped, ([name, items]) => ({
      name,
      items,
      cover_image_url: (data.catalogs as Catalog[]).find((catalog) => catalog.name === name)?.cover_image_url ?? null,
      available: items.reduce((total, item) => total + available(item.counts), 0),
      availabilityConnected: items.some((item) => Boolean(item.shopify_inventory_item_id) || Object.values(item.counts).some((count) => count > 0)),
    })).sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [data.catalogs, data.products]);
  const visibleProducts = useMemo(() => selectedCategory ? (products as Product[]).filter((product) => (product.category?.trim() || "Senza categoria") === selectedCategory) : products as Product[], [products, selectedCategory]);
  const showAlbums = !query.trim() && !selectedCategory;
  const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await action({ action: "createProduct", ...Object.fromEntries(form) }); event.currentTarget.reset(); onLoaded("Prodotto creato."); await reload(); } catch (cause) { throw cause; } };
  const submitCatalog = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const json = await action({ action: "createCatalog", ...Object.fromEntries(form) }); event.currentTarget.reset(); setSelectedCategory(json.catalog.name); setActiveTool(""); onLoaded(`Catalogo ${json.catalog.name} creato.`); await reload(); } catch (cause) { throw cause; } };
  const generate = async () => { try { const json = await action({ action: "generateLabels", productId, locationId, quantity, lotNumber: lot }); onLoaded(`${json.labels.length} etichette uniche create e carico registrato.`); setLot(""); await reload(); } catch (cause) { throw cause; } };
  const updateLocation = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); try { await action({ action: "updateLocation", ...form }); onLoaded("Collegamento sede Shopify aggiornato."); await reload(); } catch (cause) { throw cause; } };
  return <div className="space-y-5">{activeTool && <div className="mx-auto max-w-4xl">{permissions.manage && activeTool === "create" && <details open className="border border-slate-200 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-black hover:bg-slate-50"><span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Crea nuovo prodotto</span><button type="button" onClick={(event) => { event.preventDefault(); setActiveTool(""); }} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950">Chiudi</button></summary><form onSubmit={submitProduct} className="border-t border-slate-200 p-5"><div className="grid gap-3 sm:grid-cols-2"><Field name="name" label="Nome prodotto" required/><Field name="sku" label="SKU" defaultValue={missingCode} required/><Field name="barcode" label="Barcode prodotto" defaultValue={missingCode}/><Field name="category" label="Categoria"/><Field name="minimumStock" label="Scorta minima" type="number" defaultValue="0"/><Field name="imageUrl" label="URL immagine"/><Field name="shopifyVariantId" label="Shopify Variant ID"/><Field name="shopifyInventoryItemId" label="Shopify Inventory Item ID"/><button className="min-h-12 rounded-lg bg-slate-950 px-4 font-bold text-white sm:col-span-2"><Plus className="mr-2 inline h-4 w-4"/>Crea prodotto</button></div></form></details>}
    {permissions.operate && activeTool === "load" && <section className="border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-wide text-sky-700">Ingresso merce</p><h2 className="mt-1 text-xl font-black">Registra un carico</h2><p className="mt-1 text-sm text-slate-500">Ogni confezione riceverà un barcode unico.</p></div><button type="button" onClick={() => setActiveTool("")} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-white hover:text-slate-950">Chiudi</button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="block text-xs font-black uppercase tracking-wide text-slate-500">Prodotto<select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm normal-case text-slate-950 outline-none focus:border-sky-600"><option value="">Seleziona prodotto…</option>{categoryAlbums.map((album) => <optgroup key={album.name} label={album.name}>{album.items.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</optgroup>)}</select></label><label className="block text-xs font-black uppercase tracking-wide text-slate-500">Destinazione<select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm normal-case text-slate-950 outline-none focus:border-sky-600"><option value="">Sede di carico…</option>{data.locations.map((loc: Location) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></label><label className="text-xs font-black uppercase tracking-wide text-slate-500">Quantità<input type="number" min="1" max="500" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base normal-case outline-none focus:border-sky-600"/></label><label className="text-xs font-black uppercase tracking-wide text-slate-500">Lotto<input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Facoltativo" className="mt-1 min-h-12 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm normal-case outline-none focus:border-sky-600"/></label><button onClick={() => void generate()} disabled={!productId || !locationId} className="min-h-12 w-full rounded-lg bg-[#131b2b] font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2">Registra carico e crea barcode</button></div></section>}
    {permissions.manage && activeTool === "settings" && <details open className="border border-slate-200 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-black hover:bg-slate-50"><span>Sedi e collegamento Shopify</span><button type="button" onClick={(event) => { event.preventDefault(); setActiveTool(""); }} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950">Chiudi</button></summary><div className="grid gap-3 border-t border-slate-200 p-5 sm:grid-cols-2">{data.locations.map((loc: Location) => <form key={loc.id} onSubmit={updateLocation} className="border border-slate-200 bg-slate-50 p-3"><input type="hidden" name="locationId" value={loc.id}/><p className="mb-2 text-sm font-bold">{loc.name}</p><div className="flex gap-2"><input name="shopifyLocationId" defaultValue={loc.shopify_location_id ?? ""} placeholder="Shopify Location ID" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"/><button className="rounded-lg bg-white px-3 text-sm font-bold shadow-sm">Salva</button></div></form>)}</div></details>}</div>}
    <section className="min-w-0 border border-slate-200 bg-white shadow-sm"><div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0">{selectedCategory || query ? <button onClick={() => { setSelectedCategory(""); setQuery(""); }} className="mb-1 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-sky-700 hover:underline">← Tutte le categorie</button> : <p className="text-xs font-black uppercase tracking-wide text-slate-500">Libreria prodotti</p>}<h2 className="truncate text-xl font-black">{selectedCategory || (query ? "Risultati della ricerca" : "Catalogo per categorie")}</h2><p className="text-sm text-slate-500">{showAlbums ? `${categoryAlbums.length} categorie · ${data.products.length} prodotti` : `${visibleProducts.length} prodotti`}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><SearchBox value={query} onChange={(value) => { setQuery(value); if (value) setSelectedCategory(""); }}/>{permissions.operate && <button onClick={() => setActiveTool(activeTool === "load" ? "" : "load")} className="min-h-11 shrink-0 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black hover:bg-slate-50">Registra carico</button>}{permissions.manage && <button onClick={() => setActiveTool(activeTool === "catalog" ? "" : "catalog")} className="min-h-11 shrink-0 rounded-lg border border-slate-900 bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-50"><Plus className="mr-1.5 inline h-4 w-4" />Nuovo catalogo</button>}{permissions.manage && <button onClick={() => setActiveTool(activeTool === "create" ? "" : "create")} className="min-h-11 shrink-0 rounded-lg bg-[#131b2b] px-4 text-sm font-black text-white hover:bg-slate-800"><Plus className="mr-1.5 inline h-4 w-4" />Nuovo prodotto</button>}{permissions.manage && <button onClick={() => setActiveTool(activeTool === "settings" ? "" : "settings")} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-slate-500 hover:bg-slate-100" aria-label="Impostazioni catalogo">Impostazioni</button>}</div></div>
      {permissions.manage && activeTool === "catalog" && <form onSubmit={submitCatalog} className="grid gap-4 border-b border-slate-200 bg-violet-50 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><p className="text-xs font-black uppercase tracking-wide text-violet-700">Nuovo album</p><h3 className="mt-1 text-lg font-black">Crea un catalogo vuoto</h3></div><Field name="name" label="Nome catalogo" placeholder="Esempio: Clip-in" required/><Field name="coverImageUrl" label="Immagine di copertina" placeholder="https://…"/><label className="text-xs font-bold uppercase text-slate-500 sm:col-span-2">Descrizione<textarea name="description" className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm normal-case text-slate-950 outline-none focus:border-violet-600" placeholder="Descrizione facoltativa"/></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setActiveTool("")} className="min-h-11 rounded-lg px-4 text-sm font-bold text-slate-600 hover:bg-white">Annulla</button><button className="min-h-11 rounded-lg bg-[#131b2b] px-5 text-sm font-black text-white">Crea catalogo</button></div></form>}
      {showAlbums ? <div className="grid gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">{categoryAlbums.map((album) => { const images = album.items.filter((item) => item.image_url).slice(0, 4); return <button key={album.name} onClick={() => setSelectedCategory(album.name)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"><div className={`grid aspect-[16/9] overflow-hidden bg-slate-100 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>{images.length ? images.map((item, index) => <img key={item.id} src={item.image_url ?? ""} alt="" className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${images.length === 3 && index === 0 ? "row-span-2" : ""}`} />) : album.cover_image_url ? <img src={album.cover_image_url} alt={`Copertina ${album.name}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"/> : <span className="flex items-center justify-center text-slate-300"><Package className="h-12 w-12" /></span>}</div><div className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-black">{album.name}</h3><p className="mt-0.5 text-sm text-slate-500">{album.items.length} prodotti · {album.availabilityConnected ? `${album.available} disponibili` : "disponibilità da collegare"}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-[#ffbd5b] group-hover:text-slate-950"><ArrowRight className="h-4 w-4" /></span></div></button>; })}{!categoryAlbums.length && <div className="col-span-full p-10 text-center"><Package className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-black">Nessuna categoria disponibile</p><p className="mt-1 text-sm text-slate-500">Crea il primo prodotto e assegna una categoria.</p></div>}</div> : <div className="grid gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">{visibleProducts.map((p) => { const availabilityConnected = Boolean(p.shopify_inventory_item_id) || Object.values(p.counts).some((count) => count > 0); return <article key={p.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md"><div className="relative aspect-square overflow-hidden bg-slate-50">{p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-slate-300"/></div>}<span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${!availabilityConnected ? "bg-amber-100 text-amber-900" : p.minimum_stock > 0 && available(p.counts) <= p.minimum_stock ? "bg-amber-100 text-amber-900" : "bg-white text-emerald-800"}`}>{availabilityConnected ? `${available(p.counts)} disponibili` : "Da collegare"}</span></div><div className="p-4"><p className="text-xs font-black uppercase tracking-wide text-sky-700">{p.category?.trim() || "Senza categoria"}</p><h3 className="mt-1 line-clamp-2 min-h-12 font-black leading-snug">{p.name}</h3><div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="truncate font-mono text-xs text-slate-500">{p.sku}</span><span className="shrink-0 text-xs font-bold text-slate-500">{p.counts.SOLD ?? 0} usciti</span></div></div></article>; })}{!visibleProducts.length && <div className="col-span-full p-10 text-center"><Search className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-black">Nessun prodotto trovato</p><p className="mt-1 text-sm text-slate-500">Controlla il nome, lo SKU o il barcode e riprova.</p></div>}</div>}
    </section></div>;
}

function LabelsPanel({ labels, query, setQuery, selected, setSelected, print, canPrint }: any) { return <section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black">Etichette fisiche</h2><p className="text-sm text-slate-500">La ristampa mantiene sempre lo stesso codice.</p></div><div className="flex gap-2"><SearchBox value={query} onChange={setQuery}/>{canPrint && <button disabled={!selected.length} onClick={() => void print(selected)} className="min-h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"><Printer className="mr-2 inline h-4 w-4"/>Stampa {selected.length || ""}</button>}</div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-slate-400"><th className="py-3"></th><th>Codice</th><th>Prodotto</th><th>Sede</th><th>Stato</th><th>Lotto</th><th>Stampe</th></tr></thead><tbody>{labels.map((label: Label) => <tr key={label.id} className="border-b border-slate-100"><td className="py-3"><input type="checkbox" checked={selected.includes(label.id)} onChange={(e) => setSelected((current: string[]) => e.target.checked ? [...current, label.id] : current.filter((id) => id !== label.id))}/></td><td className="font-mono font-bold">{label.label_code}</td><td><span className="font-bold">{label.product.name}</span><br/><span className="text-xs text-slate-400">{label.product.sku}</span></td><td>{label.location.name}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel[label.status] ?? label.status}</span></td><td>{label.lot_number ?? "—"}</td><td>{label.print_count}</td></tr>)}</tbody></table></div></section>; }

function MovementsPanel({ movements }: { movements: Movement[] }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Registro movimenti</h2><p className="mt-1 text-sm text-slate-500">Storico immutabile: le correzioni vengono aggiunte, mai sovrascritte.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-slate-400"><th className="py-3">Data</th><th>Movimento</th><th>Codice</th><th>Prodotto</th><th>Da</th><th>A</th><th>Operatore</th><th>Nota</th></tr></thead><tbody>{movements.map((move) => <tr key={move.id} className="border-b border-slate-100"><td className="py-4">{dateTime(move.created_at)}</td><td className="font-bold">{movementLabel[move.movement_type] ?? move.movement_type}</td><td className="font-mono">{move.label.label_code}</td><td>{move.product.name}</td><td>{move.from_location?.name ?? "—"}</td><td>{move.to_location?.name ?? "—"}</td><td>{move.user.name}</td><td className="max-w-64 truncate">{move.notes ?? "—"}</td></tr>)}</tbody></table></div></section>; }

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3"><Search className="h-4 w-4 text-slate-400"/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Cerca subito…" className="min-w-0 flex-1 outline-none"/></label>; }
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="text-xs font-bold uppercase text-slate-500">{label}<input {...props} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm normal-case text-slate-950 outline-none focus:border-pink-500"/></label>; }
