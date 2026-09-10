"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle, ArrowUpFromLine, Boxes, CheckCircle2, Clock3, History, Loader2,
  Package, Plus, Printer, ScanBarcode, Search, ShieldAlert, Store,
} from "lucide-react";

type Tab = "overview" | "scanner" | "products" | "labels" | "movements";
type Counts = Record<string, number>;
type Product = { id: string; name: string; sku: string; barcode?: string | null; category?: string | null; image_url?: string | null; minimum_stock: number; active: boolean; counts: Counts };
type Location = { id: string; name: string; code: string; kind: "WAREHOUSE" | "SALON"; shopify_location_id?: string | null; counts: Counts };
type Label = { id: string; label_code: string; barcode: string; lot_number?: string | null; status: string; print_count: number; created_at: string; product: Product; location: Location };
type Movement = { id: string; movement_type: string; notes?: string | null; created_at: string; product: Pick<Product, "name" | "sku">; label: Pick<Label, "label_code" | "barcode">; user: { name: string }; from_location?: { name: string } | null; to_location?: { name: string } | null };
type InventoryData = { products: Product[]; locations: Location[]; labels: Label[]; movements: Movement[]; totals: { available: number; reserved: number; sold: number; damaged: number } };
type ScanLabel = Label & { movements: Array<{ id: string; movement_type: string; notes?: string | null; created_at: string; user: { name: string }; from_location?: { name: string } | null; to_location?: { name: string } | null }> };
type ScanResult = { kind: "label"; label: ScanLabel } | { kind: "product"; product: Product };

const tabs: Array<{ id: Tab; label: string; icon: typeof Boxes }> = [
  { id: "overview", label: "Panoramica", icon: Boxes }, { id: "scanner", label: "Scanner", icon: ScanBarcode },
  { id: "products", label: "Prodotti e carichi", icon: Package }, { id: "labels", label: "Etichette", icon: Printer },
  { id: "movements", label: "Movimenti", icon: History },
];

const statusLabel: Record<string, string> = { AVAILABLE: "Disponibile", RESERVED: "Riservata", SOLD: "Venduta", DAMAGED: "Danneggiata", LOST: "Smarrita", CANCELLED: "Annullata" };
const movementLabel: Record<string, string> = { IN: "Carico", OUT: "Uscita / vendita", TRANSFER: "Trasferimento", RETURN: "Reso", DAMAGED: "Danneggiata", ADJUSTMENT: "Rettifica" };

