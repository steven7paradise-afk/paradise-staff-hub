"use client";

type LabelField = { id: string; label: string; type?: string };

export type OrderLabelResponse = {
  id: string;
  answers?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  user?: { name?: string | null } | null;
  user_location_name?: string | null;
  priority?: string | null;
  form?: { fields?: LabelField[] | null } | null;
};

type OrderLabelField = { id: string; label: string; value: any };

const ORDER_PHOTO_KEY = "__orderPhoto";

// Lo stesso supporto fisico 102 x 90 mm viene inviato al driver in verticale:
// 90 mm di larghezza e 102 mm di avanzamento. In questo modo Chrome/PM-241
// mostrano "Verticale" e mantengono tutto il contenuto su una sola etichetta.
const ORDER_LABEL_WIDTH_MM = 90;
const ORDER_LABEL_HEIGHT_MM = 102;
const ORDER_LABEL_CANVAS_WIDTH = 1800;
const ORDER_LABEL_CANVAS_HEIGHT = 2040;

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

function svgToDataUrl(svg: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = ORDER_LABEL_CANVAS_WIDTH;
      const sourceHeight = ORDER_LABEL_CANVAS_HEIGHT;
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas non disponibile"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
      resolve(canvas.toDataURL("image/png", 1));
    };
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function orderLabelBarcodeValue(orderId: string, visibleOrderNumber?: string) {
  const compactOrderNumber = String(visibleOrderNumber || "")
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 20);
  return compactOrderNumber || orderId;
}

export function orderLabelQrValue(
  orderId: string,
  visibleOrderNumber?: string,
  baseUrl = "https://staff-paradise.tech",
) {
  const reference = encodeURIComponent(orderLabelBarcodeValue(orderId, visibleOrderNumber));
  const target = new URL(`/o/${reference}`, baseUrl);
  return target.toString();
}

export function isOrderLabelForm(form?: { name?: string | null; category?: string | null } | null) {
  const name = String(form?.name || "").toLowerCase();
  const category = String(form?.category || "").toLowerCase();
  return name.includes("modulo ordine") || category.includes("ordini");
}

