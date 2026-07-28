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

function rotateDataUrl180(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(Math.PI);
      context.drawImage(image, -canvas.width / 2, -canvas.height / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortSvgText(value: string, max = 42) {
  const clean = (value || "Non indicato").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function svgToRotatedPortraitDataUrl(svg: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = 1520;
      const sourceHeight = 1020;
      const canvas = document.createElement("canvas");
      canvas.width = sourceHeight;
      canvas.height = sourceWidth;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas non disponibile"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
      resolve(canvas.toDataURL("image/png", 1));
    };
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

async function buildOrderLabelPdf(order: OrderLabelResponse) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [102, 152] });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const orderNo = orderNumber(order);
  const client = orderClientName(order);
  const fields = fieldsFor(order);
  const logoDataUrl = await fetch("/logo-label-paradise.png")
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => (blob ? blobToDataUrl(blob) : ""))
    .catch(() => "");

  const initials = client.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const phoneField = findField(fields, ["telefono", "whatsapp"]);
  const weightField = findField(fields, ["peso sulla bilancia", "peso", "grammi", "grammo"]);
  const service = orderItems(order) || fieldValue(order, ["servizio", "trattamento"]) || "Non indicato";
  const cleanOrderNo = `#${orderNo.replace(/^#/, "")}`;
  const phone = phoneField ? displayValue(phoneField.value) : "Non indicato";
  const weight = weightField ? displayValue(weightField.value) : "Non indicato";
  const createdAt = orderDate(order.created_at);
  const logoImage = logoDataUrl
    ? `<image href="${logoDataUrl}" x="80" y="70" width="420" height="170" preserveAspectRatio="xMidYMid meet" />`
    : `<text x="90" y="155" font-size="52" font-weight="800" fill="#111">Paradise Beauty</text>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1520" height="1020" viewBox="0 0 1520 1020">
      <rect width="1520" height="1020" fill="#ffffff"/>
      ${logoImage}
      <rect x="1210" y="78" width="220" height="96" rx="22" fill="#ec5391"/>
      <text x="1320" y="138" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#ffffff">ORDINE</text>
      <text x="1320" y="295" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="900" fill="#050505">${escapeSvgText(cleanOrderNo)}</text>
      <line x1="80" y1="355" x2="1440" y2="355" stroke="#ec5391" stroke-width="8"/>

      <circle cx="158" cy="520" r="70" fill="#ec5391"/>
      <text x="158" y="543" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${escapeSvgText(initials || "PB")}</text>
      <text x="270" y="500" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900" fill="#121216">${escapeSvgText(shortSvgText(client, 34))}</text>
      <text x="270" y="570" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500" fill="#5c5c69">${escapeSvgText(shortSvgText(service, 58))}</text>

      <rect x="80" y="662" width="1360" height="214" rx="28" fill="#ffffff" stroke="#f9c4de" stroke-width="7"/>
      <text x="120" y="745" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ec5391">TELEFONO CLIENTE</text>
      <text x="120" y="810" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#121216">${escapeSvgText(shortSvgText(phone, 20))}</text>
      <line x1="120" y1="848" x2="545" y2="848" stroke="#f9c4de" stroke-width="6"/>

      <text x="610" y="745" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ec5391">PESO BILANCIA</text>
      <text x="610" y="810" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#121216">${escapeSvgText(shortSvgText(weight, 18))}</text>
      <line x1="610" y1="848" x2="880" y2="848" stroke="#f9c4de" stroke-width="6"/>

      <text x="940" y="745" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ec5391">DATA CREAZIONE</text>
      <text x="940" y="810" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#121216">${escapeSvgText(createdAt)}</text>
      <line x1="940" y1="848" x2="1185" y2="848" stroke="#f9c4de" stroke-width="6"/>

      <text x="1240" y="745" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ec5391">NUMERO ORDINE</text>
      <text x="1240" y="810" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="800" fill="#121216">${escapeSvgText(cleanOrderNo)}</text>
      <line x1="1240" y1="848" x2="1400" y2="848" stroke="#f9c4de" stroke-width="6"/>

      <text x="760" y="952" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#121216">Paradise Beauty - Etichetta ordine</text>
    </svg>
  `;
  const labelImageDataUrl = await svgToRotatedPortraitDataUrl(svg);
  doc.addImage(labelImageDataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
  return { doc, fileName: `Etichetta-orizzontale-${cleanPdfFileName(orderNo)}-${cleanPdfFileName(client)}.pdf` };
}

export async function downloadOrderLabelPdf(order: OrderLabelResponse) {
  const { doc, fileName } = await buildOrderLabelPdf(order);
  doc.save(fileName);
}

export async function printOrderLabelPdf(order: OrderLabelResponse) {
  const { doc, fileName } = await buildOrderLabelPdf(order);
  const blobUrl = URL.createObjectURL(doc.output("blob"));
  const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!printWindow) {
    doc.save(fileName);
    return;
  }
  const print = () => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  };
  printWindow.addEventListener("load", print, { once: true });
  window.setTimeout(print, 800);
}
