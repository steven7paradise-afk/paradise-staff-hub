"use client";

type LabelField = { id: string; label: string; type?: string };

export type OrderLabelResponse = {
  id: string;
  answers?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  user_location_name?: string | null;
  priority?: string | null;
  form?: { fields?: LabelField[] | null } | null;
};

type OrderLabelField = { id: string; label: string; value: any };

const ORDER_PHOTO_KEY = "__orderPhoto";

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

function answerById(order: OrderLabelResponse, id: string) {
  const value = order.answers?.[id];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.fileName) return String(value.fileName);
    if (value.url) return String(value.url);
    return "";
  }
  return String(value);
}

function displayValue(value: any) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.fileName) return String(value.fileName);
    if (value.url) return String(value.url);
    return "";
  }
  return String(value);
}

function labelIncludes(label: string, terms: string[]) {
  const clean = label.toLowerCase();
  return terms.some((term) => clean.includes(term));
}

function fieldsFor(order: OrderLabelResponse): OrderLabelField[] {
  return (order.form?.fields ?? [])
    .map((field) => ({ id: field.id, label: field.label, value: order.answers?.[field.id] }))
    .filter((field) => field.value && !field.id.startsWith("__"));
}

function findField(fields: OrderLabelField[], terms: string[]) {
  return fields.find((field) => labelIncludes(field.label, terms));
}

function fieldValue(order: OrderLabelResponse, terms: string[]) {
  const field = findField(fieldsFor(order), terms);
  return field ? displayValue(field.value) : "";
}

function orderClientName(order: OrderLabelResponse) {
  return fieldValue(order, ["cliente", "nome cliente", "nome del cliente", "nome"]) || "Cliente non indicato";
}

function orderNumber(order: OrderLabelResponse) {
  return answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]) || `#${order.id.substring(0, 5).toUpperCase()}`;
}

function orderItems(order: OrderLabelResponse) {
  return answerById(order, "order_items") || fieldValue(order, ["cosa", "prodot", "material", "ordinare"]);
}

function taskType(order: OrderLabelResponse): "conversione" | "acquisto" | "altro" {
  const allText = [
    JSON.stringify(order.answers ?? {}),
    orderItems(order),
    orderNumber(order),
  ].join(" ").toLowerCase();
  if (allText.includes("conversione") || allText.includes("conver")) return "conversione";
  if (allText.includes("acquisto") || allText.includes("extension") || allText.includes("nuove ext")) return "acquisto";
  return "altro";
}

function labelField(fields: OrderLabelField[], label: string, terms: string[]) {
  const field = findField(fields, terms);
  return { label, value: field ? displayValue(field.value) : "Non indicato" };
}

function labelFields(order: OrderLabelResponse, fields: OrderLabelField[]) {
  const type = taskType(order);
  const common = [labelField(fields, "Cosa dobbiamo fare?", ["cosa dobbiamo fare", "cosa", "fare"])];
  if (type === "conversione") {
    return [
      ...common,
      labelField(fields, "Peso sulla bilancia", ["peso sulla bilancia", "peso"]),
      labelField(fields, "Extension Paradise a", ["extension paradise"]),
      labelField(fields, "Quante fasce?", ["quante fasce", "fasce"]),
    ];
  }
  return [
    ...common,
    labelField(fields, "Grammi", ["grammi", "grammo"]),
    labelField(fields, "Lunghezza in cm", ["lunghezza"]),
    labelField(fields, "Colore", ["colore"]),
    labelField(fields, "Texture", ["texture"]),
    labelField(fields, "Extension Paradise a", ["extension paradise"]),
    labelField(fields, "Quante fasce?", ["quante fasce", "fasce"]),
  ];
}

function orderDate(value?: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value ? new Date(value) : new Date());
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

