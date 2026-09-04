import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFotoOrdineToGoogleDrive } from "@/lib/google-drive";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";

export const dynamic = "force-dynamic";

const MAX_PROOF_SIZE = 12 * 1024 * 1024;
const ORDER_FORM_CATEGORY = "Ordini";
const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuovo ordine",
  PREPARING: "Preparando ordine",
  ORDERED: "Ordinato",
  READY: "Arrivato / pronto",
  COMPLETED: "Completato",
  ARCHIVED: "Archiviato",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

function answerById(order: any, id: string) {
  const value = order.answers?.[id];
  if (!value) return "";
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

function plainAnswer(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return value.map(plainAnswer).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const item = value as Record<string, any>;
    return String(item.text ?? item.message ?? item.note ?? item.name ?? item.value ?? item.url ?? item.webViewLink ?? item.driveFileUrl ?? "").trim();
  }
  return String(value).trim();
}

function fieldValue(order: any, includes: string[]) {
  const fields = Array.isArray(order.form?.fields) ? order.form.fields : [];
  const field = fields.find((item: any) => includes.some((needle) => String(item.label ?? "").toLowerCase().includes(needle)));
  if (!field) return "";
  return answerById(order, field.id);
}

function moneyValue(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyFieldValue(order: any, includes: string[]) {
  const direct = includes
    .map((key) => order.answers?.[key])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  if (direct !== undefined && direct !== null) return direct;
  return fieldValue(order, includes);
}

function orderNumber(order: any) {
  const title = answerById(order, "order_title") || fieldValue(order, ["numero ordine", "ordine shopify", "nome ordine", "ordine", "titolo"]);
  if (title) return title;
  return `#${String(order.id).substring(0, 5).toUpperCase()}`;
}

function orderClientName(order: any) {
  const clientName = fieldValue(order, ["cliente", "nome cliente", "nome del cliente", "nome"]);
  if (clientName) return clientName;
  const title = answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]);
  if (title && Number.isNaN(Number(String(title).replace("#", "").trim()))) return title;
  return "Cliente non indicato";
}

function orderPhone(order: any) {
  return fieldValue(order, ["telefono", "phone", "numero di"]);
}

function orderPaymentSummary(order: any) {
  const deposit = moneyValue(moneyFieldValue(order, ["client_control_deposit_paid", "acconto"]));
  const paid = moneyValue(moneyFieldValue(order, ["client_control_paid", "pagato", "saldato"]));
  const expected = moneyValue(order.answers?.client_control_shopify_expected_paid);
  const total = expected || moneyValue(moneyFieldValue(order, ["totale", "importo", "prezzo", "amount"]));
  const paidTotal = paid + deposit;
  return {
    total: total || null,
    paid: paidTotal || paid || deposit || 0,
    deposit,
    missing: total ? Math.max(total - paidTotal, 0) : null,
  };
}

function orderSummary(order: any) {
  return answerById(order, "order_items") || fieldValue(order, ["cosa", "prodot", "material", "ordinare"]) || "";
}

