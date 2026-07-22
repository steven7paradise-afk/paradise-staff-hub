"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BatteryFull,
  Check,
  ChevronLeft,
  LocateFixed,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  ScanLine,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { findWarehouseBarcode, normalizeWarehouseToken } from "@/lib/warehouse-barcodes";
import type { WarehouseInventory, WarehouseOrder, WarehouseProduct, WarehouseState } from "@/lib/internal-warehouse";

type Props = {
  initialState: WarehouseState;
  orders: WarehouseOrder[];
  userName: string;
};

type ModuleId = "home" | "ricezione" | "prelievo" | "inventario" | "trasferimenti" | "resi" | "rettifiche";
type ScanStep = "location" | "product" | "quantity" | "confirm";
type Feedback = "idle" | "success" | "error" | "warning";

const modules = [
  { id: "ricezione", label: "Ricezione", count: 12, badge: "bg-red-500", description: "Entrata merce" },
  { id: "prelievo", label: "Prelievo", count: 18, badge: "bg-red-500", description: "Ordini da preparare" },
  { id: "inventario", label: "Inventario", count: 7, badge: "bg-red-500", description: "Conta prodotti" },
  { id: "trasferimenti", label: "Trasferimenti", count: 5, badge: "bg-amber-400", description: "Sposta stock" },
  { id: "resi", label: "Resi", count: 3, badge: "bg-red-500", description: "Rientri e resi" },
  { id: "rettifiche", label: "Rettifiche", count: 2, badge: "bg-red-500", description: "Correzioni" },
] as const;

const quickLocations = ["BA-01-01", "BA-01-02", "DU-01-01", "MAG-01", "MAG-02"];

function shortName(name: string) {
  return name.replace(" - MICROTESSITURA PARADISE", "").replace("MICROTESSITURA PARADISE", "").trim();
}

function matches(product: WarehouseProduct, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const barcode = findWarehouseBarcode(query);
  const productToken = normalizeWarehouseToken(product.name);
  if (barcode) {
    return barcode.families.some((family) => productToken.includes(normalizeWarehouseToken(family)));
  }
  return product.name.toLowerCase().includes(normalized) || productToken.includes(normalizeWarehouseToken(query));
}

function flattenProducts(inventories: WarehouseInventory[]) {
  return inventories.flatMap((inventory) => inventory.products.map((product) => ({ inventory, product })));
}

