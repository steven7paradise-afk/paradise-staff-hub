import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { uploadEmployeeDocumentToGoogleDrive } from "@/lib/google-drive";
import { isDocumentType } from "@/lib/document-types";

const uploadRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !uploadRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.formData();
  const file = data.get("file");
  const userId = String(data.get("userId") ?? "");
  const title = String(data.get("title") ?? "").trim();
  const type = String(data.get("type") ?? "DOCUMENTO").trim().toUpperCase();
  const notes = String(data.get("notes") ?? "").trim();
  const month = Number(data.get("month") ?? 0) || null;
  const year = Number(data.get("year") ?? 0) || null;
  const documentDateValue = String(data.get("documentDate") ?? "").trim();
  const documentDate = documentDateValue ? new Date(`${documentDateValue}T12:00:00`) : null;
  const extension = file instanceof File ? file.name.split(".").pop()?.toLowerCase() : "";
  const acceptedExtensions = new Set(["pdf", "png", "jpg", "jpeg"]);
  if (!(file instanceof File) || !userId || !title || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Inserisci dipendente, titolo e file fino a 15 MB." }, { status: 400 });
  }
  if (!extension || !acceptedExtensions.has(extension)) {
    return NextResponse.json({ error: "Carica un file PDF, PNG o JPG." }, { status: 400 });
  }
  if (!isDocumentType(type)) {
    return NextResponse.json({ error: "Tipo documento non valido." }, { status: 400 });
  }
  if (notes.length > 2000) {
    return NextResponse.json({ error: "Le note non possono superare 2000 caratteri." }, { status: 400 });
  }
  if (documentDate && Number.isNaN(documentDate.getTime())) {
    return NextResponse.json({ error: "Data documento non valida." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ error: "Dipendente non trovato." }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeTitle = title.replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const suffix = [month ? String(month).padStart(2, "0") : "", year ?? ""].filter(Boolean).join("-");
    const fileName = `${safeTitle}${suffix ? `-${suffix}` : ""}.${extension}`;
    const driveFile = await uploadEmployeeDocumentToGoogleDrive(
      buffer,
      fileName,
      file.type || "application/pdf",
      user.name
    );
    const document = await prisma.document.create({
      data: {
        user_id: userId,
        title,
        type,
        month,
        year,
        document_date: documentDate && !Number.isNaN(documentDate.getTime()) ? documentDate : null,
        notes: notes || null,
        uploaded_by: session.user.id,
        file_url: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
        storage_path: null,
      },
    });
    await createNotification({ user_id: userId, title: "Nuovo documento disponibile", message: `${title} e disponibile nella sezione Documenti.`, type: "DOCUMENTO", action_url: "/documents", read: false });
    return NextResponse.json(document);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caricamento non riuscito." }, { status: 503 });
  }
}
