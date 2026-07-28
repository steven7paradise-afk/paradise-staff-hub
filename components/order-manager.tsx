"use client";

import Papa from "papaparse";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, Clock3, Eye, LinkIcon, Loader2, Mail, MapPin, PackageCheck, Phone, Printer, Search, ShoppingCart, Truck, Upload, UserRound, X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ResponseComments } from "@/components/response-comments";

const ORDER_PHOTO_KEY = "__orderPhoto";
const ORDER_LABEL_BASE_URL = "https://www.paradisebeauty.it";
const COMPANY_INFO = {
  name: "PARADISE BEAUTY",
  subtitle: "Paradise Hair & Beauty",
  website: "www.paradisebeauty.it",
  email: "assistenza@paradisebeauty.it",
  phone: "",
  vat: "",
  address: "",
};

type OrderPhoto = {
  url: string;
  previewUrl?: string;
  name?: string;
  originalName?: string;
  driveFileId?: string;
  driveFileUrl?: string;
  uploadedAt?: string;
  uploadedBy?: string;
};

type OrderResponse = {
  id: string;
  status: string;
  priority?: string | null;
  answers: Record<string, any>;
  comments?: any[] | null;
  activity_log?: any[] | null;
  created_at: string;
  updated_at: string;
  user_location_name?: string | null;
  user?: { name?: string | null };
  form?: { name?: string | null; fields?: Array<{ id: string; label: string; type: string }> };
};

const ORDER_COLUMNS = [
  { id: "NEW", label: "Nuovo ordine", icon: ShoppingCart, color: "bg-pink-50 text-[#C66170] border-pink-100" },
  { id: "PREPARING", label: "Preparando ordine", icon: Clock3, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "ORDERED", label: "Ordinato", icon: Truck, color: "bg-violet-50 text-violet-700 border-violet-100" },
  { id: "READY", label: "Arrivato / pronto", icon: PackageCheck, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "COMPLETED", label: "Completato", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
];

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

const currentYear = new Date().getFullYear();
const yearsList = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

function parseCustomDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.toLowerCase().replace(/\s+/g, " ").trim();
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) return new Date(parsed);

  const normalized = clean.replace(/\b(de|di)\b/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10);
    
    let hour = 12;
    let min = 0;
    if (parts[3] && parts[3].includes(":")) {
      const timeParts = parts[3].split(":");
      hour = parseInt(timeParts[0], 10) || 12;
      min = parseInt(timeParts[1], 10) || 0;
    }
    
    const months: Record<string, number> = {
      gen: 0, gennaio: 0, ene: 0, enero: 0, jan: 0, january: 0,
      feb: 1, febbraio: 1, febr: 1, febrero: 1, february: 1,
      mar: 2, marzo: 2, march: 2,
      apr: 3, aprile: 3, abr: 3, abril: 3, april: 3,
      mag: 4, maggio: 4, may: 4, mayo: 4,
      giu: 5, giugno: 5, jun: 5, junio: 5, june: 5,
      lug: 6, luglio: 6, jul: 6, julio: 6, july: 6,
      ago: 7, agosto: 7, aug: 7, august: 7,
      set: 8, settembre: 8, sep: 8, sept: 8, septiembre: 8, september: 8,
      ott: 9, ottobre: 9, oct: 9, october: 9,
      nov: 10, novembre: 10, noviembre: 10, november: 10,
      dic: 11, dicembre: 11, december: 11
    };
    
    let monthIdx = -1;
    for (const [key, idx] of Object.entries(months)) {
      if (monthStr.startsWith(key) || key.startsWith(monthStr)) {
        monthIdx = idx;
        break;
      }
    }
    
    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      return new Date(year, monthIdx, day, hour, min);
    }
  }
  
  return new Date();
}

function mapCsvStatus(statusStr: string): string {
  const s = statusStr.toLowerCase();
  if (s.includes("completat") || s.includes("inviato") || s.includes("inviate")) return "COMPLETED";
  if (s.includes("arrivat") || s.includes("pront")) return "READY";
  if (s.includes("ordinat")) return "ORDERED";
  if (s.includes("prepar")) return "PREPARING";
  return "NEW";
}

function answerById(order: OrderResponse, id: string) {
  const value = order.answers?.[id];
  if (!value) return "";
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

function fieldValue(order: OrderResponse, includes: string[]) {
  const fields = order.form?.fields ?? [];
  const field = fields.find((item) => includes.some((needle) => item.label.toLowerCase().includes(needle)));
  if (!field) return "";
  return answerById(order, field.id);
}

function isSartaOrder(order: OrderResponse) {
  const answers = order.answers || {};
  const fields = order.form?.fields || [];

  const cosaDobbiamoFareField = fields.find((f: any) => 
    f.label?.toLowerCase().includes("cosa dobbiamo fare")
  );
  const quanteFasceField = fields.find((f: any) => 
    f.label?.toLowerCase().includes("quante fasce")
  );

  const cosaValue = cosaDobbiamoFareField ? answers[cosaDobbiamoFareField.id] : null;
  const fasceValue = quanteFasceField ? answers[quanteFasceField.id] : null;

  const directCosaValue = answers["field_1782212873121"];
  const directFasceValue = answers["field_1782219581986"];

  const matchesCosa = 
    (cosaValue && (cosaValue.toLowerCase().includes("conversione") || cosaValue.toLowerCase().includes("conver"))) ||
    (directCosaValue && (directCosaValue.toLowerCase().includes("conversione") || directCosaValue.toLowerCase().includes("conver")));

  const matchesFasce = 
    (fasceValue && fasceValue.toLowerCase().includes("personalizzato")) ||
    (directFasceValue && directFasceValue.toLowerCase().includes("personalizzato"));

  return Boolean(matchesCosa || matchesFasce);
}

function orderTitle(order: OrderResponse) {
  const title = answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]);
  if (title) return title;
  const clientName = fieldValue(order, ["cliente", "nome cliente", "nome del cliente", "nome"]);
  if (clientName) return clientName;
  return "Ordine senza titolo";
}

