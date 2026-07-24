import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadOrderPhotoToGoogleDrive } from "@/lib/google-drive";

const ORDER_PHOTO_KEY = "__orderPhoto";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

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
    answerById(order, "client_name") ||
    fieldValue(order, ["nome cliente", "cliente", "nome e cognome", "nome"]) ||
    "Cliente"
  );
}

function orderNumber(order: OrderForPhoto) {
  return (
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, answers: true, form: { select: { fields: true } } },
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
    const safeFileName = `${cleanNumber}-${cleanClient}.${fileExtension(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadOrderPhotoToGoogleDrive(buffer, safeFileName, file.type, clientName, number);
    const currentAnswers = answersRecord(response);

    const photo = {
      url: `/api/drive-image?id=${encodeURIComponent(driveFile.id)}`,
      driveFileId: driveFile.id,
      driveFileUrl: driveFile.webViewLink,
      name: driveFile.name || safeFileName,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user.name || "Staff",
    };

    const updated = await prisma.serviceFormResponse.update({
      where: { id },
      data: {
        answers: {
          ...currentAnswers,
          [ORDER_PHOTO_KEY]: photo,
        },
      },
      include: {
        user: true,
        form: true,
      },
    });

    return NextResponse.json({ photo, order: updated });
  } catch (error) {
    console.error("Failed to upload order image:", error);
    return NextResponse.json({ error: "Errore durante il caricamento della foto." }, { status: 500 });
  }
}