async function buildOrderLabelPdf(order: OrderLabelResponse) {
  const { jsPDF } = await import("jspdf");
  const { toDataURL: createQrDataUrl } = await import("qrcode");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [ORDER_LABEL_WIDTH_MM, ORDER_LABEL_HEIGHT_MM],
    compress: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const orderNo = orderNumber(order);
  const client = orderClientName(order);
  const createdAt = formatDateTime(order.created_at) || orderDate();
  const compiledBy = order.user?.name?.trim() || "Non indicato";
  const qrValue = orderLabelQrValue(order.id, orderNo);
  const qrCodeDataUrl = await createQrDataUrl(qrValue, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 800,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const logoDataUrl = await fetch("/logo-label-paradise.png")
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => (blob ? blobToDataUrl(blob) : ""))
    .catch(() => "");

  const cleanOrderNo = `#${orderNo.replace(/^#/, "")}`;
  const logoImage = logoDataUrl
    ? `<image href="${logoDataUrl}" x="245" y="70" width="410" height="130" preserveAspectRatio="xMidYMid meet" />`
    : `<text x="450" y="150" text-anchor="middle" font-size="54" font-weight="800" fill="#111">Paradise Beauty</text>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ORDER_LABEL_CANVAS_WIDTH}" height="${ORDER_LABEL_CANVAS_HEIGHT}" viewBox="0 0 900 1020">
      <rect width="900" height="1020" fill="#ffffff"/>
      <rect x="55" y="35" width="790" height="190" rx="28" fill="#fff8fb" stroke="#ec5391" stroke-width="4"/>
      ${logoImage}

      <rect x="55" y="260" width="790" height="395" rx="30" fill="#fff8fb" stroke="#ec5391" stroke-width="4"/>
      <line x1="455" y1="290" x2="455" y2="625" stroke="#ec5391" stroke-width="3" opacity="0.35"/>
      <image href="${qrCodeDataUrl}" x="75" y="280" width="355" height="355" preserveAspectRatio="xMidYMid meet" image-rendering="pixelated"/>

      <text x="495" y="320" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800" letter-spacing="2.2" fill="#9b496c">CLIENTE</text>
      <text x="495" y="378" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#111111">${escapeSvgText(shortSvgText(client, 19))}</text>
      <line x1="495" y1="418" x2="805" y2="418" stroke="#ec5391" stroke-width="3" opacity="0.35"/>
      <text x="495" y="468" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800" letter-spacing="2.2" fill="#9b496c">NUMERO ORDINE</text>
      <text x="495" y="535" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900" fill="#050505">${escapeSvgText(shortSvgText(cleanOrderNo, 11))}</text>
      <text x="495" y="604" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1.2" fill="#111111">PRONTO</text>
      <rect x="735" y="558" width="62" height="58" rx="7" fill="#ffffff" stroke="#111111" stroke-width="6"/>

      <rect x="55" y="695" width="790" height="155" rx="24" fill="#ffffff" stroke="#e8c8d6" stroke-width="3"/>
      <line x1="450" y1="720" x2="450" y2="825" stroke="#e8c8d6" stroke-width="3"/>
      <text x="90" y="750" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" letter-spacing="1.8" fill="#9b496c">DATA ORDINE</text>
      <text x="90" y="802" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#111111">${escapeSvgText(shortSvgText(createdAt, 24))}</text>
      <text x="490" y="750" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" letter-spacing="1.8" fill="#9b496c">COMPILATO DA</text>
      <text x="490" y="802" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#111111">${escapeSvgText(shortSvgText(compiledBy, 22))}</text>

      <text x="450" y="925" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="800" letter-spacing="1.2" fill="#111111">www.paradisebeauty.it</text>
    </svg>
  `;
  const labelImageDataUrl = await svgToDataUrl(svg);
  const imageRatio = ORDER_LABEL_CANVAS_WIDTH / ORDER_LABEL_CANVAS_HEIGHT;
  const pageRatio = pageWidth / pageHeight;
  const imageWidth = imageRatio > pageRatio ? pageWidth : pageHeight * imageRatio;
  const imageHeight = imageRatio > pageRatio ? pageWidth / imageRatio : pageHeight;
  const imageX = (pageWidth - imageWidth) / 2;
  const imageY = (pageHeight - imageHeight) / 2;
  doc.addImage(labelImageDataUrl, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");
  return {
    doc,
    labelImageDataUrl,
    fileName: `Etichetta-102x90-${cleanPdfFileName(orderNo)}-${cleanPdfFileName(client)}.pdf`,
  };
}

export async function downloadOrderLabelPdf(order: OrderLabelResponse) {
  const { doc, fileName } = await buildOrderLabelPdf(order);
  doc.save(fileName);
}

export async function printOrderLabelPdf(order: OrderLabelResponse, preparedPrintWindow?: Window | null) {
  // Apriamo subito la finestra per non farla bloccare dal browser. Stampiamo
  // direttamente il PDF 102 x 90: la pagina HTML intermedia aggiungeva
  // intestazioni/piè di pagina e poteva dividere il layout in due fogli.
  const printWindow = preparedPrintWindow === undefined ? window.open("", "_blank") : preparedPrintWindow;

  try {
    const { doc, fileName } = await buildOrderLabelPdf(order);
    doc.setProperties({ title: fileName });
    doc.autoPrint({ variant: "non-conform" });

    if (!printWindow) {
      doc.save(fileName);
      return;
    }

    printWindow.opener = null;
    const pdfUrl = URL.createObjectURL(doc.output("blob"));
    printWindow.location.replace(pdfUrl);
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 10 * 60 * 1000);
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