function orderClientName(order: OrderResponse) {
  const clientName = fieldValue(order, ["cliente", "nome cliente", "nome del cliente", "nome"]);
  if (clientName) return clientName;
  const title = answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]);
  if (title && isNaN(Number(title.replace("#", "").trim()))) {
    return title;
  }
  return "Cliente non indicato";
}

function orderNumber(order: OrderResponse) {
  const title = answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]);
  if (title) return title;
  return `#${order.id.substring(0, 5).toUpperCase()}`;
}

function getOrderTaskType(order: OrderResponse): "conversione" | "acquisto" | "accessori" | "altro" {
  const answers = order.answers || {};
  const fields = order.form?.fields || [];
  
  const allText = Object.values(answers)
    .map(v => typeof v === "object" ? (v?.name ?? "") : String(v))
    .join(" ")
    .toLowerCase();

  const itemsText = (orderItems(order) || "").toLowerCase();
  const titleText = (answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]) || "").toLowerCase();
  
  const haystack = `${allText} ${itemsText} ${titleText}`;

  if (haystack.includes("conversione") || haystack.includes("conver")) {
    return "conversione";
  }
  if (haystack.includes("accessori") || haystack.includes("accessorio")) {
    return "accessori";
  }
  if (haystack.includes("acquisto") || haystack.includes("extension") || haystack.includes("nuove ext")) {
    return "acquisto";
  }
  
  return "altro";
}

function renderTaskBadge(taskType: "conversione" | "acquisto" | "accessori" | "altro") {
  if (taskType === "conversione") {
    return (
      <span className="rounded-full bg-pink-50 border border-pink-200 text-pink-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider dark:bg-pink-950/20 dark:border-pink-900/30 dark:text-pink-400">
        Conversione Capelli
      </span>
    );
  }
  if (taskType === "acquisto") {
    return (
      <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400">
        Acquisto Extension
      </span>
    );
  }
  if (taskType === "accessori") {
    return (
      <span className="rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400">
        Accessori
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
      Altro
    </span>
  );
}

function orderItems(order: OrderResponse) {
  return answerById(order, "order_items") || fieldValue(order, ["cosa", "prodot", "material", "ordinare"]);
}

function orderPriority(order: OrderResponse) {
  return answerById(order, "order_priority") || order.priority || "Normale";
}

function orderDate(order: OrderResponse) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.created_at));
}

function orderPhoto(order: OrderResponse): OrderPhoto | null {
  const photo = order.answers?.[ORDER_PHOTO_KEY];
  if (!photo || typeof photo !== "object" || typeof photo.url !== "string") return null;
  return photo as OrderPhoto;
}

function orderPhotoPreviewUrl(photo: OrderPhoto) {
  return photo.previewUrl || (photo.driveFileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(photo.driveFileId)}&sz=w1200` : photo.url);
}

function displayOrderFieldValue(value: any) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.fileName) return String(value.fileName);
    if (value.url) return String(value.url);
    return JSON.stringify(value);
  }
  return String(value);
}

function orderFieldIcon(label: string) {
  const clean = label.toLowerCase();
  if (clean.includes("email")) return Mail;
  if (clean.includes("telefono") || clean.includes("whatsapp")) return Phone;
  if (clean.includes("data")) return CalendarDays;
  return null;
}

function cleanPdfFileName(value: string) {
  return value
    .trim()
    .replace(/^#/, "")
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function orderPublicUrl(orderId: string) {
  return `${ORDER_LABEL_BASE_URL}/ordine/${encodeURIComponent(orderId)}`;
}

function labelIncludes(label: string, terms: string[]) {
  const clean = label.toLowerCase();
  return terms.some((term) => clean.includes(term));
}

function findOrderField(fields: Array<{ label: string; value: any; id: string }>, terms: string[]) {
  return fields.find((field) => labelIncludes(field.label, terms));
}

function orderLabelFieldValue(fields: Array<{ label: string; value: any; id: string }>, label: string, terms: string[]) {
  const field = findOrderField(fields, terms);
  return {
    label,
    value: field ? displayOrderFieldValue(field.value) : "Non indicato",
  };
}

function orderLabelFieldsByType(order: OrderResponse, fields: Array<{ label: string; value: any; id: string }>) {
  const taskType = getOrderTaskType(order);
  const common = [orderLabelFieldValue(fields, "Cosa dobbiamo fare?", ["cosa dobbiamo fare", "cosa", "fare"])];

  if (taskType === "conversione") {
    return [
      ...common,
      orderLabelFieldValue(fields, "Peso sulla bilancia", ["peso sulla bilancia", "peso"]),
      orderLabelFieldValue(fields, "Extension Paradise a", ["extension paradise"]),
      orderLabelFieldValue(fields, "Quante fasce?", ["quante fasce", "fasce"]),
      orderLabelFieldValue(fields, "Pagamento", ["pagamento"]),
      orderLabelFieldValue(fields, "Quanto manca pagare?", ["manca pagare", "quanto manca"]),
    ];
  }

  return [
    ...common,
    orderLabelFieldValue(fields, "Grammi", ["grammi", "grammo"]),
    orderLabelFieldValue(fields, "Lunghezza in cm", ["lunghezza"]),
    orderLabelFieldValue(fields, "Colore", ["colore"]),
    orderLabelFieldValue(fields, "Texture", ["texture"]),
    orderLabelFieldValue(fields, "Extension Paradise a", ["extension paradise"]),
    orderLabelFieldValue(fields, "Quante fasce?", ["quante fasce", "fasce"]),
    orderLabelFieldValue(fields, "Quanto ha pagato?", ["quanto ha pagato", "ha pagato"]),
    orderLabelFieldValue(fields, "Quanto manca pagare?", ["manca pagare", "quanto manca"]),
  ];
}

function shopifyBarcodeValue(order: OrderResponse, fields: Array<{ label: string; value: any; id: string }>, orderNo: string) {
  const haystack = [
    orderNo,
    JSON.stringify(order.answers ?? {}),
    ...fields.map((field) => displayOrderFieldValue(field.value)),
  ].join(" ");
  const adminMatch = haystack.match(/admin\.shopify\.com\/store\/[^/\s]+\/orders\/(\d+)/i);
  if (adminMatch?.[1]) return adminMatch[1];
  const orderUrlMatch = haystack.match(/\/orders\/(\d{8,})/i);
  if (orderUrlMatch?.[1]) return orderUrlMatch[1];
  const numericOrder = orderNo.replace(/\D/g, "");
  return numericOrder || order.id;
}

async function resolveShopifyBarcodeValue(order: OrderResponse, fields: Array<{ label: string; value: any; id: string }>, orderNo: string) {
  const fallback = shopifyBarcodeValue(order, fields, orderNo);
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/shopify-barcode`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.barcodeValue) return fallback;
    return String(data.barcodeValue);
  } catch {
    return fallback;
  }
}

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

