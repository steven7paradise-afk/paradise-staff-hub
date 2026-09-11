import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadOrderPhotoToGoogleDrive } from "@/lib/google-drive";
import { getOperationalUser } from "@/lib/operational-session";

const ORDER_PHOTO_KEY = "__orderPhoto";
const ORDER_PRODUCT_PHOTOS_KEY = "__orderProductPhotos";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const PRODUCT_PHOTO_SLOTS = 2;

type RouteParams = { params: Promise<{ id: string }> };
type OrderField = { id: string; label?: string | null };
type OrderForPhoto = {
  id: string;
  answers: unknown;
  form?: { fields?: unknown } | null;
};

function answersRecord(order: OrderForPhoto) {
  return order.answers && typeof order.answers === "object" && !Array.isArray(order.answers)
    ? (order.answers as Record<string, unknown>)
    : {};
}

function formFields(order: OrderForPhoto): OrderField[] {
  return Array.isArray(order.form?.fields) ? (order.form.fields as OrderField[]) : [];
}

function answerById(order: OrderForPhoto, id: string) {
  const value = answersRecord(order)[id];
  return typeof value === "string" ? value.trim() : "";
}

function fieldValue(order: OrderForPhoto, includes: string[]) {
  const fields = formFields(order);
  const match = fields.find((field) => {
    const label = (field.label || "").toLowerCase();
    return includes.some((item) => label.includes(item));
  });
  const value = match ? answersRecord(order)[match.id] : "";
  return typeof value === "string" ? value.trim() : "";
}

function orderClientName(order: OrderForPhoto) {
  return (
    answerById(order, "order_client_name") ||
    answerById(order, "field_1782212649889") ||
    answerById(order, "client_name") ||
    fieldValue(order, ["nome cliente", "cliente", "nome e cognome", "nome"]) ||
    "Cliente"
  );
}

function orderNumber(order: OrderForPhoto) {
  return (
    answerById(order, "order_shopify_order") ||
    answerById(order, "field_1782221517924") ||
    answerById(order, "order_title") ||
    fieldValue(order, ["numero ordine", "ordine shopify", "codice ordine", "ordine"]) ||
    order.id.slice(0, 8)
  );
}

function cleanFilePart(value: string) {
  return value
    .trim()
    .replace(/^#/, "")
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
}

function fileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const fromType = file.type.split("/").pop();
  return fromType || "jpg";
}

function uploadErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Errore durante il caricamento della foto.";
  const details = error as Error & { code?: number; status?: number; errors?: Array<{ reason?: string; message?: string }> };
  const code = details.code || details.status;
  const reason = details.errors?.[0]?.reason || "";

  if (error.message.includes("Google credentials are not configured")) {
    return "Google Drive non configurato: controlla le credenziali Drive in Coolify.";
  }

  if (code === 403 || reason.includes("insufficient") || reason.includes("forbidden")) {
    return "La cartella Google Drive non è accessibile: condividila con la service account configurata in Coolify.";
  }

  if (code === 404 || reason.includes("notFound")) {
    return "Cartella Google Drive non trovata: controlla l'ID della cartella ordini.";
  }

  return "Errore durante il caricamento su Google Drive. Controlla i log di Coolify per il dettaglio.";
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, answers: true, activity_log: true, form: { select: { fields: true } } },
    });

    if (!response) {
      return NextResponse.json({ error: "Ordine non trovato" }, { status: 404 });
    }

    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Carica un'immagine valida fino a 10 MB." }, { status: 400 });
    }

    const clientName = orderClientName(response);
    const number = orderNumber(response);
    const cleanNumber = cleanFilePart(number) || "SENZA-ORDINE";
    const cleanClient = cleanFilePart(clientName) || "CLIENTE";
    const uploadStamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeFileName = `${cleanNumber}-${cleanClient}-${uploadStamp}.${fileExtension(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadOrderPhotoToGoogleDrive(buffer, safeFileName, file.type, clientName, number);
    const currentAnswers = answersRecord(response);

    const photo = {
      id: driveFile.id,
      url: `/api/drive-image?id=${encodeURIComponent(driveFile.id)}`,
      previewUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile.id)}&sz=w1200`,
      driveFileId: driveFile.id,
      driveFileUrl: driveFile.webViewLink,
      name: driveFile.name || safeFileName,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name || "Staff",
      stage: String(data.get("stage") || "NEW"),
    };

    const requestedSlot = Number(data.get("slot"));
    const slot = Number.isInteger(requestedSlot) && requestedSlot >= 0 && requestedSlot < PRODUCT_PHOTO_SLOTS ? requestedSlot : 0;
    const legacyPhoto = currentAnswers[ORDER_PHOTO_KEY];
    const existingPhotos = Array.isArray(currentAnswers[ORDER_PRODUCT_PHOTOS_KEY])
      ? (currentAnswers[ORDER_PRODUCT_PHOTOS_KEY] as unknown[]).slice(0, PRODUCT_PHOTO_SLOTS)
      : [];
    while (existingPhotos.length < PRODUCT_PHOTO_SLOTS) existingPhotos.push(null);
    if (!existingPhotos[0] && legacyPhoto && typeof legacyPhoto === "object") existingPhotos[0] = legacyPhoto;
    const nextPhotos = [...existingPhotos];
    nextPhotos[slot] = photo;
    const currentLog = Array.isArray(response.activity_log) ? (response.activity_log as unknown[]) : [];
    const photoLogEntry = {
      type: "PHOTO_ADDED",
      action: `Foto prodotto ${slot + 1} aggiunta`,
      photoId: photo.id,
      photoSlot: slot,
      stage: photo.stage,
      by: photo.uploadedBy,
      at: photo.uploadedAt,
    };

    const updated = await prisma.serviceFormResponse.update({
      where: { id },
      data: {
        answers: {
          ...currentAnswers,
          [ORDER_PHOTO_KEY]: nextPhotos[0] || photo,
          [ORDER_PRODUCT_PHOTOS_KEY]: nextPhotos,
        } as Prisma.InputJsonValue,
        activity_log: [...currentLog, photoLogEntry] as Prisma.InputJsonValue,
      },
      include: {
        user: true,
        form: true,
      },
    });

    return NextResponse.json({ photo, photos: nextPhotos, order: updated });
  } catch (error) {
    console.error("Failed to upload order image:", error);
    return NextResponse.json({ error: uploadErrorMessage(error) }, { status: 500 });
  }
}
