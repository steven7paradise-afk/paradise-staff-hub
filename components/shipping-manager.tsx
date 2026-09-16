"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { resolveShippingScan, verifiedQuantity } from "@/lib/shipping-scan";
import { ShippingCameraScanner } from "@/components/shipping-camera-scanner";

type LineItem = {
  id: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  sku: string;
  barcode: string;
  variantId?: string;
  imageUrl?: string | null;
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
  shippedAt: string | null;
  totalPrice: number;
  financialStatus: string;
  fulfillmentStatus: string;
  shippingMethod: string;
  shippingAddress: ShippingAddress;
  lineItems: LineItem[];
  status: "UNFULFILLED" | "PACKING" | "READY" | "SHIPPED";
  verifiedBarcodes: string[];
  photoUrl: string | null;
  proofPhotoUrl: string | null;
  notes: string | null;
  trackingNumber: string | null;
  courier: string | null;
  packedBy?: { id: string; name: string; photo_url?: string | null } | null;
};

const statusColumns = [
  { id: "UNFULFILLED", title: "Da preparare", badge: "Inevasi", bg: "bg-[#F4F2F3] border-black/10 text-[#333]" },
  { id: "PACKING", title: "In preparazione", badge: "In corso", bg: "bg-[#F4F2F3] border-black/10 text-[#333]" },
  { id: "READY", title: "Pronti per la spedizione", badge: "Pronti", bg: "bg-[#F4F2F3] border-black/10 text-[#333]" },
  { id: "SHIPPED", title: "Spediti", badge: "Evasi", bg: "bg-[#F4F2F3] border-black/10 text-[#333]" },
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

function photoPreviewUrl(url: string) {
  const driveId = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];
  return driveId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w600` : url;
}

export function ShippingManager({
  initialOrders,
  initialOrderId,
  currentUserName,
}: {
  initialOrders: ShipmentOrder[];
  initialOrderId?: string | null;
  currentUserName: string;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<ShipmentOrder[]>(initialOrders);
  const [viewMode, setViewMode] = useState<"KANBAN" | "TABLE">("KANBAN");
  const [activeStage, setActiveStage] = useState<ShipmentOrder["status"] | "OPEN">("OPEN");
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShipmentOrder | null>(
    initialOrderId ? initialOrders.find((order) => order.shopifyOrderId === initialOrderId) || null : null,
  );

  // Packing Modal State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
  const scannedBarcodesRef = useRef<string[]>([]);
  const [scanFeedback, setScanFeedback] = useState<{ kind: "success" | "warning" | "info"; code: string; text: string } | null>(null);
  const [scannedProduct, setScannedProduct] = useState<{ code: string; name: string; imageUrl: string | null; correct: boolean } | null>(null);
  const [notes, setNotes] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);
  const [uploadingProofPhoto, setUploadingProofPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera Barcode Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"TRACKING" | "BARCODE">("TRACKING");

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const verifyBarcode = useCallback((rawCode: string) => {
    if (!selectedOrder) return;
    const result = resolveShippingScan(selectedOrder.lineItems, scannedBarcodesRef.current, rawCode);
    if (result.outcome === "EMPTY") return;

    if (result.outcome === "MATCH") {
      const next = [...scannedBarcodesRef.current, result.key];
      scannedBarcodesRef.current = next;
      setScannedBarcodes(next);
      setScanFeedback({
        kind: "success",
        code: result.code,
        text: `${result.item.title} · ${result.nextQuantity}/${result.item.quantity} pezzi verificati`,
      });
      setScannedProduct({ code: result.code, name: result.item.title, imageUrl: result.item.imageUrl || null, correct: true });
      playBeepSound();
    } else if (result.outcome === "COMPLETE") {
      setScanFeedback({ kind: "info", code: result.code, text: `${result.item.title}: tutti i pezzi sono già verificati.` });
      setScannedProduct({ code: result.code, name: result.item.title, imageUrl: result.item.imageUrl || null, correct: true });
    } else {
      setScanFeedback({ kind: "warning", code: result.code, text: "Codice sbagliato: questo prodotto non è presente nell’ordine. Non è stato verificato." });
      setScannedProduct({ code: result.code, name: "Prodotto non presente nell’ordine", imageUrl: null, correct: false });
      void fetch(`/api/shipping/barcode-lookup?code=${encodeURIComponent(result.code)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.product?.name) {
            setScannedProduct((current) => current?.code === result.code ? {
              code: result.code,
              name: data.product.name,
              imageUrl: data.product.image_url || null,
              correct: false,
            } : current);
            setScanFeedback((current) => current?.code === result.code ? {
              kind: "warning",
              code: result.code,
              text: `Prodotto letto: ${data.product.name}. Non è nell’ordine aperto: controlla l’etichetta.`,
            } : current);
          }
        })
        .catch(() => {});
    }
    setBarcodeInput("");
    barcodeInputRef.current?.focus();
  }, [selectedOrder]);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (!initialOrderId) return;
    const order = initialOrders.find((entry) => entry.shopifyOrderId === initialOrderId);
    if (!order) return;
    setSelectedOrder(order);
    setScannedBarcodes(order.verifiedBarcodes || []);
    scannedBarcodesRef.current = order.verifiedBarcodes || [];
    setNotes(order.notes || "");
    setCourier(order.courier || "");
    setTrackingNumber(order.trackingNumber || "");
    setPhotoUrl(order.photoUrl || null);
    setProofPhotoUrl(order.proofPhotoUrl || null);
  }, [initialOrderId]);

  useEffect(() => {
    function restoreOrderFromUrl() {
      const id = new URLSearchParams(window.location.search).get("ordine");
      const order = id ? orders.find((entry) => entry.shopifyOrderId === id) : null;
      setSelectedOrder(order || null);
      if (order) {
        setScannedBarcodes(order.verifiedBarcodes || []);
        scannedBarcodesRef.current = order.verifiedBarcodes || [];
      }
    }
    window.addEventListener("popstate", restoreOrderFromUrl);
    return () => window.removeEventListener("popstate", restoreOrderFromUrl);
  }, [orders]);

  useEffect(() => {
    if (!selectedOrder) return;
    barcodeInputRef.current?.focus();

    function captureScannerKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target === barcodeInputRef.current) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
      if (event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
        event.preventDefault();
        setBarcodeInput((current) => current + event.key);
        barcodeInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", captureScannerKeys);
    return () => window.removeEventListener("keydown", captureScannerKeys);
  }, [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder || barcodeInput.trim().length < 8) return;
    const timeout = window.setTimeout(() => verifyBarcode(barcodeInput), 500);
    return () => window.clearTimeout(timeout);
  }, [barcodeInput, selectedOrder, verifyBarcode]);

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

  function startCameraScanner(target: "TRACKING" | "BARCODE") {
    setCameraTarget(target);
    setIsCameraActive(true);
    setSavingStatus("Inquadra il codice stampato sull’etichetta.");
  }

  function stopCameraScanner() {
    setIsCameraActive(false);
  }

  function handleScannedCodeFromCamera(code: string) {
    if (!code) return;
    const cleanCode = code.trim();
    stopCameraScanner();

    if (cameraTarget === "TRACKING") {
      setTrackingNumber(cleanCode);
      setSavingStatus(`Codice etichetta letto: ${cleanCode}. La scansione non verifica la spedizione presso il corriere.`);
    } else {
      verifyBarcode(cleanCode);
    }
  }


  // Open Packing Modal for an order
  function openPackingModal(order: ShipmentOrder) {
    window.history.pushState(null, "", `/shipping?ordine=${encodeURIComponent(order.shopifyOrderId)}`);
    setSelectedOrder(order);
    setScannedBarcodes(order.verifiedBarcodes || []);
    scannedBarcodesRef.current = order.verifiedBarcodes || [];
    setScanFeedback(null);
    setScannedProduct(null);
    setNotes(order.notes || "");
    setCourier(order.courier || "");
    setTrackingNumber(order.trackingNumber || "");
    setPhotoUrl(order.photoUrl || null);
    setProofPhotoUrl(order.proofPhotoUrl || null);
    setSavingStatus("");
    setBarcodeInput("");
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
    verifyBarcode(barcodeInput);
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

  async function handleProofPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProofPhoto(true);
    setSavingStatus("Caricamento del comprovante in corso...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/notifications/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Caricamento non riuscito.");
      setProofPhotoUrl(data.url);
      let labelTracking = "";
      if ("BarcodeDetector" in window && "createImageBitmap" in window) {
        try {
          const bitmap = await createImageBitmap(file);
          const detected = await new (window as any).BarcodeDetector().detect(bitmap);
          bitmap.close();
          labelTracking = detected
            .map((entry: { rawValue?: string }) => (entry.rawValue || "").trim())
            .find((value: string) => /^[A-Z0-9-]{8,40}$/i.test(value) && !value.toUpperCase().startsWith("PRD")) || "";
        } catch {
          // Some browsers and image formats do not support image barcode reading.
        }
      }
      if (labelTracking) {
        setTrackingNumber(labelTracking);
        setSavingStatus(`Comprovante caricato e tracking letto: ${labelTracking}. Premi Salva bozza.`);
      } else {
        setSavingStatus("Comprovante caricato. Scansiona o scrivi il tracking e premi Salva bozza.");
      }
    } catch (error) {
      setSavingStatus(error instanceof Error ? error.message : "Errore durante il caricamento del comprovante.");
    } finally {
      setUploadingProofPhoto(false);
      e.target.value = "";
    }
  }

  // Save Shipment Updates
  async function saveShipment(newStatus?: "UNFULFILLED" | "PACKING" | "READY" | "SHIPPED") {
    if (!selectedOrder) return;
    const targetStatus = newStatus || selectedOrder.status;
    if (newStatus && (targetStatus === "READY" || targetStatus === "SHIPPED") &&
      (!selectedOrder.lineItems.length || selectedOrder.lineItems.some((item) => verifiedQuantity(item, scannedBarcodes) < item.quantity))) {
      setSavingStatus("Prima di completare, scansiona tutti i pezzi previsti nell’ordine. Puoi comunque salvare una bozza.");
      return;
    }
    if (newStatus === "SHIPPED" && (!courier.trim() || !trackingNumber.trim())) {
      setSavingStatus("Per segnare il pacco come spedito, seleziona il corriere e inserisci il tracking presente sull’etichetta del corriere. Il numero ordine Shopify non basta.");
      trackingInputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);

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
          proofPhotoUrl,
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
                  proofPhotoUrl,
                  notes,
                  trackingNumber,
                  courier,
                  shippedAt: targetStatus === "SHIPPED" ? (o.shippedAt || new Date().toISOString()) : null,
                }
              : o
          )
        );
        setSelectedOrder(null);
        window.history.replaceState(null, "", "/shipping");
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
        const d = new Date(o.shippedAt || o.createdAt);
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
      const d = new Date(o.shippedAt || o.createdAt);
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
  const visibleOrders = activeStage === "OPEN"
    ? filteredOrders.filter((order) => order.status !== "SHIPPED")
    : filteredOrders.filter((order) => order.status === activeStage);
  const mobileStage = activeStage === "OPEN" ? "UNFULFILLED" : activeStage;
  const mobileBoardOrders = query.trim()
    ? visibleOrders
    : visibleOrders.filter((order) => order.status === mobileStage);
  const stageLabels: Record<ShipmentOrder["status"], string> = {
    UNFULFILLED: "Da preparare",
    PACKING: "In preparazione",
    READY: "Pronti per la spedizione",
    SHIPPED: "Spediti",
  };

  return (
    <div className="w-full max-w-none space-y-5 text-left">
      {!selectedOrder && (
        <div className="space-y-5">
      {/* Top Header & View Controls */}
      <div className="relative flex flex-col gap-3 px-1 py-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#A93469]">Ordini Shopify</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-[#181719] sm:text-4xl">Spedizioni</h1>
            </div>
          </div>
          <p className="mt-2 hidden text-sm text-slate-500 sm:block">Controlla gli articoli, prepara i pacchi e registra la spedizione.</p>
        </div>

        <div className="flex flex-wrap gap-3 sm:items-center">
          {/* Month & Year Selectors */}
          {activeStage === "SHIPPED" && <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5">
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
          </div>}

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            aria-label={syncing ? "Aggiornamento ordini in corso" : "Aggiorna ordini"}
            className="absolute right-1 top-1 inline-flex size-11 items-center justify-center gap-2 rounded-xl bg-[#181719] text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83D7F] disabled:opacity-50 sm:static sm:w-auto sm:px-4 sm:py-2.5"
          >
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            <span className="hidden sm:inline">{syncing ? "Aggiornamento..." : "Aggiorna ordini"}</span>
          </button>

          {/* View Switcher */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("KANBAN")}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold transition",
                viewMode === "KANBAN"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <LayoutGrid className="size-4" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold transition",
                viewMode === "TABLE"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <List className="size-4" />
              <span>Elenco</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        {[
          { id: "UNFULFILLED" as const, label: "Da preparare", value: stats.unfulfilled, icon: PackageSearch },
          { id: "PACKING" as const, label: "In preparazione", value: stats.packing, icon: Box },
          { id: "READY" as const, label: "Pronti", value: stats.ready, icon: PackageCheck },
          { id: "SHIPPED" as const, label: `Spediti · ${selectedMonthLabel}`, value: stats.shipped, icon: Truck },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => setActiveStage(activeStage === metric.id ? "OPEN" : metric.id)}
              aria-pressed={activeStage === metric.id}
              className={cn(
                "min-h-24 rounded-2xl border border-black/[0.07] bg-white p-4 text-left text-[#181719] transition hover:border-black/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83D7F]",
                activeStage === metric.id ? "ring-2 ring-[#181719] ring-offset-2" : "",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#F5F2F3] text-black/70">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{metric.label}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-slate-500">{metric.id === "SHIPPED" ? `${selectedYear}` : "Ordini"}</span>
                <span className="text-3xl font-semibold tabular-nums">{metric.value}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <Card className="flex flex-col gap-4 rounded-2xl border border-black/[0.07] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        {viewMode === "TABLE" && <select value={activeStage} onChange={(event) => setActiveStage(event.target.value as typeof activeStage)} aria-label="Filtra spedizioni per stato" className="h-11 w-full rounded-xl border border-slate-200 bg-[#F5F3F4] px-3 text-sm font-semibold text-[#181719] outline-none focus:border-[#B83D7F] sm:hidden">
          <option value="OPEN">Da lavorare · {stats.unfulfilled + stats.packing + stats.ready}</option>
          <option value="UNFULFILLED">Da preparare · {stats.unfulfilled}</option>
          <option value="PACKING">In preparazione · {stats.packing}</option>
          <option value="READY">Pronti · {stats.ready}</option>
          <option value="SHIPPED">Spediti · {stats.shipped}</option>
        </select>}
        <div className="hidden max-w-full gap-1 overflow-x-auto pb-1 sm:flex" role="group" aria-label="Filtra spedizioni per stato">
          {[
            { id: "OPEN" as const, label: "Da lavorare", count: stats.unfulfilled + stats.packing + stats.ready },
            { id: "UNFULFILLED" as const, label: "Da preparare", count: stats.unfulfilled },
            { id: "PACKING" as const, label: "In preparazione", count: stats.packing },
            { id: "READY" as const, label: "Pronti", count: stats.ready },
            { id: "SHIPPED" as const, label: "Spediti", count: stats.shipped },
          ].map((tab) => <button key={tab.id} type="button" onClick={() => setActiveStage(tab.id)} aria-pressed={activeStage === tab.id} className={cn("min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition", activeStage === tab.id ? "bg-[#181719] text-white" : "text-slate-600 hover:bg-slate-100")}>{tab.label} <span className="ml-1 opacity-60 tabular-nums">{tab.count}</span></button>)}
        </div>
        <div className="relative w-full lg:w-[330px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca ordine, cliente o prodotto"
            aria-label="Cerca ordine, cliente o prodotto"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-[#B83D7F] focus:ring-2 focus:ring-[#B83D7F]/20"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Cancella ricerca" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-900">
              <X className="size-4" />
            </button>
          )}
        </div>
      </Card>

      <div className="hidden items-center justify-between gap-3 px-1 text-sm text-slate-500 sm:flex">
        <span>{visibleOrders.length} {visibleOrders.length === 1 ? "ordine" : "ordini"}{activeStage === "OPEN" ? ` da lavorare · ${filteredOrders.filter((order) => order.status === "SHIPPED").length} spediti` : ""}</span>
        {activeStage !== "OPEN" && (
          <button type="button" onClick={() => setActiveStage("OPEN")} className="font-semibold text-[#B83D7F] hover:underline">Torna agli ordini da lavorare</button>
        )}
      </div>

      {/* MAIN VIEW */}
      {viewMode === "KANBAN" ? (
        <>
        <div className="space-y-3 lg:hidden" aria-label="Postazione spedizioni mobile">
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-black/[0.09] bg-white p-1">
            {[
              { id: "UNFULFILLED" as const, label: "Da fare", count: stats.unfulfilled },
              { id: "PACKING" as const, label: "In corso", count: stats.packing },
              { id: "READY" as const, label: "Pronti", count: stats.ready },
              { id: "SHIPPED" as const, label: "Spediti", count: stats.shipped },
            ].map((stage) => <button key={stage.id} type="button" onClick={() => setActiveStage(stage.id)} aria-pressed={mobileStage === stage.id && !query.trim()} className={cn("flex min-h-14 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-semibold leading-tight transition", mobileStage === stage.id && !query.trim() ? "bg-[#181719] text-white" : "text-slate-600 hover:bg-[#F5F3F4]")}>{stage.label}<span className="mt-1 text-sm font-bold tabular-nums">{stage.count}</span></button>)}
          </div>
          <section className="overflow-hidden rounded-xl border border-black/[0.09] bg-white">
            <div className="flex items-center justify-between border-b border-black/[0.09] bg-[#FAF9F9] px-4 py-3">
              <h3 className="text-sm font-bold text-[#181719]">{query.trim() ? "Risultati ricerca" : stageLabels[mobileStage]}</h3>
              <span className="text-xs font-semibold tabular-nums text-slate-500">{mobileBoardOrders.length}</span>
            </div>
            <div className="divide-y divide-black/[0.07]">
              {mobileBoardOrders.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">{query.trim() ? "Nessun ordine trovato." : "Nessun ordine in questa fase."}</p> : mobileBoardOrders.map((order) => <div key={order.shopifyOrderId} className="flex items-center gap-3 px-3 py-3">
                {order.lineItems[0]?.imageUrl ? <img src={order.lineItems[0].imageUrl} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" /> : <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-[#F5F3F4] text-slate-400"><Package className="size-5" aria-hidden="true" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#A93469]">{order.orderName}{query.trim() ? ` · ${stageLabels[order.status]}` : ""}</p>
                  <p className="truncate text-sm font-semibold text-[#181719]" title={order.customerName}>{order.customerName}</p>
                  <p className="truncate text-xs text-slate-500" title={order.lineItems[0]?.title}>{order.lineItems[0]?.title || "Articoli da recuperare"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{order.lineItems.reduce((sum, item) => sum + item.quantity, 0)} pezzi · {order.shippingAddress.city || "Destinazione da verificare"}</p>
                </div>
                <button type="button" onClick={() => openPackingModal(order)} aria-label={`Apri ordine ${order.orderName} di ${order.customerName}`} className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 text-[#181719] hover:bg-[#F5F3F4]"><ChevronRight className="size-5" aria-hidden="true" /></button>
              </div>)}
            </div>
          </section>
        </div>
        {/* Active work stays separate from the shipped archive. */}
        <div className="hidden lg:block" aria-label="Board delle spedizioni">
        <div className={cn("grid items-start gap-3 rounded-2xl border border-black/[0.09] bg-[#F2F0F1] p-3", activeStage === "OPEN" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
          {statusColumns.filter((col) => activeStage === "OPEN" ? col.id !== "SHIPPED" : col.id === activeStage).map((col) => {
            const colOrders = visibleOrders.filter((o) => o.status === col.id);
            return (
              <section key={col.id} className="min-h-40 overflow-hidden rounded-xl border border-black/[0.14] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-black/[0.14] bg-[#FAF9F9] px-4 py-4">
                  <h3 className="text-sm font-bold text-[#181719]">{col.title}{col.id === "SHIPPED" && activeStage === "OPEN" ? ` · ${selectedMonthLabel}` : ""}</h3>
                  <span className="rounded-full bg-[#F5F2F3] px-3 py-1 text-xs font-semibold tabular-nums text-[#181719]">{colOrders.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {colOrders.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">Nessun ordine in questa fase.</p>
                  ) : (
                    colOrders.map((order) => (
                      <div key={order.shopifyOrderId} className="space-y-2.5 px-4 py-3.5 transition hover:bg-[#FAF9F9]">
                        <div className="flex min-w-0 items-center gap-3">
                          {order.lineItems[0]?.imageUrl ? <img src={order.lineItems[0].imageUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" /> : <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#F5F2F3] text-slate-400"><Package className="size-5" aria-hidden="true" /></span>}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#181719]">{order.orderName}</p>
                            <p className="truncate text-sm font-semibold text-slate-900" title={order.customerName}>{order.customerName}</p>
                            <p className="truncate text-xs text-slate-500">{order.shippingAddress.city || "Destinazione da verificare"} · {dateLabel(order.createdAt)}</p>
                          </div>
                        </div>
                        <p className="truncate text-xs text-slate-600" title={order.lineItems[0]?.title}>{order.lineItems[0]?.title || "Articoli da recuperare"}</p>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <span className="text-xs tabular-nums text-slate-500">{order.lineItems.reduce((sum, item) => sum + item.quantity, 0)} pezzi</span>
                          <button type="button" onClick={() => openPackingModal(order)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#181719] hover:bg-slate-100">{col.id === "SHIPPED" ? "Apri ordine" : "Prepara"}<ChevronRight className="size-4" aria-hidden="true" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
        </div>
        </>
      ) : (
        /* TABLE LIST VIEW */
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white p-0">
          <div className="hidden border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 xl:grid xl:grid-cols-[minmax(210px,1.5fr)_minmax(200px,1.35fr)_minmax(140px,.9fr)_minmax(120px,.8fr)_minmax(100px,.7fr)_155px] xl:gap-4">
            <span>Ordine e cliente</span><span>Articoli</span><span>Destinazione</span><span>Stato</span><span>Data</span><span className="text-right">Azione</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleOrders.length === 0 ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-12 text-center">
                <span className="grid size-24 place-items-center rounded-full bg-slate-50 text-[#B83D7F]">
                  <PackageCheck className="size-11" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-xl font-semibold text-slate-900">{query ? "Nessun ordine trovato" : activeStage === "SHIPPED" ? "Nessuna spedizione nel mese" : "Nessun ordine da lavorare"}</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {query ? "Prova con un altro numero d’ordine o con il nome della cliente." : activeStage === "SHIPPED" ? "Cambia mese per consultare altre spedizioni." : "Quando arriveranno nuovi ordini, li vedrai qui."}
                </p>
                {query && <button type="button" onClick={() => setQuery("")} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancella ricerca</button>}
              </div>
            ) : (
              visibleOrders.map((order) => (
                <div
                  key={order.shopifyOrderId}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between xl:grid xl:grid-cols-[minmax(210px,1.5fr)_minmax(200px,1.35fr)_minmax(140px,.9fr)_minmax(120px,.8fr)_minmax(100px,.7fr)_155px] xl:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {order.lineItems[0]?.imageUrl ? <img src={order.lineItems[0].imageUrl} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" /> : <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400"><Package className="size-5" aria-hidden="true" /></span>}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#181719]">{order.orderName}</p>
                      <h4 className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={order.customerName}>{order.customerName}</h4>
                      <p className="mt-1 text-xs text-slate-500 xl:hidden">{order.shippingAddress.city || "Destinazione da verificare"} · {dateLabel(order.createdAt)}</p>
                      <p className="mt-1 truncate text-xs text-slate-700 xl:hidden">{order.lineItems[0]?.title || "Articoli da recuperare"}</p>
                    </div>
                  </div>
                  <div className="hidden min-w-0 xl:block">
                    <p className="truncate text-sm text-slate-800" title={order.lineItems[0]?.title}>{order.lineItems[0]?.title || "Articoli da recuperare"}</p>
                    <p className="mt-1 text-xs text-slate-500">{order.lineItems.reduce((sum, item) => sum + item.quantity, 0)} pezzi · {order.lineItems.length} {order.lineItems.length === 1 ? "articolo" : "articoli"}</p>
                  </div>
                  <p className="hidden truncate text-sm text-slate-700 xl:block" title={order.shippingAddress.city}>{order.shippingAddress.city || "Da verificare"}</p>
                  <div className="flex items-center gap-2 xl:block">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusColumns.find((stage) => stage.id === order.status)?.bg)}>{stageLabels[order.status]}</span>
                    {order.trackingNumber && <span className="text-xs text-slate-500 xl:hidden">Tracking {order.trackingNumber}</span>}
                  </div>
                  <p className="hidden text-sm text-slate-600 xl:block">{dateLabel(order.createdAt)}</p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openPackingModal(order)}
                      className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#181719] px-3 py-2 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      <span>{order.status === "SHIPPED" ? "Apri ordine" : "Prepara ordine"}</span>
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

        </div>
      )}

      {/* Full-page order preparation */}
      {selectedOrder && (
        <section className="w-full min-h-screen space-y-4 pb-12">
          <button type="button" onClick={() => { setSelectedOrder(null); window.history.replaceState(null, "", "/shipping"); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            ← Torna a tutti gli ordini
          </button>
          <Card className="w-full space-y-6 rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7 lg:p-8">
            {/* Order header and primary actions */}
            <div className="flex flex-col gap-5 border-b border-black/[0.07] pb-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A93469]">Preparazione pacco</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[#181719] sm:text-2xl">
                  {selectedOrder.orderName} · {selectedOrder.customerName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedOrder.shippingAddress.address1}, {selectedOrder.shippingAddress.city} ({selectedOrder.shippingAddress.zip})
                </p>
              </div>
              <div className="w-full max-w-[720px] space-y-2 xl:w-auto xl:text-right" aria-label="Azioni ordine">
                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
                <button type="button" onClick={() => saveShipment()} disabled={isSubmitting} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 sm:bg-white sm:px-3 sm:text-sm"><span className="sm:hidden">Bozza</span><span className="hidden sm:inline">Salva bozza</span></button>
                <button type="button" onClick={() => saveShipment("PACKING")} disabled={isSubmitting} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 sm:bg-white sm:px-3 sm:text-sm"><span className="sm:hidden">Inizia</span><span className="hidden sm:inline">In preparazione</span></button>
                <button type="button" onClick={() => saveShipment("READY")} disabled={isSubmitting} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#181719] px-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-50 sm:px-3 sm:text-sm">Pronto</button>
                <button type="button" onClick={() => saveShipment("SHIPPED")} disabled={isSubmitting} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#B83D7F] px-1.5 text-[11px] font-semibold text-white hover:bg-[#9D326C] disabled:opacity-50 sm:px-3 sm:text-sm"><span className="sm:hidden">Spedito</span><span className="hidden sm:inline">Segna spedito</span></button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:justify-end sm:gap-2" aria-label="Stampe e foto per il pacco">
                  <a href={`/shipping/stampa/${selectedOrder.shopifyOrderId}?tipo=comanda`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 sm:bg-white sm:px-3 sm:text-sm"><Printer className="hidden size-4 sm:block" aria-hidden="true" /> Comanda</a>
                  <a href={`/shipping/stampa/${selectedOrder.shopifyOrderId}?tipo=grazie`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 sm:bg-white sm:px-3 sm:text-sm"><Printer className="hidden size-4 sm:block" aria-hidden="true" /><span className="sm:hidden">Grazie</span><span className="hidden sm:inline">Ringraziamento</span></a>
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 sm:bg-white sm:px-3 sm:text-sm">
                  <UploadCloud className="hidden size-4 sm:block" aria-hidden="true" /> {uploadingProofPhoto ? "Carico..." : <><span className="sm:hidden">Ricevuta</span><span className="hidden sm:inline">Comprovante</span></>}
                  <input type="file" accept="image/*" className="sr-only" onChange={handleProofPhotoUpload} disabled={uploadingProofPhoto} aria-label="Carica foto del comprovante" />
                </label>
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 bg-[#F5F3F4] px-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 sm:bg-white sm:px-3 sm:text-sm">
                  <UploadCloud className="hidden size-4 sm:block" aria-hidden="true" /> {uploadingPhoto ? "Carico..." : <><span className="sm:hidden">Foto</span><span className="hidden sm:inline">Foto pacco</span></>}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoUpload} disabled={uploadingPhoto} aria-label="Carica foto del pacco pronto" />
                </label>
                </div>
                {photoUrl && <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#B83D7F] underline">Vedi foto pacco ↗</a>}
              </div>
            </div>

            {/* Camera Viewfinder Overlay when scanning */}
            {isCameraActive && (
              <ShippingCameraScanner target={cameraTarget} onRead={handleScannedCodeFromCamera} onClose={stopCameraScanner}/>
            )}

            <div className="flex flex-col gap-5">
            {/* Dedicated keyboard-wedge scanner station */}
            <section className="order-2 space-y-4 rounded-xl border border-black/[0.07] bg-[#FAF9F9] p-4 sm:order-1 sm:p-5" aria-label="Postazione scanner">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Barcode className="size-5 text-[#B83D7F]" aria-hidden="true" />
                    <h3 className="text-base font-semibold">Scanner prodotti</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Punta il lettore sull’etichetta. Il codice viene controllato automaticamente.</p>
                </div>
                <button
                  type="button"
                  onClick={() => startCameraScanner("BARCODE")}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Barcode className="size-4" aria-hidden="true" />
                  <span>Usa fotocamera</span>
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start">
              <div className="space-y-3">
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  aria-label="Codice a barre del prodotto"
                  autoComplete="off"
                  placeholder="In attesa del codice a barre…"
                  className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-semibold tracking-wide text-slate-900 outline-none focus:border-[#B83D7F] focus:ring-2 focus:ring-[#B83D7F]/20 sm:px-4 sm:text-base"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 sm:px-5"
                  aria-label="Controlla codice a barre"
                >
                  <Check className="size-4" />
                  <span className="hidden sm:inline">Controlla</span>
                </button>
              </form>
              <div aria-live="assertive" aria-atomic="true">
                {scanFeedback ? (
                  <div className={cn(
                    "rounded-lg border px-4 py-3",
                    scanFeedback.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" :
                    scanFeedback.kind === "warning" ? "border-red-400 bg-red-50 text-red-900" :
                    "border-blue-300 bg-blue-50 text-blue-900",
                  )}>
                    <p className="text-sm font-bold">{scanFeedback.kind === "warning" ? "Attenzione: prodotto sbagliato" : scanFeedback.kind === "success" ? "Prodotto corretto" : "Già verificato"}</p>
                    <p className="mt-1 text-sm">{scanFeedback.text}</p>
                    <p className="mt-1 font-mono text-xs">Codice letto: {scanFeedback.code}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Scanner pronto · apri l’ordine e scansiona il primo prodotto.</p>
                )}
              </div>
              </div>
              <div className={cn("rounded-lg border bg-white p-4", scannedProduct ? (scannedProduct.correct ? "border-emerald-300" : "border-red-400") : "border-slate-200")}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Prodotto scansionato</p>
                  {scannedProduct ? (
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      {scannedProduct.imageUrl ? (
                        <img src={scannedProduct.imageUrl} alt={scannedProduct.name} className="h-36 w-44 shrink-0 rounded border border-slate-200 bg-white object-contain sm:h-44 sm:w-48" />
                      ) : (
                        <span className="grid h-36 w-44 shrink-0 place-items-center rounded border border-slate-200 bg-slate-50 text-slate-400 sm:h-44 sm:w-48"><Barcode className="size-10" aria-hidden="true" /></span>
                      )}
                      <div className="min-w-0">
                        <p className={cn("text-lg font-semibold leading-snug sm:text-xl", scannedProduct.correct ? "text-emerald-800" : "text-red-800")}>{scannedProduct.name}</p>
                        <p className="mt-2 font-mono text-sm text-slate-500">{scannedProduct.code}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="py-4 text-sm text-slate-500">In attesa della prima scansione.</p>
                  )}
              </div>
              </div>
            </section>

            {/* Line Items Checklist */}
            <div className="order-1 space-y-3 sm:order-2">
              <h3 className="text-base font-semibold text-slate-900">
                Articoli da inserire nel pacco
              </h3>
              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                {selectedOrder.lineItems.map((item) => {
                  const scannedCount = verifiedQuantity(item, scannedBarcodes);
                  const isVerified = scannedCount >= item.quantity;

                  return (
                    <div key={item.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", isVerified ? "bg-emerald-50/60" : "bg-white")}>
                      <div className="flex items-center gap-4">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="size-20 shrink-0 rounded border border-slate-200 bg-white object-contain" />
                        ) : (
                          <span className="grid size-20 shrink-0 place-items-center rounded border border-slate-200 bg-slate-50 text-slate-400"><Package className="size-7" aria-hidden="true" /></span>
                        )}
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                          <p className="font-mono text-xs text-slate-500">
                            {item.barcode ? `Etichetta: ${item.barcode}` : "Etichetta non collegata al catalogo"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-slate-800">{scannedCount}/{item.quantity}</span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="size-4" /> Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            <Clock className="size-3.5" /> Da verificare
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>

            {/* Notes & Tracking Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-black/50">Corriere di Spedizione</span>
                <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
                  <option value="">Seleziona il corriere dell’etichetta</option>
                  <option value="DHL Express">DHL Express</option>
                  <option value="GLS Italy">GLS Italy</option>
                  <option value="BRT Bartolini">BRT Bartolini</option>
                  <option value="Poste Italiane">Poste Italiane / Crono</option>
                  <option value="UPS">UPS</option>
                </Select>
              </label>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Codice di tracciamento</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { trackingInputRef.current?.focus(); trackingInputRef.current?.select(); setSavingStatus("Scanner tracking pronto: leggi l’etichetta del corriere."); }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Barcode className="size-4" aria-hidden="true" /> Scansiona con lettore
                    </button>
                  <button
                    type="button"
                    onClick={() => startCameraScanner("TRACKING")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-3 text-xs font-semibold text-[#B83D7F] hover:bg-pink-100"
                  >
                    <Barcode className="size-4" aria-hidden="true" />
                    <span>Usa fotocamera</span>
                  </button>
                  </div>
                </div>
                <input
                  ref={trackingInputRef}
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const code = trackingNumber.trim();
                    if (code) setSavingStatus(`Codice etichetta letto: ${code}. Premi Salva bozza per conservarlo. La scansione non verifica la spedizione presso il corriere.`);
                  }}
                  autoComplete="off"
                  aria-label="Codice di tracciamento"
                  placeholder="Scansiona l’etichetta o scrivi il tracking"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 font-mono text-sm text-slate-900 outline-none focus:border-[#B83D7F] focus:ring-2 focus:ring-[#B83D7F]/20"
                />
                <p className="text-xs leading-relaxed text-slate-500">Inserisci il tracking stampato sull’etichetta del corriere, non il numero ordine Shopify. Questa pagina registra il codice ma non crea né verifica una spedizione DHL.</p>
              </div>
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

            {proofPhotoUrl && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">Comprovante di spedizione</p>
                <a href={proofPhotoUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src={photoPreviewUrl(proofPhotoUrl)} alt="Foto del comprovante di spedizione" className="max-h-64 max-w-full rounded-lg border border-slate-200 object-contain" />
                </a>
              </div>
            )}

            {savingStatus ? (
              <p className="rounded-2xl bg-[#FFF0F6] border border-[#F9D5E7] p-3 text-xs font-black text-[#B83D7F]">
                {savingStatus}
              </p>
            ) : null}

          </Card>
        </section>
      )}
    </div>
  );
}
