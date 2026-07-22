import { PrismaClient } from "@prisma/client";
import { signedDocumentUrl } from "../lib/supabase-storage";
import { uploadEmployeeDocumentToGoogleDrive } from "../lib/google-drive";

const prisma = new PrismaClient();

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
  if (!response.ok) {
    throw new Error(`Download fallito (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { storage_path: { not: null } },
        { file_url: { not: "" } },
      ],
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { created_at: "asc" },
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const document of documents) {
    if (!document.storage_path && isGoogleDriveUrl(document.file_url)) {
      skipped += 1;
      continue;
    }

    try {
      const url = await getDocumentUrl(document);
      if (!url) {
        skipped += 1;
        continue;
      }

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
      console.log(`Migrato: ${document.user.name} -> ${fileName}`);
    } catch (error) {
      failed += 1;
      console.error(`Errore su documento ${document.id} (${document.title}):`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Migrazione completata. Migrati: ${migrated}. Gia su Drive/saltati: ${skipped}. Errori: ${failed}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
