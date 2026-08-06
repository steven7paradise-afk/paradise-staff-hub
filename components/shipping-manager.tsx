"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  PackageX,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Truck,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type LineItem = {
  id: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  sku: string;
  barcode: string;
};

type ShippingAddress = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  province?: string;
  country: string;
  phone?: string;
};

type ShipmentOrder = {
  shopifyOrderId: string;
  orderName: string;
  customerName: string;
  email: string;
  phone: string;
  createdAt: string;
  totalPrice: number;
  financialStatus: string;
  fulfillmentStatus: string;
  shippingMethod: string;
  shippingAddress: ShippingAddress;
  lineItems: LineItem[];
  status: "UNFULFILLED" | "PACKING" | "READY" | "SHIPPED";
  verifiedBarcodes: string[];
  photoUrl: string | null;
  notes: string | null;
  trackingNumber: string | null;
  courier: string | null;
  packedBy?: { id: string; name: string; photo_url?: string | null } | null;
};

const statusColumns = [
  { id: "UNFULFILLED", title: "Da Preparare", badge: "Inevasi", bg: "bg-amber-50 border-amber-200 text-amber-900" },
  { id: "PACKING", title: "In Imballaggio", badge: "In Corso", bg: "bg-blue-50 border-blue-200 text-blue-900" },
  { id: "READY", title: "Pronto per Spedizione", badge: "Verificati", bg: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  { id: "SHIPPED", title: "Spedito / Evaso", badge: "Evasi", bg: "bg-neutral-100 border-neutral-300 text-neutral-800" },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

const monthsList = [
  { value: 1, label: "Gennaio" },
  { value: 2, label: "Febbraio" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Aprile" },
  { value: 5, label: "Maggio" },
  { value: 6, label: "Giugno" },
  { value: 7, label: "Luglio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Settembre" },
  { value: 10, label: "Ottobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Dicembre" },
];

const currentYearNum = new Date().getFullYear();
const yearsList = Array.from({ length: 3 }, (_, i) => currentYearNum - 1 + i);

export function ShippingManager({
  initialOrders,
  currentUserName,
}: {
  initialOrders: ShipmentOrder[];
  currentUserName: string;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<ShipmentOrder[]>(initialOrders);
  const [viewMode, setViewMode] = useState<"KANBAN" | "TABLE">("KANBAN");
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShipmentOrder | null>(null);

  // Packing Modal State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [courier, setCourier] = useState("DHL Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera Barcode Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"TRACKING" | "BARCODE">("TRACKING");
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  function playBeepSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context ignored if not user gesture
    }
  }

  async function startCameraScanner(target: "TRACKING" | "BARCODE") {
    setCameraTarget(target);
    setIsCameraActive(true);
    setSavingStatus("Punta la fotocamera sul codice a barre o etichetta del corriere...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setSavingStatus("Impossibile accedere alla fotocamera. Inserisci il codice manualmente.");
      setIsCameraActive(false);
    }
  }

  function stopCameraScanner() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  }

  function handleScannedCodeFromCamera(code: string) {
    if (!code) return;
    const cleanCode = code.trim();
    playBeepSound();
    stopCameraScanner();

    if (cameraTarget === "TRACKING") {
      setTrackingNumber(cleanCode);
      setSavingStatus(`✓ Codice Tracciamento scansionato ed inserito: ${cleanCode}`);
    } else {
      setBarcodeInput(cleanCode);
      setScannedBarcodes((prev) => [...prev, cleanCode]);
      setSavingStatus(`✓ Codice articolo verificato: ${cleanCode}`);
    }
  }

  useEffect(() => {
    if (!isCameraActive) return;
    let intervalId: any = null;

    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "itf", "data_matrix"],
      });

      intervalId = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          try {
            const detected = await detector.detect(videoRef.current);
            if (detected && detected.length > 0) {
              const raw = detected[0].rawValue;
              if (raw) handleScannedCodeFromCamera(raw);
            }
          } catch (e) {
            // Ignore detection frame error
          }
        }
      }, 350);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive, cameraTarget]);

  // Open Packing Modal for an order
  function openPackingModal(order: ShipmentOrder) {
    setSelectedOrder(order);
    setScannedBarcodes(order.verifiedBarcodes || []);
    setNotes(order.notes || "");
    setCourier(order.courier || "DHL Express");
    setTrackingNumber(order.trackingNumber || "");
    setPhotoUrl(order.photoUrl || null);
    setSavingStatus("");
    setBarcodeInput("");
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  }

  // Handle Manual Sync with Shopify
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/shipping/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  // Handle Barcode Scan / Enter
  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim() || !selectedOrder) return;

    const scanned = barcodeInput.trim().toLowerCase();
    
    // Check if barcode matches any line item's barcode, SKU, or ID
    const match = selectedOrder.lineItems.find(
      (item) =>
        item.barcode.toLowerCase() === scanned ||
        item.sku.toLowerCase() === scanned ||
        item.id.toLowerCase() === scanned ||
        item.title.toLowerCase().includes(scanned)
    );

    if (match) {
      const matchedKey = match.barcode || match.sku || match.id;
      setScannedBarcodes((prev) => [...prev, matchedKey]);
      setSavingStatus(`✓ Scansionato: ${match.title}`);
    } else {
      // Force add barcode anyway
      setScannedBarcodes((prev) => [...prev, scanned]);
      setSavingStatus(`✓ Codice registrato: ${scanned}`);
    }

    setBarcodeInput("");
  }

  // Upload Package Photo to Google Drive
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setSavingStatus("Caricamento foto pacco su Google Drive in corso...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/notifications/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setUploadingPhoto(false);

      if (res.ok && data.url) {
        setPhotoUrl(data.url);
        setSavingStatus("✓ Foto pacco caricata con successo!");
      } else {
        setSavingStatus(data.error || "Errore caricamento foto.");
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      setUploadingPhoto(false);
      setSavingStatus("Errore durante il caricamento.");
    }
  }

  // Save Shipment Updates
  async function saveShipment(newStatus?: "UNFULFILLED" | "PACKING" | "READY" | "SHIPPED") {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    const targetStatus = newStatus || selectedOrder.status;

    try {
      const res = await fetch("/api/shipping/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyOrderId: selectedOrder.shopifyOrderId,
          orderName: selectedOrder.orderName,
          customerName: selectedOrder.customerName,
          shippingAddress: selectedOrder.shippingAddress,
          status: targetStatus,
          verifiedBarcodes: scannedBarcodes,
          photoUrl,
          notes,
          trackingNumber,
          courier,
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.shopifyOrderId === selectedOrder.shopifyOrderId
              ? {
                  ...o,
                  status: targetStatus,
                  verifiedBarcodes: scannedBarcodes,
                  photoUrl,
                  notes,
                  trackingNumber,
                  courier,
                }
              : o
          )
        );
        setSelectedOrder(null);
        router.refresh();
      } else {
        setSavingStatus(data.error || "Errore durante il salvataggio.");
      }
    } catch (err) {
      console.error("Save shipment error:", err);
      setIsSubmitting(false);
    }
  }

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    return orders.filter((o) => {
      // 1. Text Query Filter
      if (q) {
        const matchesQuery =
          o.orderName.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.shippingAddress.city?.toLowerCase().includes(q) ||
          o.lineItems.some((i) => i.title.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));

        if (!matchesQuery) return false;
      }

      // 2. For SHIPPED orders, filter strictly by selected month & year (auto-resets each month!)
      if (o.status === "SHIPPED") {
        const d = new Date(o.createdAt);
        const itemMonth = d.getMonth() + 1;
        const itemYear = d.getFullYear();

        if (itemMonth !== selectedMonth || itemYear !== selectedYear) {
          return false;
        }
      }

      return true;
    });
  }, [orders, query, selectedMonth, selectedYear]);

  // Metrics
  const stats = useMemo(() => {
    const shippedThisMonth = orders.filter((o) => {
      if (o.status !== "SHIPPED") return false;
      const d = new Date(o.createdAt);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    }).length;

    return {
      unfulfilled: orders.filter((o) => o.status === "UNFULFILLED").length,
      packing: orders.filter((o) => o.status === "PACKING").length,
      ready: orders.filter((o) => o.status === "READY").length,
      shipped: shippedThisMonth,
    };
  }, [orders, selectedMonth, selectedYear]);

  const selectedMonthLabel = monthsList.find((m) => m.value === selectedMonth)?.label || "Mese";

  return (
    <div className="w-full max-w-none space-y-6 text-left">
      {/* Top Header & View Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xs mb-1">
            Shopify Operations
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#1F1F1F]">Spedizioni & Imballaggi</h1>
          <p className="mt-1 text-xs font-semibold text-black/55">
            Gestisci gli ordini Shopify da spedire, scansiona i codici a barre e registra l'imballaggio.
          </p>
        </div>

        <div className="flex flex-wrap flex-col gap-3 sm:flex-row sm:items-center">
          {/* Month & Year Selectors */}
          <div className="flex items-center gap-2 bg-white border border-black/10 rounded-2xl p-1.5 shadow-2xs">
            <span className="text-[11px] font-black text-black/40 uppercase pl-2">Mese:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-black uppercase text-black/80 outline-none cursor-pointer py-1"
            >
              {monthsList.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-black/80 outline-none cursor-pointer py-1 pr-1"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-xs font-black text-black/80 shadow-2xs hover:bg-neutral-50 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4 text-[#D96B94]", syncing && "animate-spin")} />
            <span>{syncing ? "Sincronizzazione..." : "Sincronizza Shopify"}</span>
          </button>

          {/* View Switcher */}
          <div className="inline-flex items-center rounded-2xl border border-black/10 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("KANBAN")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95",
                viewMode === "KANBAN"
                  ? "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                  : "text-black/60 hover:text-black hover:bg-neutral-50"
              )}
            >
              <LayoutGrid className="size-4" />
              <span>Vista Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95",
                viewMode === "TABLE"
                  ? "bg-gradient-to-r from-[#D96B94] to-[#B83D7F] text-white shadow-xs"
                  : "text-black/60 hover:text-black hover:bg-neutral-50"
              )}
            >
              <List className="size-4" />
              <span>Vista Elenco</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: "Da Preparare (Inevasi)", value: stats.unfulfilled, icon: PackageSearch, bg: "bg-amber-100 text-amber-700" },
          { label: "In Imballaggio", value: stats.packing, icon: Box, bg: "bg-blue-100 text-blue-700" },
          { label: "Pronto Spedizione", value: stats.ready, icon: PackageCheck, bg: "bg-emerald-100 text-emerald-700" },
          { label: `Spediti (${selectedMonthLabel} ${selectedYear})`, value: stats.shipped, icon: Truck, bg: "bg-neutral-100 text-neutral-800" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="flex items-center gap-3.5 p-4 sm:p-5 border border-black/5 shadow-2xs">
              <div className={cn("grid size-11 place-items-center rounded-2xl shrink-0", metric.bg)}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black tracking-tight text-[#1F1F1F]">{metric.value}</p>
                <p className="text-xs font-bold text-black/50 truncate">{metric.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Search Bar */}
      <Card className="p-4 border border-black/5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
        <div className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca ordine #, cliente, citta o prodotto..."
            className="h-10 w-full rounded-2xl border border-black/10 bg-neutral-50/80 pl-10 pr-4 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition"
          />
        </div>
        <div className="text-xs font-bold text-black/50">
          Mostrati {filteredOrders.length} di {orders.length} ordini
        </div>
      </Card>

      {/* MAIN VIEW */}
      {viewMode === "KANBAN" ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {statusColumns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.id);

            return (
              <div key={col.id} className="space-y-4 rounded-3xl border border-black/5 bg-neutral-100/60 p-4 shadow-2xs">
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-black/5 pb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", col.bg)}>
                      {col.badge}
                    </span>
                    <h3 className="text-sm font-black text-[#1F1F1F]">{col.title}</h3>
                  </div>
                  <span className="text-xs font-black text-black/40">{colOrders.length}</span>
                </div>

                {/* Column Order Cards */}
                <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                  {colOrders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-xs font-bold text-black/30">
                      Nessun ordine
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <Card
                        key={order.shopifyOrderId}
                        className="p-5 border border-black/5 shadow-2xs hover:shadow-md transition-all duration-200 bg-white rounded-2xl space-y-3 cursor-pointer group"
                        onClick={() => openPackingModal(order)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#B83D7F] bg-pink-50 border border-pink-200 px-2.5 py-1 rounded-xl">
                            {order.orderName}
                          </span>
                          <span className="text-[10px] font-bold text-black/40">
                            {dateLabel(order.createdAt)}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-[#1F1F1F] group-hover:text-[#B83D7F] transition">
                            {order.customerName}
                          </h4>
                          <p className="text-xs font-medium text-black/60 flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3 text-black/40 shrink-0" />
                            <span className="truncate">{order.shippingAddress.city || "Italia"}</span>
                          </p>
                        </div>

                        {/* Line Items Summary */}
                        <div className="rounded-xl border border-black/5 bg-neutral-50 p-2.5 text-xs font-semibold text-black/70 space-y-1">
                          {order.lineItems.slice(0, 2).map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-[11px]">
                              <span className="truncate max-w-[170px]">{item.title}</span>
                              <span className="font-bold text-black/90">x{item.quantity}</span>
                            </div>
                          ))}
                          {order.lineItems.length > 2 && (
                            <p className="text-[10px] font-bold text-[#B83D7F] pt-0.5">
                              +{order.lineItems.length - 2} altri articoli...
                            </p>
                          )}
                        </div>

                        {/* Badges & Touch Action Button for Tablet */}
                        <div className="flex items-center justify-between pt-2 border-t border-black/5">
                          <span className="text-xs font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl font-mono">
                            €{order.totalPrice.toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPackingModal(order);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-2 rounded-xl shadow-2xs hover:opacity-95 transition active:scale-95"
                          >
                            <span>Prepara</span>
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <Card className="p-0 border border-black/5 shadow-2xs overflow-hidden bg-white rounded-3xl">
          <div className="divide-y divide-black/5">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold text-black/40">Nessun ordine trovato.</div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.shopifyOrderId}
                  onClick={() => openPackingModal(order)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid size-12 place-items-center rounded-2xl bg-pink-100 text-[#B83D7F] font-black text-xs shrink-0">
                      {order.orderName}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-[#1F1F1F]">{order.customerName}</h4>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {order.financialStatus}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-black/50 mt-0.5">
                        {order.lineItems.length} articoli <span className="mx-1">•</span> {order.shippingAddress.city} <span className="mx-1">•</span> {dateLabel(order.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-black/70">€{order.totalPrice.toFixed(2)}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-4 py-2 text-xs font-black text-white shadow-xs hover:opacity-95 transition"
                    >
                      <span>Prepara Pacco</span>
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* PACKING & FULFILLMENT MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-3xl border border-black/10 shadow-2xl p-6 sm:p-8 rounded-[32px] bg-white max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-black/5 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xs">
                  Imballaggio & Controllo Pacco
                </span>
                <h2 className="mt-2 text-2xl font-black text-[#1F1F1F]">
                  Ordine {selectedOrder.orderName} — {selectedOrder.customerName}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-black/50">
                  {selectedOrder.shippingAddress.address1}, {selectedOrder.shippingAddress.city} ({selectedOrder.shippingAddress.zip})
                </p>
              </div>
              <button
                className="grid size-10 place-items-center rounded-full border border-black/10 bg-neutral-50 hover:bg-neutral-100 transition"
                onClick={() => setSelectedOrder(null)}
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Camera Viewfinder Overlay when scanning */}
            {isCameraActive && (
              <div className="rounded-3xl border-2 border-[#D96B94] bg-black p-4 space-y-3 relative overflow-hidden text-center text-white shadow-xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                    <Barcode className="size-4 animate-pulse" />
                    Fotocamera Attiva — Inquadra {cameraTarget === "TRACKING" ? "Etichetta / Tracking Code" : "Codice a Barre Prodotto"}
                  </span>
                  <button
                    type="button"
                    onClick={stopCameraScanner}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition"
                  >
                    Chiudi
                  </button>
                </div>

                <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-neutral-900 border border-white/20 flex items-center justify-center">
                  <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_red] animate-pulse" />
                  <div className="absolute inset-8 border-2 border-dashed border-white/50 rounded-xl pointer-events-none" />
                </div>

                <p className="text-[11px] font-bold text-white/70">
                  Avvicina la fotocamera del tablet al codice per la scansione automatica
                </p>
              </div>
            )}

            {/* Barcode Scanner Input Box */}
            <div className="rounded-2xl border border-[#F6C6DE] bg-gradient-to-br from-[#FFF7FB] to-[#FFF0F6] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#B83D7F] flex items-center gap-1.5">
                  <Barcode className="size-4" /> Scansione Codice a Barre / SKU Articolo
                </span>
                <button
                  type="button"
                  onClick={() => startCameraScanner("BARCODE")}
                  className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider bg-[#B83D7F] text-white px-3 py-1 rounded-xl shadow-2xs hover:opacity-90 transition active:scale-95"
                >
                  <Barcode className="size-3.5" />
                  <span>📷 Fotocamera</span>
                </button>
              </div>

              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scansiona o digita SKU / Barcode..."
                  className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-xs font-mono font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-5 text-xs font-black text-white hover:bg-neutral-800 transition"
                >
                  <Check className="size-4" />
                  <span>Verifica</span>
                </button>
              </form>
            </div>

            {/* Line Items Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-black/50">
                Articoli da inserire nella scatola ({selectedOrder.lineItems.length})
              </h3>
              <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-neutral-50/60 overflow-hidden">
                {selectedOrder.lineItems.map((item) => {
                  const isVerified = scannedBarcodes.some(
                    (code) =>
                      code.toLowerCase() === item.barcode?.toLowerCase() ||
                      code.toLowerCase() === item.sku?.toLowerCase() ||
                      code.toLowerCase() === item.id?.toLowerCase()
                  );

                  return (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4 bg-white">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-[#1F1F1F]">{item.title}</p>
                        <p className="text-xs font-mono text-black/40">
                          SKU / Barcode: {item.barcode || item.sku || "N/A"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-black/70">Qtà: {item.quantity}</span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-700">
                            <CheckCircle2 className="size-4" /> Scansionato
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-black text-amber-700">
                            <Clock className="size-3.5" /> Da verificare
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Package Photo Upload */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-black/50">Foto del Pacco Pronto (Google Drive)</span>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-black/10 bg-neutral-50 px-5 py-3 text-xs font-bold text-black/80 hover:bg-neutral-100 transition active:scale-95 w-full sm:w-auto">
                  <UploadCloud className="size-4 text-[#D96B94]" />
                  <span>{uploadingPhoto ? "Caricamento foto..." : "Scatta / Carica Foto Pacco"}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                </label>

                {photoUrl ? (
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B83D7F] underline"
                  >
                    <ImageIcon className="size-4" /> Vedi Foto Pacco caricata ↗
                  </a>
                ) : null}
              </div>
            </div>

            {/* Notes & Tracking Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-black/50">Corriere di Spedizione</span>
                <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
                  <option value="DHL Express">DHL Express</option>
                  <option value="GLS Italy">GLS Italy</option>
                  <option value="BRT Bartolini">BRT Bartolini</option>
                  <option value="Poste Italiane">Poste Italiane / Crono</option>
                  <option value="UPS">UPS</option>
                </Select>
              </label>

              <label className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-black/50">Codice Tracciamento (Tracking Code)</span>
                  <button
                    type="button"
                    onClick={() => startCameraScanner("TRACKING")}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#B83D7F] bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2 py-0.5 rounded-lg transition active:scale-95"
                  >
                    <Barcode className="size-3" />
                    <span>📷 Scansiona Etichetta</span>
                  </button>
                </div>
                <Field
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Es: 1Z99999999999999 (o scansiona con fotocamera)"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-black/50">Note Operative Imballaggio</span>
              <textarea
                className="min-h-20 w-full rounded-2xl border border-black/10 bg-white p-3 text-xs font-bold outline-none focus:border-[#D96B94] focus:ring-2 focus:ring-[#D96B94]/20 transition"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es: Inserito omaggio pettine, imballo speciale con pluriball..."
              />
            </label>

            {savingStatus ? (
              <p className="rounded-2xl bg-[#FFF0F6] border border-[#F9D5E7] p-3 text-xs font-black text-[#B83D7F]">
                {savingStatus}
              </p>
            ) : null}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-black/5">
              <button
                type="button"
                onClick={() => saveShipment("PACKING")}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-neutral-100 px-5 py-3 text-xs font-black text-black/80 hover:bg-neutral-200 transition active:scale-95 w-full sm:w-auto"
              >
                <span>In Imballaggio</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => saveShipment("READY")}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition active:scale-95 w-full sm:w-auto"
                >
                  <PackageCheck className="size-4" />
                  <span>Segna PRONTO PER SPEDIZIONE</span>
                </button>

                <button
                  type="button"
                  onClick={() => saveShipment("SHIPPED")}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D96B94] to-[#B83D7F] px-6 py-3 text-xs font-black text-white shadow-md hover:opacity-95 transition active:scale-95 w-full sm:w-auto"
                >
                  <Truck className="size-4" />
                  <span>EVADI & SPEDISCI (Shopify)</span>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