function code128Values(value: string) {
  const safe = value
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 127 ? char : "-";
    })
    .join("");
  const values = [104, ...safe.split("").map((char) => char.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, code, index) => sum + code * (index === 0 ? 1 : index), 0) % 103;
  return [...values, checksum, 106];
}

function drawCode128(doc: any, value: string, x: number, y: number, width: number, height: number) {
  const patterns = code128Values(value).map((code) => CODE128_PATTERNS[code]).join("");
  const totalModules = patterns.split("").reduce((sum, item) => sum + Number(item), 0);
  const moduleWidth = width / totalModules;
  let cursor = x;
  doc.setFillColor(0, 0, 0);
  patterns.split("").forEach((item, index) => {
    const segmentWidth = Number(item) * moduleWidth;
    if (index % 2 === 0) {
      doc.rect(cursor, y, segmentWidth, height, "F");
    }
    cursor += segmentWidth;
  });
}

function orderPickup(order: OrderResponse) {
  const pickup = order.answers?.__pickup;
  if (!pickup || typeof pickup !== "object") return null;
  return pickup as {
    pickupName?: string;
    completedByName?: string;
    completedAt?: string;
    payment?: { total?: number | null; paid?: number; missing?: number | null };
    proof?: { driveFileUrl?: string; webViewLink?: string; name?: string };
    signature?: { signedByName?: string; signedAt?: string };
  };
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "Non indicato";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return ORDER_COLUMNS.find((column) => column.id === status)?.label ?? status;
}