function shopifyBarcodeValue(order: OrderLabelResponse, fields: OrderLabelField[], orderNo: string) {
  const haystack = [
    orderNo,
    JSON.stringify(order.answers ?? {}),
    ...fields.map((field) => displayValue(field.value)),
  ].join(" ");
  const adminMatch = haystack.match(/admin\.shopify\.com\/store\/[^/\s]+\/orders\/(\d+)/i);
  if (adminMatch?.[1]) return adminMatch[1];
  const orderUrlMatch = haystack.match(/\/orders\/(\d{8,})/i);
  if (orderUrlMatch?.[1]) return orderUrlMatch[1];
  const numericOrder = orderNo.replace(/\D/g, "");
  return numericOrder || order.id;
}

async function resolveBarcode(order: OrderLabelResponse, fields: OrderLabelField[], orderNo: string) {
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
    if (index % 2 === 0) doc.rect(cursor, y, segmentWidth, height, "F");
    cursor += segmentWidth;
  });
}

export function isOrderLabelForm(form?: { name?: string | null; category?: string | null } | null) {
  const name = String(form?.name || "").toLowerCase();
  const category = String(form?.category || "").toLowerCase();
  return name.includes("modulo ordine") || category.includes("ordini");
}

export async function downloadOrderLabelPdf(order: OrderLabelResponse) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [90, 110] });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const orderNo = orderNumber(order);
  const client = orderClientName(order);
  const fields = fieldsFor(order);
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
    doc.setFontSize(4.1);
    doc.setTextColor(pink[0], pink[1], pink[2]);
    doc.text(label.toUpperCase(), x, yPos);
  };
  const valueText = (value: string, x: number, yPos: number, width: number, size = 6.2, maxLines = 1) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(textLines(value, width, maxLines), x, yPos);
  };
  const infoRow = (y: number, label: string, value: string, maxLines = 1) => {
    labelText(label, 8, y);
    valueText(value || "Non indicato", 8, y + 6.4, 74, maxLines > 1 ? 5.2 : 6.2, maxLines);
    line(8, y + 10.2, 82, y + 10.2);
  };
  const initials = client.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const phoneField = findField(fields, ["telefono", "whatsapp"]);
  const weightField = findField(fields, ["peso sulla bilancia", "peso", "grammi", "grammo"]);
  const service = orderItems(order) || fieldValue(order, ["servizio", "trattamento"]) || "Non indicato";

  doc.setDrawColor(pink[0], pink[1], pink[2]);
  doc.setLineWidth(0.65);
  doc.roundedRect(2.5, 2.5, pageWidth - 5, pageHeight - 5, 4, 4);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 7, 6, 38, 15);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text("PARADISE BEAUTY", 7, 13);
    }
  }

  doc.setFillColor(pink[0], pink[1], pink[2]);
  doc.roundedRect(58, 7, 24, 9, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("ORDINE", 70, 13, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`#${orderNo.replace(/^#/, "")}`, 70, 24, { align: "center" });

  line(6, 29, 84, 29, pink, 0.7);
  doc.setFillColor(pink[0], pink[1], pink[2]);
  doc.circle(14, 40, 6.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.4);
  doc.setTextColor(255, 255, 255);
  doc.text(initials || "PB", 14, 42.2, { align: "center" });

  doc.setFontSize(8.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(textLines(client, 58, 1), 24, 38.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.1);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(textLines(service, 58, 1), 24, 44.5);

  doc.setDrawColor(palePink[0], palePink[1], palePink[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(6, 50, 78, 47, 2.5, 2.5);
  infoRow(56, "Numero telefono cliente", phoneField ? displayValue(phoneField.value) : "Non indicato");
  infoRow(68, "Peso bilancia", weightField ? displayValue(weightField.value) : "Non indicato");
  infoRow(80, "Data creazione", orderDate(order.created_at));
  infoRow(92, "Numero ordine", `#${orderNo.replace(/^#/, "")}`);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.3);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Paradise Beauty - Etichetta ordine", pageWidth / 2, 103.2, { align: "center" });
  doc.save(`Etichetta-${cleanPdfFileName(orderNo)}-${cleanPdfFileName(client)}.pdf`);
}
