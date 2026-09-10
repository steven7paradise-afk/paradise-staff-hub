"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  ScanBarcode,
  Store,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

type LocationKind = "WAREHOUSE" | "SALON";
type Location = { id: string; name: string; code: string; kind: LocationKind; address?: string | null };
type CountProduct = { id: string; name: string; sku: string; barcode?: string | null; image_url?: string | null; category?: string | null };
type CountLabel = { id: string; label_code: string; status: string; location: { id: string; name: string } };
type ResolvedScan = { id: string; code: string; kind: "product" | "label"; product: CountProduct; label: CountLabel | null };
type SavedSummary = { productId: string; name: string; counted: number; expected: number; difference: number };

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function readableDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(new Date(year, month - 1, day));
}

function newScanId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function InventoryCountManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [kind, setKind] = useState<LocationKind | null>(null);
  const [locationId, setLocationId] = useState("");
  const [inventoryDate, setInventoryDate] = useState(today);
  const [started, setStarted] = useState(false);
  const [code, setCode] = useState("");
  const [scans, setScans] = useState<ResolvedScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastRead, setLastRead] = useState("");
  const [saved, setSaved] = useState<{ id: string; location: string; inventoryDate: string; summary: SavedSummary[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/magazzino?countSetup=1", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Impossibile caricare le sedi.");
        if (!json.permissions?.operate) throw new Error("Non hai il permesso di registrare inventari.");
        setLocations(json.locations);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Impossibile caricare le sedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (started && !busy && !saved) window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [started, busy, saved, scans.length]);

  const selectedLocation = locations.find((item) => item.id === locationId) ?? null;
  const matchingLocations = locations.filter((item) => item.kind === kind);
  const grouped = useMemo(() => {
    const result = new Map<string, { product: CountProduct; quantity: number }>();
    for (const scan of scans) {
      const current = result.get(scan.product.id) ?? { product: scan.product, quantity: 0 };
      current.quantity += 1;
      result.set(scan.product.id, current);
    }
    return Array.from(result.values()).sort((a, b) => b.quantity - a.quantity || a.product.name.localeCompare(b.product.name, "it"));
  }, [scans]);

  const chooseKind = (nextKind: LocationKind) => {
    setKind(nextKind);
    setLocationId("");
    setError("");
  };

  const begin = () => {
    if (!selectedLocation) return;
    setStarted(true);
    setError("");
  };

  const scan = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean || busy) return;
    setBusy(true);
    setError("");
    setLastRead("");
    try {
      const response = await fetch(`/api/magazzino?countCode=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Lettura non riuscita.");
      if (!json.result) throw new Error(`Codice non riconosciuto: ${json.scannedCode || clean}`);
      const result = json.result as Omit<ResolvedScan, "id">;
      if (result.kind === "label" && result.label && scans.some((item) => item.label?.id === result.label?.id)) {
        throw new Error(`La confezione ${result.label.label_code} è già presente nella lista.`);
      }
      setScans((current) => [{ ...result, id: newScanId() }, ...current]);
      setLastRead(result.product.name);
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lettura non riuscita.");
      setCode(clean);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.select(), 50);
    }
  };

  const removeScan = (id: string) => {
    setScans((current) => current.filter((item) => item.id !== id));
    setError("");
  };

  const changeDestination = () => {
    if (scans.length && !window.confirm("Cambiando sede verrà svuotata la lista già scansionata. Continuare?")) return;
    setScans([]);
    setStarted(false);
    setSaved(null);
    setLastRead("");
    setCode("");
  };

  const saveCount = async () => {
    if (!selectedLocation || !scans.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/magazzino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveInventoryCount", locationId: selectedLocation.id, inventoryDate, codes: scans.slice().reverse().map((item) => item.code) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Impossibile salvare il conteggio.");
      setSaved({ id: json.session.id, location: json.session.location.name, inventoryDate, summary: json.summary });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile salvare il conteggio.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setScans([]);
    setSaved(null);
    setLastRead("");
    setCode("");
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  if (loading) return <div className="flex min-h-[70dvh] items-center justify-center bg-slate-100 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparazione inventario…</div>;

  if (saved) return (
    <main className="min-h-[calc(100dvh-64px)] bg-[#f3f4f6] p-4 sm:p-8">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="bg-emerald-700 px-6 py-8 text-center text-white sm:px-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15"><CheckCircle2 className="h-9 w-9" /></span>
          <p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-emerald-100">Inventario salvato</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Conteggio completato</h1>
          <p className="mt-2 text-emerald-50">{saved.location} · {readableDate(saved.inventoryDate)} · {scans.length} confezioni · {saved.summary.length} prodotti</p>
        </div>
        <div className="p-5 sm:p-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_70px_80px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_100px_110px]"><span>Prodotto</span><span className="text-right">Contati</span><span className="text-right">Differenza</span></div>
            <div className="max-h-[52dvh] divide-y divide-slate-100 overflow-y-auto">{saved.summary.map((item) => <div key={item.productId} className="grid grid-cols-[minmax(0,1fr)_70px_80px] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_100px_110px]"><span className="truncate text-sm font-bold">{item.name}</span><span className="text-right text-lg font-black tabular-nums">{item.counted}</span><span className={`text-right text-sm font-black tabular-nums ${item.difference === 0 ? "text-emerald-700" : item.difference > 0 ? "text-sky-700" : "text-red-700"}`}>{item.difference > 0 ? "+" : ""}{item.difference}</span></div>)}</div>
          </div>
          <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm font-semibold text-sky-900">Il conteggio è stato archiviato. Le giacenze ufficiali non sono state modificate automaticamente.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/magazzino" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 font-black text-slate-700 hover:bg-slate-50">Torna al magazzino</Link><button onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#131b2b] px-5 font-black text-white hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> Nuovo conteggio</button></div>
        </div>
      </section>
    </main>
  );

  if (!started) return (
    <main className="min-h-[calc(100dvh-64px)] bg-[#f3f4f6] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/magazzino" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-600 hover:bg-white hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Magazzino</Link>
        <section className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <header className="border-b border-slate-200 bg-[#131b2b] px-6 py-7 text-white sm:px-10 sm:py-9">
            <div className="flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ffbd5b] text-slate-950"><ClipboardCheck className="h-7 w-7" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-pink-300">Conteggio fisico</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Dove stai facendo l’inventario?</h1></div></div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Scegli prima il tipo di sede. Le scansioni verranno raccolte in una lista e associate soltanto alla sede selezionata.</p>
          </header>
          <div className="p-5 sm:p-10">
            {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
            <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">1. Scegli il tipo</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DestinationKind active={kind === "SALON"} icon={Store} title="Salone" description="Conteggio della merce presente in un salone" onClick={() => chooseKind("SALON")} />
              <DestinationKind active={kind === "WAREHOUSE"} icon={Warehouse} title="Magazzino" description="Conteggio della merce presente in magazzino" onClick={() => chooseKind("WAREHOUSE")} />
            </div>
            {kind && <div className="mt-8"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">2. Scegli la sede esatta</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{matchingLocations.map((location) => <button key={location.id} onClick={() => setLocationId(location.id)} className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${locationId === location.id ? "border-sky-600 bg-sky-50 ring-4 ring-sky-100" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${locationId === location.id ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}><MapPin className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-black">{location.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{location.address || location.code}</span></span>{locationId === location.id && <Check className="h-5 w-5 shrink-0 text-sky-700" />}</button>)}</div></div>}
            {selectedLocation && <div className="mt-8"><label htmlFor="inventory-date" className="block text-xs font-black uppercase tracking-[.18em] text-slate-500">3. Data dell’inventario</label><div className="mt-3 max-w-sm rounded-2xl border-2 border-slate-200 bg-slate-50 p-4"><input id="inventory-date" type="date" value={inventoryDate} max={today} onChange={(event) => setInventoryDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-black text-slate-950 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-100"/><p className="mt-2 text-xs font-semibold text-slate-500">Il conteggio sarà archiviato con questa data.</p></div></div>}
            <button onClick={begin} disabled={!selectedLocation || !inventoryDate} className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ffbd5b] px-6 text-base font-black text-slate-950 shadow-sm transition hover:bg-[#f3a92f] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto sm:min-w-64">Inizia il conteggio <ChevronRight className="h-5 w-5" /></button>
          </div>
        </section>
      </div>
    </main>
  );

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-[#f3f4f6] pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-[#131b2b] text-white shadow-lg">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffbd5b] text-slate-950"><ScanBarcode className="h-6 w-6" /></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Inventario del {readableDate(inventoryDate)}</p><h1 className="truncate text-xl font-black">{selectedLocation?.name}</h1></div></div>
          <button onClick={changeDestination} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-4 text-sm font-bold hover:bg-white/10">Cambia sede</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(360px,.65fr)_minmax(0,1.35fr)]">
        <section className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24">
          <div className="border-b border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Postazione scanner</p><h2 className="mt-1 text-xl font-black">Scansiona tutte le confezioni</h2><p className="mt-1 text-sm text-slate-500">Ogni lettura aggiunge una riga al conteggio.</p></div>
          <form onSubmit={scan} className="p-5"><label htmlFor="count-barcode" className="text-xs font-black uppercase tracking-wide text-slate-600">Barcode prodotto</label><div className="mt-2 flex overflow-hidden rounded-xl border-2 border-slate-300 bg-white focus-within:border-[#f3a92f] focus-within:ring-4 focus-within:ring-amber-100"><input id="count-barcode" ref={inputRef} value={code} onChange={(event) => setCode(event.target.value)} onFocus={(event) => event.currentTarget.select()} autoComplete="off" placeholder="Spara il codice…" className="min-h-16 min-w-0 flex-1 px-4 font-mono text-lg font-black outline-none"/><button disabled={busy || !code.trim()} className="min-w-24 bg-[#ffbd5b] px-4 font-black text-slate-950 hover:bg-[#f3a92f] disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Aggiungi"}</button></div></form>
          {(error || lastRead) && <div className={`mx-5 mb-5 flex items-start gap-3 rounded-xl border p-4 ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{error ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}<div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide">{error ? "Non aggiunto" : "Aggiunto"}</p><p className="mt-1 truncate text-sm font-bold">{error || lastRead}</p></div></div>}
          <div className="grid grid-cols-2 border-t border-slate-200"><div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Confezioni</p><p className="mt-1 text-3xl font-black tabular-nums">{scans.length}</p></div><div className="border-l border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prodotti</p><p className="mt-1 text-3xl font-black tabular-nums">{grouped.length}</p></div></div>
          {scans.length > 0 && <button onClick={() => { if (window.confirm("Vuoi svuotare tutto il conteggio?")) { setScans([]); setError(""); setLastRead(""); } }} className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-slate-200 text-sm font-bold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Svuota lista</button>}
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Lista temporanea</p><h2 className="mt-1 text-xl font-black">Prodotti contati</h2></div><span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">{scans.length} letture</span></div>
          {!scans.length ? <div className="flex min-h-[460px] flex-col items-center justify-center p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Boxes className="h-10 w-10" /></span><p className="mt-4 text-lg font-black text-slate-700">La lista è ancora vuota</p><p className="mt-1 max-w-sm text-sm text-slate-500">Scansiona il primo barcode. Il cursore rimarrà sempre pronto per il codice successivo.</p></div> : <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]"><div className="max-h-[68dvh] divide-y divide-slate-100 overflow-y-auto">{scans.map((item, index) => <div key={item.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-black tabular-nums text-slate-600">{scans.length - index}</span>{item.product.image_url ? <div className="flex min-w-0 items-center gap-3"><img src={item.product.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"/><ScanText item={item}/></div> : <div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Package className="h-5 w-5 text-slate-400" /></span><ScanText item={item}/></div>}<button onClick={() => removeScan(item.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Rimuovi ${item.product.name}`}><X className="h-5 w-5" /></button></div>)}</div><aside className="border-t border-slate-200 bg-slate-50 p-5 xl:border-l xl:border-t-0"><h3 className="font-black">Riepilogo per prodotto</h3><p className="mt-1 text-sm text-slate-500">Le letture uguali vengono sommate.</p><div className="mt-4 max-h-[55dvh] space-y-2 overflow-y-auto">{grouped.map((item) => <div key={item.product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-bold leading-snug">{item.product.name}</span><span className="mt-1 block font-mono text-[11px] text-slate-500">{item.product.barcode || item.product.sku}</span></span><span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-sky-100 px-2 text-lg font-black tabular-nums text-sky-800">{item.quantity}</span></div>)}</div></aside></div>}
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-black">{selectedLocation?.name}</p><p className="truncate text-xs text-slate-500">{readableDate(inventoryDate)} · {scans.length} confezioni da salvare</p></div><button onClick={() => void saveCount()} disabled={!scans.length || busy} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-black text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />} Salva inventario</button></div></footer>
    </main>
  );
}

function DestinationKind({ active, icon: Icon, title, description, onClick }: { active: boolean; icon: typeof Store; title: string; description: string; onClick: () => void }) {
  return <button onClick={onClick} className={`group flex min-h-32 items-center gap-4 rounded-2xl border-2 p-5 text-left transition ${active ? "border-sky-600 bg-sky-50 ring-4 ring-sky-100" : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"}`}><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"}`}><Icon className="h-7 w-7" /></span><span className="min-w-0 flex-1"><span className="block text-xl font-black">{title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span></span>{active && <CheckCircle2 className="h-6 w-6 shrink-0 text-sky-700" />}</button>;
}

function ScanText({ item }: { item: ResolvedScan }) {
  return <span className="min-w-0"><span className="block truncate text-sm font-black">{item.product.name}</span><span className="mt-0.5 block truncate font-mono text-xs text-slate-500">{item.code}</span>{item.label && <span className="mt-0.5 block truncate text-[11px] font-bold text-sky-700">Confezione {item.label.label_code} · {item.label.location.name}</span>}</span>;
}