function dateTime(value: string) { return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function available(counts: Counts) { return counts.AVAILABLE ?? 0; }

export function InventoryManager({ initialTab = "overview" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<InventoryData | null>(null);
  const [permissions, setPermissions] = useState({ manage: false, operate: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Scansione non riuscita."); }
    finally { setBusy(false); }
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
      const qrImages = await Promise.all(printable.map((label) => QRCode.toDataURL(label.barcode, { margin: 0, width: 220 })));
      const popup = window.open("", "_blank", "width=900,height=700");
      if (!popup) throw new Error("Il browser ha bloccato la finestra di stampa.");
      popup.document.write(`<html><head><title>Etichette Paradise</title><style>@page{size:50mm 30mm;margin:0}body{margin:0;font-family:Arial}.label{width:50mm;height:30mm;box-sizing:border-box;padding:2.5mm;display:grid;grid-template-columns:1fr 18mm;gap:2mm;page-break-after:always;overflow:hidden}.name{font-size:10px;font-weight:700}.sku{font-size:8px}.code{font:700 10px monospace;margin-top:3mm}.qr{width:18mm;height:18mm}</style></head><body>${printable.map((label, index) => `<section class="label"><div><div class="name">${label.product.name}</div><div class="sku">${label.product.sku}</div><div class="code">${label.label_code}</div><div class="sku">${label.location.name}</div></div><img class="qr" src="${qrImages[index]}" /></section>`).join("")}<script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close(); setSelectedLabels([]); setSuccess("Lavoro di stampa registrato. Il codice delle ristampe resta invariato."); await load();
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
    <div className="min-h-[calc(100dvh-64px)] bg-[#f7f7f8] p-4 text-slate-950 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1560px]">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-pink-600">Paradise Beauty</p><h1 className="mt-1 text-3xl font-black tracking-tight">Magazzino</h1><p className="mt-1 text-sm text-slate-500">Ogni pezzo ha un codice unico e una storia completa.</p></div>
          <button onClick={() => setTab("scanner")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-bold text-white"><ScanBarcode className="h-5 w-5" /> Apri scanner</button>
        </header>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2" aria-label="Sezioni magazzino">
          {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${tab === item.id ? "bg-pink-100 text-pink-800" : "text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}
        </nav>

        {(error || success) && <div className={`mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}{error || success}</div>}

        {tab === "overview" && data && <Overview data={data} onTab={setTab} />}
        {tab === "scanner" && data && <ScannerPanel data={data} permissions={permissions} scanCode={scanCode} setScanCode={setScanCode} scan={scan} scanRef={scanRef} busy={busy} result={scanResult} missing={scannedMissing} operation={operation} setOperation={setOperation} destination={destination} setDestination={setDestination} notes={operationNotes} setNotes={setOperationNotes} execute={executeOperation} onCreate={() => { setPrefillProductId(""); setTab("products"); }} onProduct={(id: string) => { setPrefillProductId(id); setTab("products"); }} />}
        {tab === "products" && data && <ProductsPanel data={data} products={filteredProducts} query={query} setQuery={setQuery} permissions={permissions} missingCode={scannedMissing} prefillProductId={prefillProductId} action={apiAction} reload={load} onLoaded={(message: string) => setSuccess(message)} />}
        {tab === "labels" && data && <LabelsPanel labels={filteredLabels} query={query} setQuery={setQuery} selected={selectedLabels} setSelected={setSelectedLabels} print={printLabels} canPrint={permissions.operate} />}
        {tab === "movements" && data && <MovementsPanel movements={data.movements} />}
      </div>
    </div>
  );
}

function Overview({ data, onTab }: { data: InventoryData; onTab: (tab: Tab) => void }) {
  const cards = [["Disponibili", data.totals.available, Boxes], ["Riservate", data.totals.reserved, Clock3], ["Uscite", data.totals.sold, ArrowUpFromLine], ["Danneggiate", data.totals.damaged, ShieldAlert]] as const;
  const low = data.products.filter((p) => available(p.counts) <= p.minimum_stock);
  return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="mb-5 h-6 w-6 text-pink-600"/><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-4xl font-black">{value}</p></div>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Disponibilità per sede</h2><button className="text-sm font-bold text-pink-700" onClick={() => onTab("movements")}>Vedi movimenti</button></div><div className="grid gap-3 sm:grid-cols-2">{data.locations.map((loc) => <div key={loc.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-bold">{loc.kind === "SALON" ? <Store className="h-4 w-4"/> : <Boxes className="h-4 w-4"/>}{loc.name}</div><p className="mt-3 text-2xl font-black">{available(loc.counts)}</p><p className="text-xs text-slate-500">unità disponibili</p></div>)}</div></div>
    <div className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Scorte da controllare</h2><div className="mt-4 space-y-3">{low.length ? low.slice(0, 8).map((p) => <div key={p.id} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-3"><div><p className="font-bold">{p.name}</p><p className="text-xs text-slate-500">{p.sku}</p></div><span className="font-black text-amber-800">{available(p.counts)}</span></div>) : <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Nessuna scorta sotto soglia.</p>}</div></div></section></div>;
}

function ScannerPanel({ data, permissions, scanCode, setScanCode, scan, scanRef, busy, result, missing, operation, setOperation, destination, setDestination, notes, setNotes, execute, onCreate, onProduct }: any) {
  const label: ScanLabel | null = result?.kind === "label" ? result.label : null;
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-pink-600">Scanner USB / Bluetooth</p><h2 className="mt-2 text-2xl font-black">Scansiona o scrivi il codice</h2><p className="mt-1 text-sm text-slate-500">Il cursore torna qui automaticamente dopo ogni operazione.</p><form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void scan(); }}><input ref={scanRef} value={scanCode} onChange={(e) => setScanCode(e.target.value)} className="min-h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-300 px-4 font-mono text-lg font-bold outline-none focus:border-pink-500" placeholder="PB-00000001 o barcode" autoComplete="off"/><button disabled={busy} className="min-h-14 rounded-2xl bg-slate-950 px-5 font-bold text-white">{busy ? <Loader2 className="h-5 w-5 animate-spin"/> : "Trova"}</button></form>
    {missing && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><p className="font-black">Codice non registrato</p><p className="mt-1 font-mono text-sm">{missing}</p>{permissions.manage && <button onClick={onCreate} className="mt-4 rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">Crea o associa prodotto</button>}</div>}
    {result?.kind === "product" && <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-bold uppercase text-sky-700">Prodotto trovato</p><p className="mt-1 text-lg font-black">{result.product.name}</p><p className="font-mono text-sm">{result.product.sku}</p><button onClick={() => onProduct(result.product.id)} className="mt-4 rounded-xl bg-sky-900 px-4 py-2 text-sm font-bold text-white">Genera etichette unità</button></div>}</section>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{!label ? <div className="flex min-h-80 flex-col items-center justify-center text-center text-slate-400"><ScanBarcode className="mb-4 h-14 w-14"/><p className="font-bold">La scheda e la timeline appariranno qui.</p></div> : <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label.label_code}</p><h2 className="mt-1 text-2xl font-black">{label.product.name}</h2><p className="text-sm text-slate-500">{label.product.sku} · {label.location.name}</p></div><span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black">{statusLabel[label.status] ?? label.status}</span></div>
      {permissions.operate && <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-xs font-bold uppercase text-slate-500">Operazione<select value={operation} onChange={(e) => setOperation(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"><option value="OUT">Uscita / vendita</option><option value="TRANSFER">Trasferimento</option><option value="RETURN">Reso</option><option value="DAMAGED">Danneggiata</option><option value="ADJUSTMENT">Rettifica</option></select></label>
      {(operation === "TRANSFER" || operation === "RETURN") && <label className="text-xs font-bold uppercase text-slate-500">Destinazione<select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"><option value="">Seleziona…</option>{data.locations.map((loc: Location) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></label>}
      {operation === "ADJUSTMENT" && <label className="text-xs font-bold uppercase text-slate-500">Nuovo stato<select onChange={(e) => setDestination(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"><option value="">Seleziona…</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label className="text-xs font-bold uppercase text-slate-500 sm:col-span-2">Nota<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm normal-case text-slate-950" placeholder={operation === "ADJUSTMENT" ? "Motivazione obbligatoria" : "Nota facoltativa"}/></label><button onClick={() => void execute()} disabled={busy} className="min-h-12 rounded-xl bg-pink-600 px-4 font-black text-white sm:col-span-2">Conferma operazione</button></div>}
      <Timeline movements={label.movements}/></>}</section></div>;
}

function Timeline({ movements }: { movements: ScanLabel["movements"] }) { return <div className="mt-7"><h3 className="mb-4 flex items-center gap-2 font-black"><History className="h-5 w-5"/> Timeline del codice</h3><div className="space-y-0">{movements.map((move) => <div key={move.id} className="relative grid grid-cols-[24px_1fr] gap-3 pb-5"><div className="relative"><span className="absolute left-[11px] top-3 h-[calc(100%+8px)] w-px bg-slate-200 last:hidden"/><span className="relative block h-6 w-6 rounded-full border-4 border-white bg-pink-500 shadow"/></div><div><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{movementLabel[move.movement_type] ?? move.movement_type}</p><time className="text-xs font-bold text-slate-400">{dateTime(move.created_at)}</time></div><p className="mt-1 text-sm text-slate-600">{move.from_location?.name ?? "—"} <span className="px-1">→</span> {move.to_location?.name ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Operatore: {move.user.name}{move.notes ? ` · ${move.notes}` : ""}</p></div></div>)}{!movements.length && <p className="text-sm text-slate-500">Nessun movimento registrato.</p>}</div></div>; }

function ProductsPanel({ data, products, query, setQuery, permissions, missingCode, prefillProductId, action, reload, onLoaded }: any) {
  const [productId, setProductId] = useState(prefillProductId || ""); const [locationId, setLocationId] = useState(""); const [quantity, setQuantity] = useState(1); const [lot, setLot] = useState("");
  const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await action({ action: "createProduct", ...Object.fromEntries(form) }); event.currentTarget.reset(); onLoaded("Prodotto creato."); await reload(); } catch (cause) { throw cause; } };
  const generate = async () => { try { const json = await action({ action: "generateLabels", productId, locationId, quantity, lotNumber: lot }); onLoaded(`${json.labels.length} etichette uniche create e carico registrato.`); setLot(""); await reload(); } catch (cause) { throw cause; } };
  const updateLocation = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); try { await action({ action: "updateLocation", ...form }); onLoaded("Collegamento sede Shopify aggiornato."); await reload(); } catch (cause) { throw cause; } };
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-6">{permissions.manage && <form onSubmit={submitProduct} className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Nuovo prodotto</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field name="name" label="Nome prodotto" required/><Field name="sku" label="SKU" defaultValue={missingCode} required/><Field name="barcode" label="Barcode prodotto" defaultValue={missingCode}/><Field name="category" label="Categoria"/><Field name="minimumStock" label="Scorta minima" type="number" defaultValue="0"/><Field name="imageUrl" label="URL immagine"/><Field name="shopifyVariantId" label="Shopify Variant ID"/><Field name="shopifyInventoryItemId" label="Shopify Inventory Item ID"/><button className="min-h-12 rounded-xl bg-slate-950 px-4 font-bold text-white sm:col-span-2"><Plus className="mr-2 inline h-4 w-4"/>Crea prodotto</button></div></form>}
    {permissions.operate && <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Nuovo carico</h2><p className="mt-1 text-sm text-slate-500">Crea un codice diverso per ogni pezzo fisico.</p><div className="mt-4 space-y-3"><select value={productId} onChange={(e) => setProductId(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Seleziona prodotto…</option>{data.products.map((p: Product) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Sede di carico…</option>{data.locations.map((loc: Location) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><input type="number" min="1" max="500" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="min-h-12 rounded-xl border border-slate-300 px-3"/><input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Lotto (facoltativo)" className="min-h-12 min-w-0 rounded-xl border border-slate-300 px-3"/></div><button onClick={() => void generate()} className="min-h-12 w-full rounded-xl bg-pink-600 font-black text-white">Genera etichette e registra carico</button></div></section>}
    {permissions.manage && <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Sedi Shopify</h2><p className="mt-1 text-sm text-slate-500">Serve per sincronizzare la quantità disponibile della variante.</p><div className="mt-4 space-y-3">{data.locations.map((loc: Location) => <form key={loc.id} onSubmit={updateLocation} className="rounded-2xl bg-slate-50 p-3"><input type="hidden" name="locationId" value={loc.id}/><p className="mb-2 text-sm font-bold">{loc.name}</p><div className="flex gap-2"><input name="shopifyLocationId" defaultValue={loc.shopify_location_id ?? ""} placeholder="Shopify Location ID" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm"/><button className="rounded-xl bg-white px-3 text-sm font-bold shadow-sm">Salva</button></div></form>)}</div></section>}</div>
    <section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-black">Prodotti</h2><SearchBox value={query} onChange={setQuery}/></div><div className="mt-5 divide-y divide-slate-100">{products.map((p: Product) => <div key={p.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-black">{p.name}</p><p className="font-mono text-xs text-slate-500">{p.sku}{p.barcode ? ` · ${p.barcode}` : ""}</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-sm font-black ${available(p.counts) <= p.minimum_stock ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{available(p.counts)} disponibili</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{p.counts.SOLD ?? 0} usciti</span></div></div>)}</div></section></div>;
}

function LabelsPanel({ labels, query, setQuery, selected, setSelected, print, canPrint }: any) { return <section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black">Etichette fisiche</h2><p className="text-sm text-slate-500">La ristampa mantiene sempre lo stesso codice.</p></div><div className="flex gap-2"><SearchBox value={query} onChange={setQuery}/>{canPrint && <button disabled={!selected.length} onClick={() => void print(selected)} className="min-h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"><Printer className="mr-2 inline h-4 w-4"/>Stampa {selected.length || ""}</button>}</div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-slate-400"><th className="py-3"></th><th>Codice</th><th>Prodotto</th><th>Sede</th><th>Stato</th><th>Lotto</th><th>Stampe</th></tr></thead><tbody>{labels.map((label: Label) => <tr key={label.id} className="border-b border-slate-100"><td className="py-3"><input type="checkbox" checked={selected.includes(label.id)} onChange={(e) => setSelected((current: string[]) => e.target.checked ? [...current, label.id] : current.filter((id) => id !== label.id))}/></td><td className="font-mono font-bold">{label.label_code}</td><td><span className="font-bold">{label.product.name}</span><br/><span className="text-xs text-slate-400">{label.product.sku}</span></td><td>{label.location.name}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel[label.status] ?? label.status}</span></td><td>{label.lot_number ?? "—"}</td><td>{label.print_count}</td></tr>)}</tbody></table></div></section>; }

function MovementsPanel({ movements }: { movements: Movement[] }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Registro movimenti</h2><p className="mt-1 text-sm text-slate-500">Storico immutabile: le correzioni vengono aggiunte, mai sovrascritte.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-slate-400"><th className="py-3">Data</th><th>Movimento</th><th>Codice</th><th>Prodotto</th><th>Da</th><th>A</th><th>Operatore</th><th>Nota</th></tr></thead><tbody>{movements.map((move) => <tr key={move.id} className="border-b border-slate-100"><td className="py-4">{dateTime(move.created_at)}</td><td className="font-bold">{movementLabel[move.movement_type] ?? move.movement_type}</td><td className="font-mono">{move.label.label_code}</td><td>{move.product.name}</td><td>{move.from_location?.name ?? "—"}</td><td>{move.to_location?.name ?? "—"}</td><td>{move.user.name}</td><td className="max-w-64 truncate">{move.notes ?? "—"}</td></tr>)}</tbody></table></div></section>; }

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3"><Search className="h-4 w-4 text-slate-400"/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Cerca subito…" className="min-w-0 flex-1 outline-none"/></label>; }
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="text-xs font-bold uppercase text-slate-500">{label}<input {...props} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm normal-case text-slate-950 outline-none focus:border-pink-500"/></label>; }
