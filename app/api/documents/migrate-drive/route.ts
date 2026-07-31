import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedDocumentUrl } from "@/lib/supabase-storage";
import { uploadEmployeeDocumentToGoogleDrive } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function isGoogleDriveUrl(value: string | null | undefined) {
  return Boolean(value && /drive\.google\.com|googleusercontent\.com/i.test(value));
}

function extensionFromPath(value: string | null | undefined) {
  const clean = (value || "").split("?")[0];
  const extension = clean.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,8}$/.test(extension)) return extension;
  return "pdf";
}

function mimeFromExtension(extension: string) {
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function cleanFileNamePart(value: string) {
  return value
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFileName(document: {
  title: string;
  type: string;
  month: number | null;
  year: number | null;
  storage_path: string | null;
  file_url: string;
}) {
  const extension = extensionFromPath(document.storage_path || document.file_url);
  const month = document.month ? String(document.month).padStart(2, "0") : "";
  const year = document.year ? String(document.year) : "";
  const period = [month, year].filter(Boolean).join("-");
  const base = cleanFileNamePart(document.title || document.type || "Documento");
  return `${base}${period ? `-${period}` : ""}.${extension}`;
}

async function getDocumentUrl(document: { storage_path: string | null; file_url: string }) {
  if (document.storage_path) return signedDocumentUrl(document.storage_path);
  if (document.file_url) return document.file_url;
  return "";
}

async function downloadBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download fallito (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managerRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.min(10, Math.max(1, Number(body.batchSize ?? 5) || 5));

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { storage_path: { not: null } },
        { file_url: { not: "" } },
      ],
    },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: "asc" },
    take: 100,
  });

  const candidates = documents
    .filter((document) => document.storage_path || !isGoogleDriveUrl(document.file_url))
    .slice(0, batchSize);

  let migrated = 0;
  const errors: string[] = [];

  for (const document of candidates) {
    try {
      const url = await getDocumentUrl(document);
      if (!url) continue;

      const fileName = buildFileName(document);
      const extension = extensionFromPath(fileName);
      const buffer = await downloadBuffer(url);
      const driveFile = await uploadEmployeeDocumentToGoogleDrive(
        buffer,
        fileName,
        mimeFromExtension(extension),
        document.user.name
      );

      await prisma.document.update({
        where: { id: document.id },
        data: {
          file_url: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
          storage_path: null,
        },
      });

      migrated += 1;
    } catch (error) {
      errors.push(`${document.title}: ${error instanceof Error ? error.message : "Errore sconosciuto"}`);
    }
  }

  const remaining = await prisma.document.count({
    where: { storage_path: { not: null } },
  });

  return NextResponse.json({
    ok: true,
    migrated,
    remaining,
    done: remaining === 0 || candidates.length === 0,
    errors,
  });
}