export function WarehouseHandheldApp({ initialState, orders, userName }: Props) {
  const [activeModule, setActiveModule] = useState<ModuleId>("home");
  const [selectedInventoryId, setSelectedInventoryId] = useState(initialState.inventories[0]?.id ?? "");
  const [offline, setOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [message, setMessage] = useState("Pronto alla scansione.");
  const [inventoryReady, setInventoryReady] = useState(false);
  const [inventoryDate, setInventoryDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()));
  const [step, setStep] = useState<ScanStep>("location");
  const [location, setLocation] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [expectedQty, setExpectedQty] = useState("1");
  const [countedQty, setCountedQty] = useState("");
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
  const scannerBufferRef = useRef("");
  const scannerTimerRef = useRef<number | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const refocusScanner = activeModule === "inventario" && inventoryReady;

  const inventory = initialState.inventories.find((item) => item.id === selectedInventoryId) ?? initialState.inventories[0];
  const productMatches = useMemo(
    () =>
      flattenProducts(initialState.inventories)
        .filter(({ inventory: itemInventory, product }) => itemInventory.id === selectedInventoryId && matches(product, productQuery))
        .slice(0, 5),
    [initialState.inventories, productQuery, selectedInventoryId],
  );
  const selectedProduct = productMatches[0]?.product;
  const selectedProductInventory = productMatches[0]?.inventory;
  const delta = Number(countedQty || 0) - Number(expectedQty || 0);
  const stepNumber = step === "location" ? 1 : step === "product" ? 2 : step === "quantity" ? 3 : 4;
  const todayOrders = orders.slice(0, 24);
  const selectedOrder = todayOrders[selectedOrderIndex];
  const productsToPick = (selectedOrder?.products ?? []).slice(0, 4);

  function findScannedProduct(code: string) {
    const normalized = code.trim().toLowerCase();
    const compactCode = normalized.replace(/[^a-z0-9]/g, "");
    const barcode = findWarehouseBarcode(code);
    if (!normalized) return null;
    return (
      flattenProducts(initialState.inventories).find(({ inventory: itemInventory, product }) => {
        if (itemInventory.id !== selectedInventoryId) return false;
        const name = product.name.toLowerCase();
        const compactName = name.replace(/[^a-z0-9]/g, "");
        if (barcode) {
          const productToken = normalizeWarehouseToken(product.name);
          return barcode.families.some((family) => productToken.includes(normalizeWarehouseToken(family)));
        }
        return name.includes(normalized) || compactName.includes(compactCode);
      }) ?? null
    );
  }

  function processScannerCode(code: string) {
    const cleanCode = code.trim();
    if (!cleanCode || activeModule !== "inventario" || !inventoryReady) return;

    const found = findScannedProduct(cleanCode);
    setProductQuery(found?.product.name ?? cleanCode);
    if (!found) {
      setStep("product");
      flash("error", `Codice ${cleanCode} non trovato in questo salone/magazzino.`);
      return;
    }

    setCountedQty(String(found.product.total));
    setStep("quantity");
    flash("success", `${shortName(found.product.name)} trovato.`);
  }

  useEffect(() => {
    if (activeModule !== "inventario" || !inventoryReady) return;

    scannerInputRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if ((tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") && target !== scannerInputRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        event.preventDefault();
        const code = scannerBufferRef.current;
        scannerBufferRef.current = "";
        if (scannerInputRef.current) scannerInputRef.current.value = "";
        processScannerCode(code);
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        if (!scannerBufferRef.current) {
          setProductQuery("");
          setCountedQty("");
          setStep("product");
        }
        scannerBufferRef.current += event.key;
        if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
        scannerTimerRef.current = window.setTimeout(() => {
          const code = scannerBufferRef.current;
          scannerBufferRef.current = "";
          if (scannerInputRef.current) scannerInputRef.current.value = "";
          processScannerCode(code);
        }, 90);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
    };
  }, [activeModule, inventoryReady, selectedInventoryId, step, initialState.inventories]);

  useEffect(() => {
    if (!refocusScanner) return;
    const interval = window.setInterval(() => {
      const target = document.activeElement;
      if (target instanceof HTMLElement && target.dataset.manualInput === "true") return;
      if (target !== scannerInputRef.current) scannerInputRef.current?.focus({ preventScroll: true });
    }, 150);
    return () => window.clearInterval(interval);
  }, [refocusScanner]);

  function beep(type: Exclude<Feedback, "idle">) {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type === "error" ? "square" : "sine";
    oscillator.frequency.value = type === "success" ? 920 : type === "warning" ? 520 : 180;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  }

  function flash(type: Exclude<Feedback, "idle">, text: string) {
    setFeedback(type);
    setMessage(text);
    beep(type);
    window.setTimeout(() => setFeedback("idle"), 900);
  }

  function resetFlow() {
    setStep("location");
    setLocation("");
    setProductQuery("");
    setExpectedQty("1");
    setCountedQty("");
  }

  function openModule(moduleId: ModuleId) {
    setActiveModule(moduleId);
    if (moduleId === "inventario") {
      setInventoryReady(false);
      resetFlow();
      return;
    }
    flash("success", `${modules.find((item) => item.id === moduleId)?.label ?? "Modulo"} aperto.`);
  }

  function nextStep() {
    if (step === "location") {
      if (!location.trim()) {
        flash("error", "Scansiona ubicazione.");
        return;
      }
      setStep("product");
      flash("success", "Ubicazione confermata.");
      return;
    }
    if (step === "product") {
      if (!selectedProduct) {
        flash("error", "Prodotto non riconosciuto.");
        return;
      }
      setCountedQty(String(selectedProduct.total));
      setStep("quantity");
      flash("success", "Prodotto trovato.");
      return;
    }
    if (step === "quantity") {
      setStep("confirm");
      flash(delta < 0 ? "warning" : "success", delta < 0 ? "Differenza da verificare." : "Quantita in linea.");
      return;
    }
    setPendingSync((value) => value + 1);
    resetFlow();
    flash("success", offline ? "Salvato in coda offline." : "Conteggio salvato.");
  }

  function previousStep() {
    if (step === "confirm") setStep("quantity");
    else if (step === "quantity") setStep("product");
    else if (step === "product") setStep("location");
    else setActiveModule("home");
  }

  function quantityKey(key: string) {
    if (key === "clear") {
      setCountedQty("");
      return;
    }
    if (key === "back") {
      setCountedQty((value) => value.slice(0, -1));
      return;
    }
    setCountedQty((value) => `${value}${key}`.replace(/^0+(\d)/, "$1"));
  }

  return (
    <main
      className={`h-[100dvh] overflow-hidden bg-[#EEF2F7] text-[#0D1B2A] transition ${
        feedback === "success" ? "shadow-[inset_0_0_0_10px_rgba(34,197,94,0.5)]" : feedback === "error" ? "shadow-[inset_0_0_0_10px_rgba(239,68,68,0.5)]" : feedback === "warning" ? "shadow-[inset_0_0_0_10px_rgba(245,158,11,0.5)]" : ""
      }`}
    >
      <div className="mx-auto flex h-[100dvh] max-w-[520px] flex-col overflow-hidden border-x border-black/10 bg-white">
        <header className="shrink-0 bg-[#111B26] text-white">
          <div className="flex h-10 items-center justify-between px-3 text-xs font-semibold">
            <span>09:41</span>
            <span className="truncate px-2">{inventory?.name ?? "Magazzino"} | {userName}</span>
            <span className="flex items-center gap-2">
              {offline ? <WifiOff className="size-4 text-amber-300" /> : <Wifi className="size-4 text-emerald-400" />}
              <BatteryFull className="size-4" />
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5">
            <button type="button" onClick={activeModule === "home" ? undefined : () => setActiveModule("home")} className="grid size-10 place-items-center rounded-xl bg-white/10">
              {activeModule === "home" ? <span className="text-sm font-bold">PB</span> : <ChevronLeft className="size-6" />}
            </button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{offline ? "Offline" : "Online"} · {pendingSync} in coda</p>
              <p className="text-sm font-semibold">{activeModule === "home" ? "Paradise Palmare" : modules.find((item) => item.id === activeModule)?.label}</p>
            </div>
            <Link href="/magazzino" className="grid size-10 place-items-center rounded-xl bg-white/10">
              <ArrowLeft className="size-5" />
            </Link>
          </div>
        </header>

        {feedback !== "idle" ? (
          <div
            className={`mx-3 mt-2 shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${
              feedback === "success"
                ? "bg-emerald-100 text-emerald-800"
                : feedback === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {message}
          </div>
        ) : null}

        {activeModule === "home" ? (
          <section className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <label className="shrink-0 rounded-2xl border-2 border-[#111B26] bg-white p-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Salone / magazzino attivo</span>
              <select
                value={selectedInventoryId}
                onChange={(event) => setSelectedInventoryId(event.target.value)}
                className="mt-1 h-12 w-full rounded-xl bg-slate-50 px-3 text-base font-bold outline-none"
              >
                {initialState.inventories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.kind === "SALONE" ? "Salone" : "Magazzino"} - {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-px overflow-hidden rounded-2xl border border-black/10">
              {modules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => openModule(module.id)}
                  className="relative min-h-0 bg-white p-4 text-left active:scale-[0.98]"
                >
                  <span className={`absolute right-3 top-3 grid size-8 place-items-center rounded-full text-sm font-bold text-white ${module.badge}`}>{module.count}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Modulo</span>
                  <p className="mt-2 text-xl font-bold">{module.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{module.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeModule === "inventario" ? (
          <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
            {!inventoryReady ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Inventario giornaliero</p>
                  <h1 className="mt-1 text-2xl font-bold">Scegli cosa contare</h1>
                </div>
                <label className="block rounded-2xl border border-black/10 p-4">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Giorno</span>
                  <input
                    type="date"
                    value={inventoryDate}
                    onChange={(event) => setInventoryDate(event.target.value)}
                    data-manual-input="true"
                    className="mt-2 h-14 w-full rounded-xl bg-slate-50 px-3 text-xl font-bold outline-none"
                  />
                </label>
                <label className="block rounded-2xl border border-black/10 p-4">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Salone o magazzino</span>
                  <select
                    value={selectedInventoryId}
                    onChange={(event) => setSelectedInventoryId(event.target.value)}
                    data-manual-input="true"
                    className="mt-2 h-14 w-full rounded-xl bg-slate-50 px-3 text-lg font-bold outline-none"
                  >
                    {initialState.inventories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.kind === "SALONE" ? "Salone" : "Magazzino"} - {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl bg-[#F7E9EF] p-4 text-sm font-semibold text-[#1F1F1F]">
                  Dopo la conferma il palmare resta in ascolto: scansiona un prodotto e lo cerca subito nel salone o magazzino scelto.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInventoryReady(true);
                    setStep("product");
                    window.setTimeout(() => scannerInputRef.current?.focus({ preventScroll: true }), 80);
                    flash("success", "Scanner attivo. Scansiona prodotto.");
                  }}
                  className="mt-auto h-16 rounded-2xl bg-[#14923F] text-lg font-bold text-white"
                >
                  Inizia inventario
                </button>
              </div>
            ) : (
              <>
                <div className="shrink-0 rounded-2xl border border-black/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Conteggio inventariale</p>
                      <h1 className="mt-0.5 text-xl font-bold">Wizard scanner</h1>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInventoryReady(false)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold"
                    >
                      Cambia
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {inventoryDate} · {inventory?.name ?? "Inventario"}
                  </p>
                  <input
                    ref={scannerInputRef}
                    aria-label="Ricevitore scanner"
                    className="mt-2 h-11 w-full rounded-xl border-2 border-[#14923F] bg-emerald-50 px-3 text-center text-base font-bold uppercase tracking-[0.12em] text-[#14923F] outline-none"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="SCANNER ATTIVO"
                    onFocus={() => {
                      scannerBufferRef.current = "";
                      scannerInputRef.current?.select();
                    }}
                    onBlur={() => {
                      if (refocusScanner) window.setTimeout(() => scannerInputRef.current?.focus({ preventScroll: true }), 30);
                    }}
                    onChange={(event) => {
                      const code = event.currentTarget.value.trim();
                      event.currentTarget.value = "";
                      scannerBufferRef.current = "";
                      if (code) processScannerCode(code);
                    }}
                  />
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {["Ubicazione", "Prodotto", "Quantita", "Salva"].map((label, index) => (
                      <span key={label} className={`rounded-xl px-2 py-2 text-center text-[10px] font-bold ${index + 1 <= stepNumber ? "bg-[#14923F] text-white" : "bg-slate-100 text-slate-400"}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {step === "location" ? (
              <div className="min-h-0 flex-1 rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-sm font-bold">1. Scansiona ubicazione</p>
                <label className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl bg-slate-50 px-4 ring-2 ring-[#14923F]/20">
                  <LocateFixed className="size-8 text-[#14923F]" />
                  <input value={location} onChange={(event) => setLocation(event.target.value)} autoFocus placeholder="A01-01-01" className="w-full bg-transparent text-3xl font-bold uppercase outline-none" />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {quickLocations.map((item) => (
                    <button key={item} type="button" onClick={() => setLocation(item)} className="h-12 rounded-xl border border-black/10 text-sm font-bold">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
                ) : null}

                {step === "product" ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-sm font-bold">2. Scansiona prodotto</p>
                <label className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl bg-slate-50 px-4 ring-2 ring-[#14923F]/20">
                  <ScanLine className="size-8 text-[#14923F]" />
                  <input value={productQuery} readOnly onFocus={() => scannerInputRef.current?.focus({ preventScroll: true })} onClick={() => scannerInputRef.current?.focus({ preventScroll: true })} placeholder="Scansiona codice prodotto" className="w-full bg-transparent text-2xl font-bold outline-none" />
                </label>
                <div className="mt-2 space-y-1.5 overflow-hidden">
                  {productMatches.map(({ inventory: itemInventory, product }) => (
                    <button
                      key={`${itemInventory.id}-${product.id}`}
                      type="button"
                      onClick={() => {
                        setProductQuery(product.name);
                        setCountedQty(String(product.total));
                        flash("success", "Prodotto selezionato.");
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-white p-2.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>
                          <span className="line-clamp-1 block text-sm font-bold">{shortName(product.name)}</span>
                          <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{itemInventory.name}</span>
                        </span>
                        <span className="rounded-full bg-[#F7E9EF] px-3 py-1 text-sm font-bold">{product.total} pz</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
                ) : null}

                {step === "quantity" || step === "confirm" ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-sm font-bold">{step === "quantity" ? "3. Inserisci quantita" : "4. Conferma conteggio"}</p>
                <div className="mt-2 rounded-2xl bg-slate-50 p-2.5">
                  <p className="line-clamp-1 text-sm font-bold">{selectedProduct ? shortName(selectedProduct.name) : "Prodotto"}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{selectedProductInventory?.name ?? inventory?.name}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="rounded-2xl border border-black/10 p-2.5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Atteso</span>
                    <input value={expectedQty} onChange={(event) => setExpectedQty(event.target.value)} data-manual-input="true" inputMode="numeric" className="mt-0.5 w-full bg-transparent text-3xl font-bold text-blue-700 outline-none" />
                  </label>
                  <label className="rounded-2xl border border-black/10 p-2.5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Conta</span>
                    <input value={countedQty} onChange={(event) => setCountedQty(event.target.value)} data-manual-input="true" inputMode="numeric" className="mt-0.5 w-full bg-transparent text-3xl font-bold text-green-600 outline-none" />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setCountedQty(String(Math.max(0, Number(countedQty || 0) - 1)))} className="h-12 rounded-xl border-2 border-blue-500 text-2xl font-bold text-blue-700">
                    <Minus className="mx-auto size-6" />
                  </button>
                  <button type="button" onClick={() => setCountedQty(expectedQty)} className="h-12 rounded-xl border-2 border-slate-200 text-sm font-bold">
                    Atteso
                  </button>
                  <button type="button" onClick={() => setCountedQty(String(Number(countedQty || 0) + 1))} className="h-12 rounded-xl border-2 border-blue-500 text-2xl font-bold text-blue-700">
                    <Plus className="mx-auto size-6" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"].map((key) => (
                    <button key={key} type="button" onClick={() => quantityKey(key)} className="h-11 rounded-xl border border-black/10 bg-slate-50 text-lg font-bold">
                      {key === "back" ? "⌫" : key === "clear" ? "C" : key}
                    </button>
                  ))}
                </div>
                <div className={`mt-2 rounded-2xl p-2.5 text-center text-lg font-bold ${delta < 0 ? "bg-red-50 text-red-600" : delta > 0 ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"}`}>
                  Differenza: {delta}
                </div>
              </div>
                ) : null}

                <div className="-mx-2 grid shrink-0 grid-cols-[0.35fr_1fr] gap-2 border-t border-black/10 bg-white p-2">
              <button type="button" onClick={previousStep} className="h-14 rounded-2xl border border-black/10 bg-white font-bold">
                <ChevronLeft className="mx-auto size-7" />
              </button>
              <button type="button" onClick={nextStep} className="h-14 rounded-2xl bg-[#14923F] text-lg font-bold text-white">
                {step === "confirm" ? "Salva conteggio" : "Conferma"}
              </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {activeModule === "prelievo" ? (
          <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
            <div className="shrink-0 rounded-2xl border border-black/10 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Prelievo ordini</p>
              <h1 className="mt-1 text-xl font-bold">Ordini da preparare</h1>
              <p className="mt-1 text-xs text-slate-500">Conferma ubicazione, scansiona prodotto, registra quantita.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setSelectedOrderIndex(Math.max(0, selectedOrderIndex - 1))} className="grid size-12 place-items-center rounded-xl border border-black/10">
                  <ChevronLeft className="size-5" />
                </button>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Ordine {selectedOrderIndex + 1} di {Math.max(todayOrders.length, 1)}</p>
                  <p className="text-xl font-bold">{selectedOrder?.orderNumber || "Nessun ordine"}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrderIndex(Math.min(todayOrders.length - 1, selectedOrderIndex + 1))} className="grid size-12 place-items-center rounded-xl border border-black/10">
                  <Plus className="size-5" />
                </button>
              </div>
              {selectedOrder ? (
                <div className="mt-3 space-y-2 overflow-hidden">
                  <p className="text-sm font-bold">{selectedOrder.clientName}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{selectedOrder.salon} · {selectedOrder.dateLabel}</p>
                  {productsToPick.map((product, index) => (
                    <button key={`${product}-${index}`} type="button" onClick={() => flash("success", "Prodotto confermato nel prelievo.")} className="flex w-full items-center justify-between rounded-2xl border border-black/10 p-3 text-left">
                      <span className="line-clamp-1 font-bold">{product}</span>
                      <Check className="size-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nessun ordine in coda.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeModule !== "home" && activeModule !== "inventario" && activeModule !== "prelievo" ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden p-5">
            <div className="rounded-3xl border border-black/10 bg-white p-6 text-center">
              <PackageCheck className="mx-auto size-12 text-[#FFA8DD]" />
              <h1 className="mt-4 text-2xl font-bold">{modules.find((item) => item.id === activeModule)?.label}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Modulo pronto per il palmare. Il prossimo passo e collegare questo flusso ai movimenti reali del magazzino.</p>
              <button type="button" onClick={() => flash("success", "Scansione simulata corretta.")} className="mt-5 h-14 w-full rounded-2xl bg-[#14923F] font-bold text-white">
                Simula scansione
              </button>
            </div>
          </section>
        ) : null}

        <footer className="z-10 flex shrink-0 items-center justify-between border-t border-black/10 bg-[#111B26] px-3 py-2 text-xs text-white">
          <button type="button" onClick={() => setOffline((value) => !value)} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            {offline ? <WifiOff className="size-4 text-amber-300" /> : <Wifi className="size-4 text-emerald-400" />}
            {offline ? "Offline" : "Online"}
          </button>
          <button type="button" className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Settings className="size-4" />
            Impost.
          </button>
          <Link href="/magazzino" className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <LogOut className="size-4" />
            Esci
          </Link>
        </footer>
      </div>
    </main>
  );
}