export function OrderManager({
  initialOrders,
  canManage,
  currentUserName,
  currentUserRole,
}: {
  initialOrders: OrderResponse[];
  canManage: boolean;
  currentUserName: string;
  currentUserRole: string;
}) {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selected, setSelected] = useState<OrderResponse | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState("ALL");
  const [changingStatusTo, setChangingStatusTo] = useState<string | null>(null);
  const [statusNoteText, setStatusNoteText] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [undoing, setUndoing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState<"ALL" | "conversione" | "acquisto" | "accessori" | "altro">("ALL");

  useEffect(() => {
    const target = searchParams.get("ordine") || searchParams.get("order") || searchParams.get("orderId");
    if (!target || selected?.id === target) return;
    const cleanTarget = target.replace(/^#/, "").trim().toLowerCase();
    const match = orders.find((order) => {
      const cleanNumber = orderNumber(order).replace(/^#/, "").trim().toLowerCase();
      return order.id === target || cleanNumber === cleanTarget;
    });
    if (match) setSelected(match);
  }, [orders, searchParams, selected?.id]);

  const filteredOrders = useMemo(() => {
    const clean = query.trim().toLowerCase();
    let result = orders;

    if (clean) {
      // Search is active on ALL orders in the list, bypassing the month filter.
      result = orders.filter((order) => {
        const haystack = [
          orderClientName(order),
          orderNumber(order),
          orderItems(order),
          order.user?.name ?? "",
          order.user_location_name ?? "",
          JSON.stringify(order.answers ?? {}),
        ].join(" ").toLowerCase();
        return haystack.includes(clean);
      });
    } else {
      // Default board view: active columns show all active orders, completed column only shows those of selected month/year.
      result = orders.filter((order) => {
        const status = order.status || "NEW";
        if (status !== "COMPLETED") return true;
        const d = new Date(order.created_at);
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      });
    }

    if (selectedTaskType !== "ALL") {
      result = result.filter(order => getOrderTaskType(order) === selectedTaskType);
    }

    return result;
  }, [orders, query, selectedMonth, selectedYear, selectedTaskType]);

  const mobileOrders = useMemo(() => {
    if (mobileStatus === "ALL") return filteredOrders;
    return filteredOrders.filter((order) => (order.status || "NEW") === mobileStatus);
  }, [filteredOrders, mobileStatus]);

  async function moveOrder(order: OrderResponse, status: string, note?: string) {
    setSavingId(order.id);
    const response = await fetch(`/api/service-forms/responses/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, statusNote: note }),
    });
    setSavingId(null);
    if (!response.ok) return;
    const updated = await response.json();
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
    setSelected((current) => current?.id === order.id ? { ...current, ...updated } : current);
  }

  async function uploadPhoto(order: OrderResponse, file?: File) {
    if (!file) return;
    setPhotoError("");

    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setPhotoError("Scegli una foto JPG, PNG o WEBP fino a 10 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/orders/${order.id}/photo`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Impossibile caricare la foto.");
      }

      const updated = result.order as OrderResponse;
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
      setSelected((current) => current?.id === order.id ? { ...current, ...updated } : current);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Impossibile caricare la foto.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function downloadOrderLabelPdf(order: OrderResponse) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [102, 180] });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const orderNo = orderNumber(order);
    const client = orderClientName(order);
    const fields = (order.form?.fields ?? [])
      .map((field) => ({ label: field.label, value: order.answers?.[field.id], id: field.id }))
      .filter((field) => field.value && !field.id.startsWith("__"));
    const logoDataUrl = await fetch("/logo-label-paradise.png")
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => (blob ? blobToDataUrl(blob) : ""))
      .catch(() => "");

    const pink = [236, 83, 145] as const;
    const textDark = [18, 18, 22] as const;
    const textMuted = [92, 92, 105] as const;
    const palePink = [249, 196, 222] as const;
    const line = (x1: number, y1: number, x2: number, y2: number, color: readonly number[] = palePink, width = 0.45) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(width);
      doc.line(x1, y1, x2, y2);
    };
    const textLines = (value: string, width: number, maxLines = 1) => {
      const lines = doc.splitTextToSize(value || "Non indicato", width).map((line: string) => line.trim());
      if (lines.length <= maxLines) return lines;
      const visible = lines.slice(0, maxLines);
      visible[maxLines - 1] = `${visible[maxLines - 1].replace(/\.+$/, "").slice(0, 44)}...`;
      return visible;
    };
    const labelText = (label: string, x: number, yPos: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6);
      doc.setTextColor(pink[0], pink[1], pink[2]);
      doc.text(label.toUpperCase(), x, yPos);
    };
    const valueText = (value: string, x: number, yPos: number, width: number, size = 11, maxLines = 1) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(textLines(value, width, maxLines), x, yPos);
    };
    const infoCell = (x: number, y: number, width: number, label: string, value: string, maxLines = 1) => {
      labelText(label, x, y);
      valueText(value || "Non indicato", x, y + 11, width, maxLines > 1 ? 9.2 : 11, maxLines);
      line(x, y + 16, x + width, y + 16, palePink, 0.65);
    };
    const initials = client
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const phoneField = findOrderField(fields, ["telefono", "whatsapp"]);
    const weightField = findOrderField(fields, ["peso sulla bilancia", "peso", "grammi", "grammo"]);
    const service = orderItems(order) || (findOrderField(fields, ["servizio", "trattamento"]) ? displayOrderFieldValue(findOrderField(fields, ["servizio", "trattamento"])?.value) : "") || "Non indicato";

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", 8, 10, 48, 19);
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(COMPANY_INFO.name, 8, 20);
      }
    }

    doc.setFillColor(pink[0], pink[1], pink[2]);
    doc.roundedRect(68, 10, 26, 11, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);
    doc.text("ORDINE", 81, 17.2, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`#${orderNo.replace(/^#/, "")}`, 81, 34, { align: "center" });

    line(8, 43, 94, 43, pink, 0.9);
    doc.setFillColor(pink[0], pink[1], pink[2]);
    doc.circle(17, 60, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(255, 255, 255);
    doc.text(initials || "PB", 17, 63, { align: "center" });

    doc.setFontSize(15);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(textLines(client, 62, 1), 32, 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(textLines(service, 62, 1), 32, 69);

    doc.setDrawColor(palePink[0], palePink[1], palePink[2]);
    doc.setLineWidth(0.75);
    doc.roundedRect(8, 82, 86, 58, 3, 3);
    infoCell(12, 96, 36, "Telefono cliente", phoneField ? displayOrderFieldValue(phoneField.value) : "Non indicato");
    infoCell(55, 96, 35, "Peso bilancia", weightField ? displayOrderFieldValue(weightField.value) : "Non indicato");
    infoCell(12, 122, 36, "Data creazione", orderDate(order));
    infoCell(55, 122, 35, "Numero ordine", `#${orderNo.replace(/^#/, "")}`);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Paradise Beauty - Etichetta ordine", pageWidth / 2, 164, { align: "center" });
    doc.save(`Etichetta-${cleanPdfFileName(orderNo)}-${cleanPdfFileName(client)}.pdf`);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setUploadError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          
          const clientKey = results.meta.fields?.find(f => f.toLowerCase().includes("cliente")) || "CLIENTE";
          const grouped = new Map<string, any[]>();
          
          for (const row of rows) {
            const clientName = row[clientKey] || "Senza Nome";
            if (!grouped.has(clientName)) {
              grouped.set(clientName, []);
            }
            grouped.get(clientName)?.push(row);
          }

          const ordersToImport = Array.from(grouped.entries()).map(([clientName, clientRows]) => {
            const notes = clientRows.map((r, index) => {
              const details = Object.entries(r)
                .filter(([k, v]) => k !== clientKey && typeof v === "string" && v.trim() !== "")
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n");
              return `--- RIGA ${index + 1} ---\n${details}`;
            }).join("\n\n");

            // Extract status
            const statuses = clientRows.map(r => {
              const statusKey = Object.keys(r).find(k => k.toLowerCase() === "stato" || k.toLowerCase().includes("stato"));
              return mapCsvStatus(statusKey ? r[statusKey] || "" : "");
            });
            let finalStatus = "NEW";
            if (statuses.includes("NEW")) finalStatus = "NEW";
            else if (statuses.includes("PREPARING")) finalStatus = "PREPARING";
            else if (statuses.includes("ORDERED")) finalStatus = "ORDERED";
            else if (statuses.includes("READY")) finalStatus = "READY";
            else if (statuses.includes("COMPLETED")) finalStatus = "COMPLETED";

            // Extract date
            let finalDate = new Date();
            const dates = clientRows.map(r => {
              const creatoKey = Object.keys(r).find(k => k.toLowerCase().includes("creato il") || k.toLowerCase().includes("creato_il"));
              if (creatoKey && r[creatoKey]) return parseCustomDate(r[creatoKey]);
              const dataKey = Object.keys(r).find(k => k.toLowerCase().includes("data") || k.toLowerCase() === "date");
              if (dataKey && r[dataKey]) return parseCustomDate(r[dataKey]);
              return null;
            }).filter(Boolean) as Date[];

            if (dates.length > 0) {
              // Take oldest date to represent creation time
              finalDate = new Date(Math.min(...dates.map(d => d.getTime())));
            }

            return { 
              clientName, 
              rows: clientRows,
              status: finalStatus,
              createdAt: finalDate.toISOString()
            };
          });

          const res = await fetch("/api/orders/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orders: ordersToImport }),
          });

          if (!res.ok) {
            throw new Error(await res.text());
          }

          setShowCsvUpload(false);
          window.location.reload();
        } catch (err: any) {
          setUploadError("Errore durante l'elaborazione del CSV: " + err.message);
        } finally {
          setUploadingCsv(false);
        }
      },
      error: (error) => {
        setUploadError("Errore di lettura del CSV: " + error.message);
        setUploadingCsv(false);
      }
    });
  }

  async function handleUndoImport() {
    if (!confirm("Sei sicuro di voler eliminare l'ultima importazione effettuata? Questa azione cancellerà solo gli ordini caricati nell'ultimo blocco CSV.")) {
      return;
    }
    setUndoing(true);
    try {
      const res = await fetch("/api/orders/import/undo", { method: "POST" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      alert(`Eliminati con successo ${data.count} ordini dell'ultima importazione.`);
      window.location.reload();
    } catch (err: any) {
      alert("Errore durante l'eliminazione: " + err.message);
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Paradise Operations</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Ordini</h1>
            <p className="mt-2 text-sm text-black/50">{canManage ? "Gestisci" : "Controlla"} gli ordini creati dal modulo ordine: nuovi, in preparazione, ordinati e completati.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-black/40">Mese:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-black/5 border border-black/10 text-black text-xs font-bold rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/10 transition"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-black/5 border border-black/10 text-black text-xs font-bold rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/10 transition"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 w-full lg:w-72">
              <Search className="size-4 text-black/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca ordine, salone, prodotto..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            
            <div className="relative">
              <select
                value={selectedTaskType}
                onChange={(e) => setSelectedTaskType(e.target.value as any)}
                className="appearance-none bg-black/5 border border-black/10 text-black text-xs font-black rounded-full pl-4 pr-9 py-2 outline-none cursor-pointer hover:bg-black/10 transition"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23000000' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 0.6rem center",
                  backgroundSize: "0.85rem 0.85rem",
                  backgroundRepeat: "no-repeat"
                }}
              >
                <option value="ALL">TUTTI I COMPITI</option>
                <option value="conversione">CONVERSIONE CAPELLI</option>
                <option value="acquisto">ACQUISTO EXTENSION</option>
                <option value="accessori">ACCESSORI</option>
                <option value="altro">ALTRO</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMobileStatus("ALL")}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition",
              mobileStatus === "ALL" ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white text-black/50"
            )}
          >
            Tutti {filteredOrders.length}
          </button>
          {ORDER_COLUMNS.map((column) => {
            const count = filteredOrders.filter((order) => (order.status || "NEW") === column.id).length;
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setMobileStatus(column.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition",
                  mobileStatus === column.id ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white text-black/50"
                )}
              >
                {column.label} {count}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3">
          {mobileOrders.length === 0 ? (
            <Card className="bg-white p-6 text-center text-sm font-semibold text-black/40">Nessun ordine in questo stato.</Card>
          ) : null}
          {mobileOrders.map((order) => {
            const currentStatus = order.status || "NEW";
            const status = ORDER_COLUMNS.find((column) => column.id === currentStatus) ?? ORDER_COLUMNS[0];
            const Icon = status.icon;
            const taskType = getOrderTaskType(order);
            const photo = orderPhoto(order);
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelected(order)}
                className={cn(
                  "w-full rounded-[24px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5",
                  taskType === "conversione"
                    ? "border-l-4 border-l-pink-500 border-pink-200/60 bg-pink-50/10"
                    : taskType === "acquisto"
                    ? "border-l-4 border-l-amber-500 border-amber-200/60 bg-amber-50/10"
                    : taskType === "accessori"
                    ? "border-l-4 border-l-indigo-500 border-indigo-200/60 bg-indigo-50/10"
                    : "border-l-4 border-l-slate-400 border-slate-200/60 bg-slate-50/10"
                )}
              >
                {photo ? (
                  <img
                    src={orderPhotoPreviewUrl(photo)}
                    alt={`Foto di ${orderTitle(order)}`}
                    className="mb-3 h-36 w-full rounded-2xl object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-wrap gap-2 items-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#FAF7F9] px-3 py-1.5 text-xs font-extrabold text-[#C66170]">
                      <Icon className="size-4" />
                      {status.label}
                    </div>
                    {renderTaskBadge(taskType)}
                  </div>
                  <Eye className="size-4 shrink-0 text-black/30" />
                </div>
                <h3 className="mt-3 line-clamp-2 text-lg font-extrabold leading-6 text-black">{orderClientName(order)}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Ordine: {orderNumber(order)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-black/40">
                  <span>{order.user_location_name ?? "Salone non indicato"}</span>
                  <span>·</span>
                  <span>{order.user?.name ?? "Staff"}</span>
                  <span>·</span>
                  <span>{orderDate(order)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-5">
        {ORDER_COLUMNS.map((column) => {
          const columnOrders = filteredOrders.filter((order) => (order.status || "NEW") === column.id);
          const Icon = column.icon;
          return (
            <Card key={column.id} className={cn("min-h-[26rem] border p-4", column.color)}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-5" />
                  <h2 className="font-semibold">{column.label}</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/55">{columnOrders.length}</span>
              </div>
              <div className="grid gap-3">
                {columnOrders.length === 0 ? (
                  <p className="rounded-2xl bg-white/70 p-4 text-sm text-black/40">Nessun ordine.</p>
                ) : null}
                {columnOrders.map((order) => {
                  const photo = orderPhoto(order);
                  const taskType = getOrderTaskType(order);
                  const borderStyle = taskType === "conversione" 
                    ? "border-l-4 border-l-pink-500 border-t border-r border-b border-pink-200/60" 
                    : taskType === "acquisto"
                    ? "border-l-4 border-l-amber-500 border-t border-r border-b border-amber-200/60"
                    : taskType === "accessori"
                    ? "border-l-4 border-l-indigo-500 border-t border-r border-b border-indigo-200/60"
                    : "border-l-4 border-l-slate-400 border-t border-r border-b border-slate-200/60";

                  return (
                    <button 
                      key={order.id} 
                      onClick={() => setSelected(order)} 
                      className={cn(
                        "overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border border-slate-100",
                        borderStyle
                      )}
                    >
                      {photo ? (
                        <img
                          src={orderPhotoPreviewUrl(photo)}
                          alt={`Foto di ${orderTitle(order)}`}
                          className="h-28 w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="line-clamp-2 font-bold leading-5 text-black">{orderClientName(order)}</h3>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Ordine: {orderNumber(order)}</p>
                          </div>
                          <Eye className="size-4 shrink-0 text-black/35" />
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-black/50">{orderItems(order) || "Nessun dettaglio prodotti."}</p>
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                          {renderTaskBadge(taskType)}
                          <Badge tone={orderPriority(order).toLowerCase().includes("urgent") || orderPriority(order).toLowerCase().includes("bloc") ? "pink" : "gold"}>{orderPriority(order)}</Badge>
                          {order.user_location_name ? <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/45">{order.user_location_name}</span> : null}
                        </div>
                        <p className="mt-3 text-[11px] font-semibold text-black/35">{order.user?.name ?? "Staff"} · {orderDate(order)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 backdrop-blur-sm lg:place-items-center lg:p-4">
          <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] bg-white p-3 shadow-2xl lg:max-w-7xl lg:rounded-[28px] lg:p-5">
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 border-b border-black/5 bg-white/95 pb-4 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setSelected(null)} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-black/5 bg-white shadow-sm transition hover:bg-black/[0.03]"><ArrowLeft className="size-5" /></button>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/35">Ordine {orderNumber(selected)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black tracking-tight text-slate-950">{orderClientName(selected)}</h2>
                    <Badge tone="pink">{statusLabel(selected.status || "NEW")}</Badge>
                    {renderTaskBadge(getOrderTaskType(selected))}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-black/55">{orderItems(selected) || "Nessuna descrizione inserita"}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="soft" onClick={() => void downloadOrderLabelPdf(selected)}><Printer className="size-4" /> Stampa</Button>
                <Button variant="soft" onClick={() => setSelected(null)}><X className="size-4" /> Chiudi</Button>
              </div>
            </div>
            <div className="mb-4 grid gap-3 rounded-[22px] border border-black/5 bg-[#FBF8FA] p-3 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#F2F0FF] text-[#8064D8]"><MapPin className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Salone</p>
                  <p className="mt-1 text-sm font-black text-black/80">{selected.user_location_name ?? "Non indicato"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#F2F0FF] text-[#8064D8]"><UserRound className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Creato da</p>
                  <p className="mt-1 text-sm font-black text-black/80">{selected.user?.name ?? "Staff"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#F2F0FF] text-[#8064D8]"><CalendarDays className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Data creazione</p>
                  <p className="mt-1 text-sm font-black text-black/80">{orderDate(selected)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#F2F0FF] text-[#8064D8]"><Clock3 className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Ultima modifica</p>
                  <p className="mt-1 text-sm font-black text-black/80">{formatDateTime(selected.updated_at)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="bg-white">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-black/55">Informazioni ordine</h3>
                  <span className="rounded-full bg-black/[0.04] px-3 py-1 text-[11px] font-bold text-black/40">
                    {(selected.form?.fields ?? []).filter((field) => selected.answers?.[field.id] && !field.id.startsWith("__")).length} campi
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(selected.form?.fields ?? []).map((field) => {
                    const value = selected.answers?.[field.id];
                    if (!value) return null;
                    if (field.id.startsWith("__")) return null;
                    const isFile = typeof value === "object" && value.storagePath;
                    const displayValue = displayOrderFieldValue(value);
                    const FieldIcon = orderFieldIcon(field.label);
                    return (
                      <div key={field.id} className="rounded-2xl border border-black/5 bg-[#FBF8FA] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/35">{field.label}</p>
                          {FieldIcon ? <FieldIcon className="size-4 shrink-0 text-[#C66170]" /> : null}
                        </div>
                        {isFile ? (
                          <a href={`/api/service-forms/responses/file?path=${encodeURIComponent(value.storagePath)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#8064D8]">
                            <LinkIcon className="size-4" /> {value.name ?? "Apri file"}
                          </a>
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-black/75">{displayValue}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Log attività / cambi di stato */}
                {Array.isArray(selected.activity_log) && (selected.activity_log as any[]).length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-black/5 pt-6">
                    <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-black/40">Cronologia Stati e Note</h3>
                    <div className="grid gap-3">
                      {(selected.activity_log as any[]).map((log: any, idx: number) => {
                        const logDate = log.at || log.date;
                        let formattedDate = "";
                        if (logDate) {
                          try {
                            formattedDate = new Intl.DateTimeFormat("it-IT", { 
                              day: "2-digit", 
                              month: "short", 
                              hour: "2-digit", 
                              minute: "2-digit" 
                            }).format(new Date(logDate));
                          } catch (e) {
                            formattedDate = "";
                          }
                        }

                        let title = "";
                        if (log.action) {
                          title = log.action;
                        } else if (log.from !== undefined || log.to !== undefined) {
                          const colFrom = ORDER_COLUMNS.find((c) => c.id === log.from);
                          const colTo = ORDER_COLUMNS.find((c) => c.id === log.to);
                          title = `Stato cambiato da ${colFrom?.label ?? log.from ?? 'sconosciuto'} a ${colTo?.label ?? log.to ?? 'sconosciuto'}`;
                        } else {
                          title = "Attività registrata";
                        }

                        const actor = log.by || log.user || "Staff";

                        return (
                          <div key={idx} className="rounded-2xl border border-black/5 bg-[#FAF7F9] p-4 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-black/75">
                                {title}
                              </span>
                              {formattedDate && (
                                <span className="text-[11px] text-black/40">
                                  {formattedDate}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-black/45">Modificato da: {actor}</p>
                            {log.note && (
                              <div className="mt-3 rounded-xl bg-white p-3 border border-black/5">
                                <p className="text-xs font-bold text-black/35 mb-1">Nota stato:</p>
                                <p className="text-sm text-black/80 whitespace-pre-wrap">{log.note}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <ResponseComments
                  responseId={selected.id}
                  initialComments={selected.comments || []}
                  currentUserName={currentUserName}
                  currentUserRole={currentUserRole}
                  onCommentsUpdate={(updatedComments) => {
                    setOrders((current) =>
                      current.map((item) =>
                        item.id === selected.id ? { ...item, comments: updatedComments } : item
                      )
                    );
                    setSelected((current) =>
                      current?.id === selected.id ? { ...current, comments: updatedComments } : current
                    );
                  }}
                />
              </Card>
              <div className="space-y-4">
                <Card className="bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Camera className="size-5 text-[#C66170]" />
                      <h3 className="font-semibold">Foto ordine</h3>
                    </div>
                    {orderPhoto(selected)?.driveFileUrl ? (
                      <a href={orderPhoto(selected)!.driveFileUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-[#C66170] hover:underline">
                        Drive
                      </a>
                    ) : null}
                  </div>
                  {orderPhoto(selected) ? (
                    (() => {
                      const photo = orderPhoto(selected)!;
                      const previewUrl = orderPhotoPreviewUrl(photo);
                      return (
                    <div className="mt-4">
                      <a href={photo.driveFileUrl || photo.url} target="_blank" rel="noreferrer" className="grid h-80 place-items-center overflow-hidden rounded-2xl border border-black/5 bg-[#F8F3F6]">
                        <img src={previewUrl} alt={`Foto di ${orderTitle(selected)}`} className="max-h-80 w-full object-contain" />
                      </a>
                      <p className="mt-2 truncate text-center text-xs font-semibold text-black/45">{photo.name ?? "Foto ordine"}</p>
                    </div>
                      );
                    })()
                  ) : (
                    <div className="mt-4 grid h-48 place-items-center rounded-2xl border-2 border-dashed border-black/10 bg-black/[0.02] text-center text-sm text-black/40">
                      <div>
                        <Camera className="mx-auto mb-2 size-7" />
                        Nessuna foto caricata
                      </div>
                    </div>
                  )}
                  <label className={cn(
                    "mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#C66170] px-4 text-sm font-bold text-white transition hover:bg-[#B45464]",
                    uploadingPhoto && "pointer-events-none opacity-60"
                  )}>
                    {uploadingPhoto ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {uploadingPhoto ? "Caricamento..." : orderPhoto(selected) ? "Sostituisci foto" : "Carica foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(event) => {
                        void uploadPhoto(selected, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-2 text-center text-[11px] text-black/35">JPG, PNG o WEBP · massimo 10 MB</p>
                  {photoError ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">{photoError}</p> : null}
                </Card>
                <Card className="bg-white">
                  <h3 className="font-semibold">{canManage ? "Stato ordine" : "Avanzamento ordine"}</h3>
                  {!canManage ? <p className="mt-1 text-xs text-black/45">Puoi controllare lo stato. Le modifiche sono riservate ai responsabili.</p> : null}
                  {changingStatusTo ? (
                    <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-black/60">
                        Nota per cambio in: {statusLabel(changingStatusTo)}
                      </h4>
                      <textarea
                        value={statusNoteText}
                        onChange={(e) => setStatusNoteText(e.target.value)}
                        placeholder="Inserisci una nota facoltativa..."
                        rows={3}
                        className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm outline-none resize-none focus:border-paradise-pink"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="soft"
                          onClick={() => {
                            setChangingStatusTo(null);
                            setStatusNoteText("");
                          }}
                        >
                          Annulla
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => {
                            void moveOrder(selected, changingStatusTo, statusNoteText);
                            setChangingStatusTo(null);
                            setStatusNoteText("");
                          }}
                        >
                          Conferma
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      {ORDER_COLUMNS.map((column) => {
                        const Icon = column.icon;
                        const active = (selected.status || "NEW") === column.id;
                        return (
                        <button
                          key={column.id}
                          type="button"
                          disabled={!canManage || savingId === selected.id}
                          onClick={() => {
                            setChangingStatusTo(column.id);
                            setStatusNoteText("");
                          }}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition",
                            active ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white",
                            canManage && "hover:bg-[#FAF7F9]"
                          )}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon className="size-4" />
                            {column.label}
                          </span>
                          {savingId === selected.id ? <Loader2 className="size-4 animate-spin" /> : active ? <CheckCircle2 className="size-4" /> : null}
                        </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
                <Card className="bg-white">
                  <h3 className="font-semibold">Dettagli</h3>
                  <div className="mt-4 grid gap-3 text-sm">
                    <p><span className="text-black/40">Creato da:</span> <b>{selected.user?.name ?? "Staff"}</b></p>
                    <p><span className="text-black/40">Salone:</span> <b>{selected.user_location_name ?? "Non indicato"}</b></p>
                    {(() => {
                      const pickup = orderPickup(selected);
                      if (!pickup) return null;
                      const proofUrl = pickup.proof?.driveFileUrl || pickup.proof?.webViewLink;
                      return (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-950">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700/70">Consegna registrata</p>
                          <div className="mt-2 grid gap-2">
                            <p><span className="text-emerald-900/55">Consegnato da:</span> <b>{pickup.completedByName || pickup.signature?.signedByName || "Staff"}</b></p>
                            <p><span className="text-emerald-900/55">Ritirato da:</span> <b>{pickup.pickupName || "Non indicato"}</b></p>
                            <p><span className="text-emerald-900/55">Giorno:</span> <b>{formatDateTime(pickup.completedAt || pickup.signature?.signedAt)}</b></p>
                            <p><span className="text-emerald-900/55">Pagato:</span> <b>{formatMoney(pickup.payment?.paid)}</b></p>
                            <p><span className="text-emerald-900/55">Mancante:</span> <b>{formatMoney(pickup.payment?.missing)}</b></p>
                            {proofUrl ? (
                              <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm">
                                <LinkIcon className="size-3.5" />
                                Prova ritiro
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const shopifyOrderField = (selected.form?.fields ?? []).find(f => 
                        f.label?.toLowerCase().includes("ordine shopify") || 
                        f.label?.toLowerCase().includes("numero ordine") || 
                        f.label?.toLowerCase().includes("codice")
                      );
                      const shopifyOrderVal = shopifyOrderField ? selected.answers?.[shopifyOrderField.id] : null;
                      const finalOrderVal = selected.answers?.field_1782221517924 || shopifyOrderVal;
                      return (
                        <p>
                          <span className="text-black/40">Ordine Shopify:</span>{" "}
                          <b className="text-[#C66170] font-mono select-all bg-pink-50/50 px-1 py-0.5 rounded border border-pink-100/55">
                            {String(finalOrderVal || "Non inserito")}
                          </b>
                        </p>
                      );
                    })()}
                    <p><span className="text-black/40">ID Scheda:</span> <span className="font-mono text-xs text-black/60 bg-black/5 px-1.5 py-0.5 rounded select-all">{selected.id}</span></p>
                    <p className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-black/40" /> {orderDate(selected)}</p>
                  </div>
                </Card>
                {currentUserRole === "SUPER_ADMIN" && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Sei sicuro di voler eliminare definitivamente questo ordine? Questa azione non può essere annullata.")) return;
                      try {
                        const response = await fetch(`/api/service-forms/responses/${selected.id}`, {
                          method: "DELETE"
                        });
                        if (response.ok) {
                          setOrders(current => current.filter(item => item.id !== selected.id));
                          setSelected(null);
                        } else {
                          alert("Errore durante l'eliminazione dell'ordine.");
                        }
                      } catch (err) {
                        alert("Errore di connessione.");
                      }
                    }}
                    className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-black text-red-700 transition hover:bg-red-100"
                  >
                    Elimina Ordine
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
