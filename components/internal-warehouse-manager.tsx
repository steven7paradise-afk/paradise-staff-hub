"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  FolderPlus,
  MapPin,
  Minus,
  PackagePlus,
  PackageSearch,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Shuffle,
  Store,
  Undo2,
  Warehouse,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { WarehouseOrder, WarehouseProduct, WarehouseState } from "@/lib/internal-warehouse";

type Props = {
  initialState: WarehouseState;
  orders: WarehouseOrder[];
  canManage: boolean;
};

const lengths = [
  ["cm40", "40"],
  ["cm55", "55"],
  ["cm65", "65"],
  ["cm75", "75"],
] as const;

function euro(value: string) {
  const num = Number(String(value || "0").replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return "Non indicato";
  return num.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function matches(product: WarehouseProduct, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return product.name.toLowerCase().includes(q);
}

function shortProductName(name: string) {
  return name.replace(" - MICROTESSITURA PARADISE", "").replace("MICROTESSITURA PARADISE", "").trim();
}

function formatDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

const palmareTasks = [
  { id: "ricezione", label: "Ricezione", count: 12, icon: PackagePlus, tone: "text-[#1646A0]", badge: "bg-red-500" },
  { id: "prelievo", label: "Prelievo", count: 18, icon: PackageSearch, tone: "text-[#101820]", badge: "bg-red-500" },
  { id: "inventario", label: "Inventario", count: 7, icon: ScanLine, tone: "text-[#16A34A]", badge: "bg-red-500" },
  { id: "trasferimenti", label: "Trasferimenti", count: 5, icon: Shuffle, tone: "text-[#F59E0B]", badge: "bg-amber-400" },
  { id: "resi", label: "Resi", count: 3, icon: Undo2, tone: "text-[#6D28D9]", badge: "bg-red-500" },
  { id: "rettifiche", label: "Rettifiche", count: 2, icon: RotateCcw, tone: "text-[#0F5C9E]", badge: "bg-red-500" },
] as const;

type ScanStep = "location" | "product" | "quantity" | "confirm";
type ScanFeedback = "idle" | "success" | "error" | "warning";

export function InternalWarehouseManager({ initialState, orders, canManage }: Props) {
  const [state, setState] = useState(initialState);
  const [selectedInventoryId, setSelectedInventoryId] = useState(initialState.inventories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialState.collections[0]?.id ?? "");
  const [collectionName, setCollectionName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStep, setScanStep] = useState<ScanStep>("location");
  const [scanLocation, setScanLocation] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [expectedQty, setExpectedQty] = useState("1");
  const [countedQty, setCountedQty] = useState("");
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>("idle");
  const [scanMessage, setScanMessage] = useState("Pronto alla scansione.");
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedSalon, setSelectedSalon] = useState("Tutti");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedInventory = state.inventories.find((inventory) => inventory.id === selectedInventoryId) ?? state.inventories[0];
  const selectedCollection = state.collections.find((collection) => collection.id === selectedCollectionId) ?? state.collections[0];

  const totals = useMemo(() => {
    return state.inventories.reduce(
      (sum, inventory) => {
        sum.total += inventory.totals.total;
        if (inventory.kind === "SALONE") sum.saloni += inventory.totals.total;
        if (inventory.kind === "MAGAZZINO") sum.magazzini += inventory.totals.total;
        return sum;
      },
      { total: 0, saloni: 0, magazzini: 0 },
    );
  }, [state.inventories]);

  const filteredProducts = useMemo(() => {
    return (selectedInventory?.products ?? []).filter((product) => matches(product, query));
  }, [selectedInventory, query]);

  const scannerMatches = useMemo(() => {
    return state.inventories
      .flatMap((inventory) => inventory.products.map((product) => ({ inventory, product })))
      .filter(({ product }) => matches(product, scanQuery))
      .slice(0, 8);
  }, [state.inventories, scanQuery]);

  const selectedScanProduct = scannerMatches[0]?.product;
  const selectedScanInventory = scannerMatches[0]?.inventory;
  const scanDelta = Number(countedQty || 0) - Number(expectedQty || 0);
  const scanProgress = scanStep === "location" ? 1 : scanStep === "product" ? 2 : scanStep === "quantity" ? 3 : 4;

  const dates = useMemo(() => Array.from(new Set([todayKey(), ...orders.map((order) => order.dateKey)])).slice(0, 18), [orders]);
  const salons = useMemo(() => ["Tutti", ...Array.from(new Set(orders.map((order) => order.salon).filter(Boolean)))], [orders]);
  const dailyOrders = useMemo(() => {
    return orders.filter((order) => {
      const dateOk = !selectedDate || order.dateKey === selectedDate;
      const salonOk = selectedSalon === "Tutti" || order.salon === selectedSalon;
      return dateOk && salonOk;
    });
  }, [orders, selectedDate, selectedSalon]);

  const dailyProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; orders: WarehouseOrder[] }>();
    dailyOrders.forEach((order) => {
      order.products.forEach((line) => {
        const quantityMatch = line.match(/\(x\s*(\d+)\)/i);
        const qty = quantityMatch ? Number(quantityMatch[1]) || 1 : 1;
        const cleanName = line.replace(/\(x\s*\d+\)/i, "").trim();
        const key = cleanName.toLowerCase();
        const item = map.get(key) ?? { name: cleanName, qty: 0, orders: [] };
        item.qty += qty;
        item.orders.push(order);
        map.set(key, item);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [dailyOrders]);

  async function mutate(payload: Record<string, unknown>) {
    setFeedback("");
    startTransition(async () => {
      const response = await fetch("/api/magazzino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.error || "Operazione non riuscita.");
        return;
      }
      setState(data.state);
      setFeedback("Salvato");
    });
  }

  function createCollection() {
    if (!collectionName.trim()) return;
    mutate({ action: "createCollection", name: collectionName.trim() });
    setCollectionName("");
  }

  function addProduct() {
    if (!selectedInventory || !newProductName.trim()) return;
    mutate({
      action: "createProduct",
      inventoryId: selectedInventory.id,
      name: newProductName.trim(),
      collectionIds: selectedCollectionId ? [selectedCollectionId] : [],
    });
    setNewProductName("");
  }

  function attachToCollection(productId: string) {
    if (!selectedCollectionId) return;
    mutate({ action: "addProductToCollection", collectionId: selectedCollectionId, productId });
  }

  function playScanTone(type: Exclude<ScanFeedback, "idle">) {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = type === "success" ? 880 : type === "warning" ? 520 : 180;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }

  function showScanFeedback(type: Exclude<ScanFeedback, "idle">, message: string) {
    setScanFeedback(type);
    setScanMessage(message);
    playScanTone(type);
    window.setTimeout(() => setScanFeedback("idle"), 850);
  }

  function advanceScan() {
    if (scanStep === "location") {
      if (!scanLocation.trim()) {
        showScanFeedback("error", "Scansiona prima l'ubicazione.");
        return;
      }
      setScanStep("product");
      showScanFeedback("success", "Ubicazione confermata.");
      return;
    }
    if (scanStep === "product") {
      if (!selectedScanProduct) {
        showScanFeedback("error", "Prodotto non riconosciuto.");
        return;
      }
      setCountedQty(String(selectedScanProduct.total));
      setScanStep("quantity");
      showScanFeedback("success", "Prodotto trovato.");
      return;
    }
    if (scanStep === "quantity") {
      setScanStep("confirm");
      showScanFeedback(scanDelta < 0 ? "warning" : "success", scanDelta < 0 ? "Differenza da verificare." : "Quantita in linea.");
      return;
    }
    setPendingSync((value) => value + 1);
    setScanStep("location");
    setScanLocation("");
    setScanQuery("");
    setExpectedQty("1");
    setCountedQty("");
    showScanFeedback("success", offlineMode ? "Conteggio salvato in coda offline." : "Conteggio confermato.");
  }

  function goBackScan() {
    if (scanStep === "confirm") setScanStep("quantity");
    else if (scanStep === "quantity") setScanStep("product");
    else if (scanStep === "product") setScanStep("location");
  }

  function adjustCount(delta: number) {
    const current = Number(countedQty || 0);
    setCountedQty(String(Math.max(0, current + delta)));
  }

  function pressQuantityKey(key: string) {
    if (key === "back") {
      setCountedQty((value) => value.slice(0, -1));
      return;
    }
    if (key === "clear") {
      setCountedQty("");
      return;
    }
    setCountedQty((value) => `${value}${key}`.replace(/^0+(\d)/, "$1"));
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-black/5 bg-[#171514] text-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.34em] text-[#E8C98B]">Paradise Inventory</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">Magazzino</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Saloni, magazzini, collezioni e uscite prodotto lette dalle schede Controllo Cliente.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["Totale stock", totals.total],
                ["Nei saloni", totals.saloni],
                ["In magazzino", totals.magazzini],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-3xl font-medium">{value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/42">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 bg-[#211D1B] p-6 lg:border-l lg:border-t-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#E8C98B]">Palmare</p>
            <h2 className="mt-2 text-2xl font-medium">Palmare operativo</h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Flusso rapido per magazzino: scanner come input principale, step singoli, feedback sonoro e visivo immediato.
            </p>
            <Link
              href="/magazzino/palmare"
              className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#FFA8DD] text-sm font-medium text-[#1F1F1F]"
            >
              <ScanLine className="size-5" />
              Apri palmare
            </Link>
          </div>
        </div>
      </section>

      {scannerOpen ? (
        <section
          className={`overflow-hidden rounded-[28px] border shadow-sm transition sm:rounded-[34px] ${
            scanFeedback === "success"
              ? "border-emerald-300 bg-emerald-50"
              : scanFeedback === "error"
                ? "border-red-300 bg-red-50"
                : scanFeedback === "warning"
                  ? "border-amber-300 bg-amber-50"
                  : "border-black/5 bg-[#0E0E0E]"
          }`}
        >
          <div className="grid gap-0 xl:grid-cols-[390px_1fr]">
            <div className="bg-[#EEF2F7] p-3 text-[#0D1B2A] sm:p-5">
              <div className="overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-sm">
                <div className="flex h-12 items-center justify-between bg-[#111B26] px-3 text-xs text-white">
                  <span>09:41</span>
                  <span className="truncate px-2">MAG01 | Paradise Staff</span>
                  <span>85%</span>
                </div>
                <div className="grid grid-cols-2">
                {palmareTasks.map((task) => {
                  const Icon = task.icon;
                  const active = task.id === "inventario";
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={`relative min-h-28 border-b border-r border-black/10 bg-white p-4 text-center transition active:scale-[0.98] ${active ? "bg-[#F2FFF5]" : ""}`}
                    >
                      <span className={`absolute right-3 top-3 grid size-7 place-items-center rounded-full text-xs text-white ${task.badge}`}>
                        {task.count}
                      </span>
                      <Icon className={`mx-auto mt-2 size-9 ${task.tone}`} />
                      <p className="mt-3 text-base text-[#0D1B2A]">{task.label}</p>
                    </button>
                  );
                })}
                </div>
                <div className="flex h-12 items-center justify-between bg-[#111B26] px-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setOfflineMode((value) => !value)}
                    className={`flex items-center gap-2 ${offlineMode ? "text-amber-300" : "text-emerald-400"}`}
                  >
                    {offlineMode ? <WifiOff className="size-4" /> : <Wifi className="size-4" />}
                    {offlineMode ? "OFFLINE" : "ONLINE"}
                  </button>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-white">{pendingSync} in coda</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111] p-4 text-white sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#E8C98B]">Inventario palmare</p>
                  <h2 className="mt-1 text-2xl font-medium sm:text-3xl">Conteggio guidato</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-2">Magazzino: {selectedInventory?.name ?? "Seleziona"}</span>
                  <span className="rounded-full bg-white/10 px-3 py-2">Coda: {pendingSync}</span>
                  <span className="rounded-full bg-white/10 px-3 py-2">Step {scanProgress}/4</span>
                </div>
              </div>

              <div className={`mt-5 rounded-3xl border px-4 py-3 text-sm ${
                scanFeedback === "success"
                  ? "border-emerald-300 bg-emerald-400 text-black"
                  : scanFeedback === "error"
                    ? "border-red-300 bg-red-500 text-white"
                    : scanFeedback === "warning"
                      ? "border-amber-300 bg-amber-300 text-black"
                      : "border-white/10 bg-white/[0.06] text-white/72"
              }`}>
                {scanMessage}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-4">
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {["Ubicazione", "Prodotto", "Quantita", "Conferma"].map((label, index) => (
                      <div key={label} className={`rounded-xl px-2 py-2 text-center text-[10px] sm:rounded-2xl sm:px-3 sm:text-xs ${index + 1 <= scanProgress ? "bg-[#FFA8DD] text-black" : "bg-white/10 text-white/42"}`}>
                        {label}
                      </div>
                    ))}
                  </div>

                  {scanStep === "location" ? (
                    <div className="mt-5">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Scansiona ubicazione</p>
                      <label className="mt-3 flex min-h-24 items-center gap-3 rounded-3xl border border-white/10 bg-black px-5 sm:min-h-20">
                        <MapPin className="size-7 text-[#FFA8DD]" />
                        <input
                          value={scanLocation}
                          onChange={(event) => setScanLocation(event.target.value)}
                          autoFocus
                          placeholder="Es. BA-SCAFFALE-01"
                          className="w-full bg-transparent text-xl outline-none placeholder:text-white/25 sm:text-2xl"
                        />
                      </label>
                    </div>
                  ) : null}

                  {scanStep === "product" ? (
                    <div className="mt-5">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Scansiona prodotto</p>
                      <label className="mt-3 flex min-h-24 items-center gap-3 rounded-3xl border border-white/10 bg-black px-5 sm:min-h-20">
                        <ScanLine className="size-7 text-[#FFA8DD]" />
                        <input
                          value={scanQuery}
                          onChange={(event) => setScanQuery(event.target.value)}
                          autoFocus
                          placeholder="Codice, colore o prodotto"
                          className="w-full bg-transparent text-xl outline-none placeholder:text-white/25 sm:text-2xl"
                        />
                      </label>
                      <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                        {scannerMatches.map(({ inventory, product }) => (
                          <button
                            key={`${inventory.id}-${product.id}`}
                            type="button"
                            onClick={() => {
                              setScanQuery(product.name);
                              setCountedQty(String(product.total));
                              showScanFeedback("success", "Prodotto selezionato.");
                            }}
                            className="grid w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-left sm:grid-cols-[1fr_auto]"
                          >
                            <span>
                              <span className="block text-sm">{shortProductName(product.name)}</span>
                              <span className="mt-1 block text-xs text-white/45">{inventory.name}</span>
                            </span>
                            <span className="self-center rounded-full bg-white/10 px-3 py-1 text-sm">{product.total} pz</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {scanStep === "quantity" || scanStep === "confirm" ? (
                    <div className="mt-5">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Prodotto riconosciuto</p>
                      <div className="mt-3 rounded-3xl border border-white/10 bg-black p-4">
                        <p className="text-xl">{selectedScanProduct ? shortProductName(selectedScanProduct.name) : "Prodotto"}</p>
                        <p className="mt-1 text-sm text-white/45">{selectedScanInventory?.name ?? scanLocation}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <label className="rounded-3xl border border-white/10 bg-black p-4">
                          <span className="text-xs uppercase tracking-[0.2em] text-white/42">Attesa</span>
                          <input
                            value={expectedQty}
                            onChange={(event) => setExpectedQty(event.target.value)}
                            inputMode="numeric"
                            className="mt-2 w-full bg-transparent text-4xl outline-none"
                          />
                        </label>
                        <label className="rounded-3xl border border-white/10 bg-black p-4">
                          <span className="text-xs uppercase tracking-[0.2em] text-white/42">Contata</span>
                          <input
                            value={countedQty}
                            onChange={(event) => setCountedQty(event.target.value)}
                            inputMode="numeric"
                            placeholder="0"
                            className="mt-2 w-full bg-transparent text-4xl outline-none placeholder:text-white/25"
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => adjustCount(-1)} className="h-16 rounded-2xl bg-white/10 text-2xl"><Minus className="mx-auto size-7" /></button>
                        <button type="button" onClick={() => setCountedQty(expectedQty)} className="h-16 rounded-2xl bg-white/10 text-sm">Uguale</button>
                        <button type="button" onClick={() => adjustCount(1)} className="h-16 rounded-2xl bg-white/10 text-2xl"><Plus className="mx-auto size-7" /></button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"].map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => pressQuantityKey(key)}
                            className="h-14 rounded-xl border border-white/10 bg-white/[0.08] text-xl"
                          >
                            {key === "back" ? "⌫" : key === "clear" ? "C" : key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[30px] border border-white/10 bg-black p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Verifica</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-3xl bg-white/10 p-4">
                      <p className="text-xs text-white/42">Ubicazione</p>
                      <p className="mt-1 text-lg">{scanLocation || "In attesa"}</p>
                    </div>
                    <div className="rounded-3xl bg-white/10 p-4">
                      <p className="text-xs text-white/42">Differenza</p>
                      <p className={`mt-1 text-4xl ${scanDelta < 0 ? "text-red-300" : scanDelta > 0 ? "text-sky-300" : "text-emerald-300"}`}>
                        {scanDelta}
                      </p>
                    </div>
                    {scanDelta < 0 ? (
                      <div className="rounded-3xl border border-red-300/40 bg-red-400/10 p-4 text-sm text-red-100">
                        Stock inferiore al previsto. Puoi confermare la rottura o tornare indietro.
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5 grid grid-cols-[0.35fr_1fr] gap-2">
                    <button type="button" onClick={goBackScan} className="h-16 rounded-2xl bg-white/10">
                      <Undo2 className="mx-auto size-6" />
                    </button>
                    <button type="button" onClick={advanceScan} className="h-16 rounded-2xl bg-[#FFA8DD] text-lg text-black">
                      {scanStep === "confirm" ? "Conferma conteggio" : "Avanti"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-[30px] border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {state.inventories.map((inventory) => {
              const active = inventory.id === selectedInventory?.id;
              return (
                <button
                  key={inventory.id}
                  type="button"
                  onClick={() => setSelectedInventoryId(inventory.id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    active ? "border-[#D7B46A] bg-[#FFF9ED]" : "border-black/5 bg-white hover:border-[#D7B46A]/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`grid size-10 place-items-center rounded-2xl ${inventory.kind === "SALONE" ? "bg-[#F8D7E8]" : "bg-[#1F1F1F] text-white"}`}>
                      {inventory.kind === "SALONE" ? <Store className="size-4" /> : <Warehouse className="size-4" />}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-[#8A6B2B]">{inventory.totals.total} pz</span>
                  </div>
                  <p className="mt-4 text-base font-medium text-[#1F1F1F]">{inventory.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/38">{inventory.collection}</p>
                </button>
              );
            })}
          </div>

          {selectedInventory ? (
            <>
              <div className="mt-5 grid gap-3 rounded-3xl border border-black/5 bg-[#FAF7F8] p-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-black/38">Inventario selezionato</p>
                  <h2 className="mt-1 text-2xl font-medium text-[#1F1F1F]">{selectedInventory.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lengths.map(([key, label]) => (
                      <span key={key} className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs text-[#1F1F1F]">
                        {label} cm · {selectedInventory.totals[key]}
                      </span>
                    ))}
                  </div>
                </div>
                <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/5 bg-white px-4">
                  <Search className="size-4 text-black/35" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cerca colore o prodotto..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-black/35"
                  />
                </label>
              </div>

              <div className="mt-5 overflow-hidden rounded-3xl border border-black/5">
                <div className="grid grid-cols-[1fr_56px_56px_56px_56px_64px] bg-[#1F1F1F] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/62">
                  <span>Prodotto</span>
                  {lengths.map(([, label]) => <span key={label} className="text-center">{label}</span>)}
                  <span className="text-center">Tot</span>
                </div>
                <div className="max-h-[620px] overflow-auto">
                  {filteredProducts.map((product) => {
                    const attached = selectedCollection?.productIds.includes(product.id);
                    return (
                      <div key={product.id} className="grid grid-cols-[1fr_56px_56px_56px_56px_64px] items-center border-b border-black/5 px-4 py-3 text-sm last:border-b-0">
                        <button
                          type="button"
                          disabled={!canManage || !selectedCollection || attached}
                          onClick={() => attachToCollection(product.id)}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate font-medium text-[#1F1F1F]">{shortProductName(product.name)}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-black/35">
                            {attached ? `In ${selectedCollection?.name}` : selectedInventory.salon}
                          </p>
                        </button>
                        {lengths.map(([key]) => (
                          <span key={key} className="text-center text-[#1F1F1F]">{product.quantities[key]}</span>
                        ))}
                        <span className="justify-self-center rounded-full bg-[#F7E9EF] px-3 py-1 text-[#1F1F1F]">{product.total}</span>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 ? <div className="p-6 text-sm text-black/45">Nessun prodotto trovato.</div> : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#C45C86]">Collezioni</p>
            <div className="mt-4 space-y-2">
              {state.collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => setSelectedCollectionId(collection.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left ${collection.id === selectedCollectionId ? "border-[#D7B46A] bg-[#FFF9ED]" : "border-black/5 bg-white"}`}
                >
                  <p className="font-medium text-[#1F1F1F]">{collection.name}</p>
                  <p className="text-xs text-black/45">{collection.productIds.length} prodotti</p>
                </button>
              ))}
            </div>
            {canManage ? (
              <div className="mt-4 space-y-3">
                <input
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  placeholder="Nuova collezione"
                  className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#D7B46A]"
                />
                <button onClick={createCollection} disabled={isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1F1F1F] text-sm font-medium text-white">
                  <FolderPlus className="size-4" />
                  Crea collezione
                </button>
              </div>
            ) : null}
          </div>

          {canManage ? (
            <div className="rounded-[30px] border border-black/5 bg-[#FAF7F8] p-5 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.24em] text-black/42">Aggiungi prodotto</p>
              <p className="mt-2 text-sm leading-6 text-black/52">Lo aggiungo al salone o magazzino selezionato.</p>
              <input
                value={newProductName}
                onChange={(event) => setNewProductName(event.target.value)}
                placeholder="Nome prodotto"
                className="mt-4 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none"
              />
              <button onClick={addProduct} disabled={isPending} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFA8DD] text-sm font-medium text-[#1F1F1F]">
                <PackagePlus className="size-4" />
                Aggiungi
              </button>
              {feedback ? <p className="mt-3 text-xs text-black/45">{feedback}</p> : null}
            </div>
          ) : null}
        </aside>
      </section>

      <section className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#C45C86]">Uscite prodotto</p>
            <h2 className="mt-1 text-2xl font-medium text-[#1F1F1F]">Calendario movimenti</h2>
            <p className="mt-2 text-sm text-black/50">Mostra solo prodotti trovati nelle schede Controllo Cliente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedSalon} onChange={(event) => setSelectedSalon(event.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none">
              {salons.map((salon) => <option key={salon}>{salon}</option>)}
            </select>
            <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none">
              {dates.map((day) => <option key={day} value={day}>{formatDay(day)}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {dates.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(day)}
              className={`min-w-24 rounded-2xl border px-4 py-3 text-left ${selectedDate === day ? "border-[#D7B46A] bg-[#FFF9ED]" : "border-black/5 bg-[#FAF7F8]"}`}
            >
              <CalendarDays className="mb-2 size-4 text-[#C45C86]" />
              <p className="text-sm font-medium text-[#1F1F1F]">{formatDay(day)}</p>
              <p className="text-xs text-black/42">{orders.filter((order) => order.dateKey === day).length} schede</p>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-3xl border border-black/5 bg-[#FAF7F8] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Prodotti usciti</p>
            <div className="mt-3 space-y-2">
              {dailyProducts.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3">
                  <p className="text-sm font-medium text-[#1F1F1F]">{shortProductName(item.name)}</p>
                  <span className="rounded-full bg-[#F7E9EF] px-3 py-1 text-sm text-[#1F1F1F]">{item.qty}</span>
                </div>
              ))}
              {dailyProducts.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-black/45">Nessuna uscita prodotto per questo filtro.</p> : null}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {dailyOrders.map((order) => (
              <article key={order.id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium text-[#1F1F1F]">{order.clientName || "Cliente senza nome"}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/38">
                      {order.orderNumber ? `Ordine ${order.orderNumber}` : "Senza ordine"} · {order.salon}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                    <Check className="mr-1 inline size-3" />Letto
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {order.products.map((product) => (
                    <p key={product} className="rounded-2xl bg-[#FAF7F8] px-3 py-2 text-sm text-[#1F1F1F]">{product}</p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/48">
                  <span className="rounded-full bg-[#F7E9EF] px-3 py-1 text-[#1F1F1F]">{euro(order.paid)}</span>
                  <span className="rounded-full bg-[#FAF7F8] px-3 py-1">{order.userName}</span>
                  <span className="rounded-full bg-[#FAF7F8] px-3 py-1">{order.dateLabel}</span>
                </div>
              </article>
            ))}
            {dailyOrders.length === 0 ? <p className="rounded-3xl border border-dashed border-black/10 p-6 text-sm text-black/45">Nessuna scheda con prodotti per questa data.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
