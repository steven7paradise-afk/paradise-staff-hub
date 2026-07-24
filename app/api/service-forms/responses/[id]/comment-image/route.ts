import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadOrderPhotoToGoogleDrive } from "@/lib/google-drive";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type RouteParams = { params: Promise<{ id: string }> };
type ResponseField = { id: string; label?: string | null };
type ResponseForUpload = {
  id: string;
  answers: unknown;
  form?: { fields?: unknown } | null;
};

function answersRecord(response: ResponseForUpload) {
  return response.answers && typeof response.answers === "object" && !Array.isArray(response.answers)
    ? (response.answers as Record<string, unknown>)
    : {};
}

function formFields(response: ResponseForUpload): ResponseField[] {
  return Array.isArray(response.form?.fields) ? (response.form.fields as ResponseField[]) : [];
}

function answerById(response: ResponseForUpload, id: string) {
  const value = answersRecord(response)[id];
  return typeof value === "string" ? value.trim() : "";
}

function fieldValue(response: ResponseForUpload, includes: string[]) {
  const match = formFields(response).find((field) => {
    const label = (field.label || "").toLowerCase();
    return includes.some((item) => label.includes(item));
  });
  const value = match ? answersRecord(response)[match.id] : "";
  return typeof value === "string" ? value.trim() : "";
}

function clientName(response: ResponseForUpload) {
  return (
    answerById(response, "client_name") ||
    fieldValue(response, ["nome cliente", "cliente", "nome e cognome", "nome"]) ||
    "Cliente"
  );
}

function orderNumber(response: ResponseForUpload) {
  return (
    answerById(response, "order_title") ||
    fieldValue(response, ["numero ordine", "ordine shopify", "codice ordine", "ordine"]) ||
    response.id.slice(0, 8)
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
  if (!(error instanceof Error)) return "Errore durante il caricamento dell'immagine.";
  const details = error as Error & { code?: number; status?: number; errors?: Array<{ reason?: string }> };
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
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Carica un'immagine valida fino a 10 MB." }, { status: 400 });
    }

    const name = clientName(response);
    const number = orderNumber(response);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${cleanFilePart(number) || "SENZA-ORDINE"}-${cleanFilePart(name) || "CLIENTE"}-commento-${timestamp}.${fileExtension(file)}`;
    const driveFile = await uploadOrderPhotoToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      fileName,
      file.type,
      name,
      number
    );

    return NextResponse.json({
      url: `/api/drive-image?id=${encodeURIComponent(driveFile.id)}`,
      previewUrl: driveFile.thumbnailLink || `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile.id)}&sz=w1200`,
      driveFileId: driveFile.id,
      driveFileUrl: driveFile.webViewLink,
      name: driveFile.name || fileName,
    });
  } catch (error) {
    console.error("Failed to upload response comment image:", error);
    return NextResponse.json({ error: uploadErrorMessage(error) }, { status: 500 });
  }
}