function orderNotes(order: any) {
  const answers = order.answers && typeof order.answers === "object" ? order.answers : {};
  const fields = Array.isArray(order.form?.fields) ? order.form.fields : [];
  const noteMatcher = /(note|nota|comment|commento|descrizione|dettaglio|istruz|cosa dobbiamo fare|quante fasce|consegna)/i;
  const notes = [
    answerById(order, "order_notes"),
    answerById(order, "client_control_shopify_order_note"),
    fieldValue(order, ["note", "nota", "commento", "descrizione"]),
    typeof order.internal_notes === "string" ? order.internal_notes : "",
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  fields.forEach((field: any) => {
    const label = String(field.label ?? "");
    if (!noteMatcher.test(label)) return;
    const value = plainAnswer(answers[String(field.id ?? "")]);
    if (value) notes.push(`${label}: ${value}`);
  });

  Object.entries(answers).forEach(([key, value]) => {
    if (key.startsWith("__")) return;
    if (!noteMatcher.test(key)) return;
    const note = plainAnswer(value);
    if (note) notes.push(note);
  });

  if (order.internal_notes && typeof order.internal_notes === "object") {
    const note = plainAnswer(order.internal_notes);
    if (note) notes.push(note);
  }

  const commentNotes = Array.isArray(order.comments)
    ? order.comments
        .map((item: any) => plainAnswer(item?.message ?? item?.text ?? item?.comment ?? item?.note))
        .filter(Boolean)
    : [];

  const activityNotes = Array.isArray(order.activity_log)
    ? order.activity_log
        .map((item: any) => String(item?.note || item?.text || "").trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set([...notes, ...commentNotes, ...activityNotes])).join("\n");
}

function attachmentUrl(value: any) {
  if (!value || typeof value !== "object") return "";
  const driveUrl = String(value.url || value.driveFileUrl || value.webViewLink || value.webContentLink || value.photoUrl || value.previewUrl || "").trim();
  if (driveUrl) return driveUrl;
  if (typeof value.storagePath === "string" && value.storagePath.trim()) {
    return `/api/service-forms/responses/file?path=${encodeURIComponent(value.storagePath)}`;
  }
  return "";
}

function attachmentName(value: any, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  return String(value.name || value.originalName || value.fileName || value.title || fallback).trim();
}

function collectOrderAttachments(order: any) {
  const answers = order.answers && typeof order.answers === "object" ? order.answers : {};
  const fields = Array.isArray(order.form?.fields) ? order.form.fields : [];
  const labelById = new Map(fields.map((field: any) => [String(field.id ?? ""), String(field.label ?? field.id ?? "Allegato")]));
  const attachments: Array<{ label: string; name: string; url: string; previewUrl: string; type: string; isImage: boolean; previewable: boolean }> = [];
  const seen = new Set<string>();

  const addAttachment = (label: string, rawValue: any) => {
    const url = attachmentUrl(rawValue);
    if (!url || seen.has(url)) return;
    const name = attachmentName(rawValue, label || "Allegato");
    const type = String(rawValue?.type || rawValue?.mimeType || rawValue?.contentType || "");
    const previewUrl = String(rawValue?.previewUrl || rawValue?.thumbnailLink || "").trim();
    const imageName = /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);
    const browserImageName = /\.(png|jpe?g|webp|gif)$/i.test(name);
    const isImage = type.startsWith("image/") || imageName || Boolean(previewUrl);
    const previewable = type.startsWith("image/") || browserImageName || Boolean(previewUrl);
    seen.add(url);
    attachments.push({ label, name, url, previewUrl: previewUrl || url, type, isImage, previewable });
  };

  Object.entries(answers).forEach(([key, value]) => {
    if (key === "__pickup") return;
    const label = String(key === "__orderPhoto" ? "Foto ordine" : labelById.get(key) || key);
    if (Array.isArray(value)) {
      value.forEach((item, index) => addAttachment(`${label} ${index + 1}`, item));
      return;
    }
    addAttachment(label, value);
  });

  return attachments;
}

function orderStatusAudit(order: any) {
  const log = Array.isArray(order.activity_log) ? [...order.activity_log].reverse() : [];
  const statusEvent = log.find((item: any) => item?.to || item?.status || item?.type?.includes?.("STATUS"));
  return {
    changedAt: statusEvent?.at || order.updated_at,
    changedBy: statusEvent?.by || order.user?.name || "Staff",
    text: statusEvent?.text || "",
  };
}

function publicOrder(order: any) {
  const fields = Array.isArray(order.form?.fields)
    ? order.form.fields.map((field: any) => ({
        id: String(field.id ?? ""),
        label: String(field.label ?? field.id ?? ""),
        type: String(field.type ?? ""),
      }))
    : [];
  return {
    id: order.id,
    orderNumber: orderNumber(order),
    clientName: orderClientName(order),
    phone: orderPhone(order),
    salon: order.user_location_name ?? "",
    createdBy: order.user?.name ?? "Staff",
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    statusAudit: orderStatusAudit(order),
    summary: orderSummary(order),
    notes: orderNotes(order),
    payment: orderPaymentSummary(order),
    attachments: collectOrderAttachments(order),
    pickup: order.answers?.__pickup ?? null,
    answers: order.answers ?? {},
    fields,
  };
}

function orderSearchHaystack(order: any) {
  const answers = order.answers && typeof order.answers === "object" ? order.answers : {};
  return normalize([
    order.id,
    orderNumber(order),
    orderClientName(order),
    order.user_location_name ?? "",
    JSON.stringify(answers),
  ].join(" "));
}

function fileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName.slice(0, 10);
  const fromType = file.type.split("/")[1]?.toLowerCase().trim();
  if (fromType === "jpeg") return "jpg";
  return fromType?.replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
}

function isValidProof(file: FormDataEntryValue | null): file is File {
  if (!(file instanceof File)) return false;
  if (file.size <= 0 || file.size > MAX_PROOF_SIZE) return false;
  return file.type.startsWith("image/") || file.type === "application/pdf" || /\.(heic|heif|jpg|jpeg|png|webp|pdf)$/i.test(file.name);
}

function safeDriveSegment(value: unknown, fallback: string) {
  const cleaned = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

async function pcAuthorization(request: NextRequest) {
  const pcToken = request.cookies.get(appointmentsPcCookieName)?.value;
  return pcToken ? checkPCAuthorization(pcToken).catch(() => null) : null;
}

async function findSignerByOperationalUserOrPin(sessionUserId: string | undefined, pickupPin: string, locationId?: string | null) {
  if (sessionUserId && sessionUserId !== "PC_CASSA") {
    const signer = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, name: true, active: true },
    });
    return signer?.active ? signer : null;
  }

  if (!/^\d{4,6}$/.test(pickupPin)) return null;

  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      pin_hash: { not: null },
      ...(locationId ? { sede_id: locationId } : {}),
    },
    select: { id: true, name: true, pin_hash: true, active: true },
  });

  for (const candidate of candidates) {
    if (candidate.pin_hash && await bcrypt.compare(pickupPin, candidate.pin_hash)) {
      return candidate;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Sessione scaduta. Effettua di nuovo il login." }, { status: 401 });
  }

  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    if (query) {
      const normalizedQuery = normalize(query);
      const candidates = await prisma.serviceFormResponse.findMany({
        where: {
          form: {
            OR: [
              { category: { contains: ORDER_FORM_CATEGORY, mode: "insensitive" } },
              { name: { contains: "ordine", mode: "insensitive" } },
            ],
          },
          status: { in: ["READY", "ORDERED", "PREPARING", "NEW", "COMPLETED", "ARCHIVED"] },
        },
        include: {
          user: true,
          form: true,
        },
        orderBy: { updated_at: "desc" },
        take: 500,
      });

      const match = candidates.find((order) => orderSearchHaystack(order).includes(normalizedQuery));
      if (!match) return NextResponse.json({ found: false });

      return NextResponse.json({
        found: true,
        ready: match.status === "READY",
        status: match.status,
        statusLabel: STATUS_LABELS[match.status] ?? match.status,
        order: publicOrder(match),
      });
    }

    const orders = await prisma.serviceFormResponse.findMany({
      where: {
        form: {
          OR: [
            { category: { contains: ORDER_FORM_CATEGORY, mode: "insensitive" } },
            { name: { contains: "ordine", mode: "insensitive" } },
          ],
        },
        status: "READY",
      },
      include: {
        user: true,
        form: true,
      },
      orderBy: { updated_at: "desc" },
      take: 200,
    });

    return NextResponse.json({ items: orders.map(publicOrder) });
  } catch (error) {
    console.error("Ready pickup orders failed:", error);
    return NextResponse.json({ error: "Errore durante il caricamento degli ordini pronti." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const operationalUser = await getOperationalUser(request);
  const pcAuth = operationalUser?.isPC ? await pcAuthorization(request) : null;
  if (!operationalUser?.id) {
    return NextResponse.json({ error: "Sessione scaduta. Effettua di nuovo il login." }, { status: 401 });
  }

  try {
    const data = await request.formData();
    const query = String(data.get("query") ?? "").trim();
    const pickupName = String(data.get("pickupName") ?? "").trim();
    const pickupPin = String(data.get("pickupPin") ?? "").trim();
    const paidConfirmed = String(data.get("paidConfirmed") ?? "") === "true";
    const proof = data.get("proof");

    if (!query) {
      return NextResponse.json({ error: "Inserisci numero ordine, nome cliente o telefono." }, { status: 400 });
    }
    if (!pickupName) {
      return NextResponse.json({ error: "Inserisci il nome di chi ritira." }, { status: 400 });
    }
    if (!paidConfirmed) {
      return NextResponse.json({ error: "Conferma prima che il saldo sia completo." }, { status: 400 });
    }
    if (proof && !isValidProof(proof)) {
      return NextResponse.json({ error: "La prova caricata deve essere una foto o PDF fino a 12 MB." }, { status: 400 });
    }

    const signer = await findSignerByOperationalUserOrPin(operationalUser.id, pickupPin, pcAuth?.locationId || operationalUser.sedeId);
    if (!signer) {
      return NextResponse.json({ error: "Profilo non valido. Torna alla selezione profilo e accedi di nuovo." }, { status: 403 });
    }

    const normalizedQuery = normalize(query);
    const candidates = await prisma.serviceFormResponse.findMany({
      where: {
        form: {
          OR: [
            { category: { contains: ORDER_FORM_CATEGORY, mode: "insensitive" } },
            { name: { contains: "ordine", mode: "insensitive" } },
          ],
        },
        status: { in: ["READY", "ORDERED", "PREPARING", "NEW", "COMPLETED"] },
      },
      include: {
        user: true,
        form: true,
      },
      orderBy: { updated_at: "desc" },
      take: 500,
    });

    const match = candidates.find((order) => orderSearchHaystack(order).includes(normalizedQuery));
    if (!match) {
      return NextResponse.json({ error: "Ordine non trovato. Controlla numero, nome o telefono." }, { status: 404 });
    }

    if (match.status !== "READY") {
      return NextResponse.json(
        { error: `Ordine trovato ma non e in Arrivato / pronto. Stato attuale: ${STATUS_LABELS[match.status] ?? match.status}.` },
        { status: 409 }
      );
    }

    const now = new Date();
    const cleanOrder = safeDriveSegment(orderNumber(match), "SENZA-ORDINE");
    let proofData = null;
    if (proof instanceof File && proof.size > 0) {
      const buffer = Buffer.from(await proof.arrayBuffer());
      const extension = fileExtension(proof);
      const mimeType = proof.type || (extension === "heic" ? "image/heic" : extension === "heif" ? "image/heif" : "application/octet-stream");
      const cleanPickupName = safeDriveSegment(pickupName, "cliente");
      const fileName = `${cleanOrder}-RITIRO-${cleanPickupName}-${now.toISOString().replace(/[:.]/g, "-")}.${extension}`;
      const driveFile = await uploadFotoOrdineToGoogleDrive(buffer, fileName, mimeType, cleanOrder).catch((error) => {
        console.error("Pickup proof upload failed:", error);
        throw new Error("Ritiro non salvato: la prova caricata non e stata accettata da Google Drive. Riprova senza foto oppure carica una foto/PDF con nome semplice.");
      });
      proofData = {
        driveFileId: driveFile.id,
        driveFileUrl: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
        webViewLink: driveFile.webViewLink,
        webContentLink: driveFile.webContentLink,
        name: driveFile.name ?? fileName,
        originalName: proof.name,
        type: mimeType,
      };
    }

    const currentAnswers =
      match.answers && typeof match.answers === "object" && !Array.isArray(match.answers)
        ? (match.answers as Record<string, any>)
        : {};
    const currentLog = Array.isArray(match.activity_log) ? (match.activity_log as any[]) : [];
    const pickup = {
      pickupName,
      paidConfirmed: true,
      payment: orderPaymentSummary(match),
      completedById: signer.id,
      completedByName: signer.name || "Staff",
      completedAt: now.toISOString(),
      signature: {
        method: "PIN",
        signedById: signer.id,
        signedByName: signer.name || "Staff",
        signedAt: now.toISOString(),
      },
      proof: proofData,
    };

    const updated = await prisma.serviceFormResponse.update({
      where: { id: match.id },
      data: {
        status: "COMPLETED",
        answers: {
          ...currentAnswers,
          __pickup: pickup,
        },
        activity_log: [
          ...currentLog,
          {
            type: "ORDER_PICKUP_COMPLETED",
            from: match.status,
            to: "COMPLETED",
            by: signer.name || session?.user?.name || "Staff",
            at: now.toISOString(),
            text: `${pickupName} ha ritirato l'ordine. Saldo confermato${proofData ? " e prova caricata" : ""}.`,
          },
        ],
      },
      include: {
        user: true,
        form: true,
      },
    });

    return NextResponse.json({
      ok: true,
      order: updated,
      pickup,
      message: `Ritiro completato per ${orderClientName(updated)}.`,
    });
  } catch (error) {
    console.error("Order pickup failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore durante il ritiro ordine." }, { status: 500 });
  }
}
