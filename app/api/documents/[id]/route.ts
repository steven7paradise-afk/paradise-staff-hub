import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePrivateDocument } from "@/lib/supabase-storage";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const editableTypes = new Set(["CONTRATTO", "RINNOVO", "PROROGA", "BUSTA_PAGA", "CUD", "DOCUMENTO"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const title = String(payload?.title ?? "").trim();
  const type = String(payload?.type ?? "").trim().toUpperCase();
  const monthValue = Number(payload?.month ?? 0);
  const yearValue = Number(payload?.year ?? 0);
  const dateValue = String(payload?.documentDate ?? "").trim();
  const documentDate = dateValue ? new Date(`${dateValue}T12:00:00`) : null;

  if (!title || !editableTypes.has(type)) {
    return NextResponse.json({ error: "Inserisci un titolo e un tipo documento valido." }, { status: 400 });
  }
  if (documentDate && Number.isNaN(documentDate.getTime())) {
    return NextResponse.json({ error: "Data documento non valida." }, { status: 400 });
  }

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });

  const document = await prisma.document.update({
    where: { id },
    data: {
      title,
      type,
      month: payload?.month === undefined ? existing.month : monthValue >= 1 && monthValue <= 12 ? monthValue : null,
      year: payload?.year === undefined ? existing.year : yearValue >= 2000 && yearValue <= 2100 ? yearValue : null,
      document_date: payload?.documentDate === undefined ? existing.document_date : documentDate,
    },
  });
  return NextResponse.json(document);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
    }

    // Delete from storage if it is a storage path
    if (document.storage_path) {
      await deletePrivateDocument(document.storage_path).catch((err) => {
        console.error("Failed to delete document from Supabase storage:", err);
      });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: error.message || "Errore durante l'eliminazione." }, { status: 500 });
  }
}
