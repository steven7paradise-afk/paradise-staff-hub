import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFotoOrdineToGoogleDrive } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

const FOTO_FORM_NAME = "Foto Ordini";
const FOTO_FORM_CATEGORY = "Foto";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

async function ensureFotoForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: FOTO_FORM_NAME },
        { category: FOTO_FORM_CATEGORY },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    if (existing.active) {
      return prisma.serviceForm.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }
    return existing;
  }

  return prisma.serviceForm.create({
    data: {
      name: FOTO_FORM_NAME,
      description: "Modulo tecnico nascosto per caricamento rapido foto ordini con Google Drive.",
      category: FOTO_FORM_CATEGORY,
      icon: "Camera",
      active: false,
      allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"],
      notify_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      created_by_id: createdById ?? null,
      fields: [
        { id: "orderNumber", label: "Numero ordine", type: "text", required: true },
        { id: "photo", label: "Foto", type: "file", required: true },
        { id: "uploadedBy", label: "Caricata da", type: "worker", required: true },
      ],
    },
  });
}

function cleanOrderNumber(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/^#/, "")
    .replace(/[^\w.-]/g, "")
    .trim();
}

function fileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().trim();
  if (fromName && ACCEPTED_EXTENSIONS.has(fromName)) return fromName;
  const fromType = file.type.split("/")[1]?.toLowerCase().trim();
  if (fromType === "heic" || fromType === "heif") return fromType;
  if (fromType === "jpeg") return "jpg";
  if (fromType && ACCEPTED_EXTENSIONS.has(fromType)) return fromType;
  return "";
}

function isAcceptedImage(file: File) {
  const extension = fileExtension(file);
  return file.size <= MAX_IMAGE_SIZE && Boolean(extension) && (file.type.startsWith("image/") || extension === "heic" || extension === "heif");
}

export async function GET() {
  const form = await ensureFotoForm();
  const rows = await prisma.serviceFormResponse.findMany({
    where: { form_id: form.id },
    orderBy: { created_at: "desc" },
    take: 40,
    include: { user: { select: { id: true, name: true, photo_url: true } } },
  });

  return NextResponse.json({
    items: rows.map((row) => {
      const answers = row.answers as Record<string, any>;
      return {
        id: row.id,
        orderNumber: answers.orderNumber ?? "",
        uploadedBy: answers.uploadedByName ?? row.user.name,
        uploadedByPhoto: row.user.photo_url,
        driveUrl: answers.photo?.driveFileUrl ?? answers.photo?.webViewLink ?? "",
        fileName: answers.photo?.name ?? "",
        slot: Number(answers.slot ?? answers.photo?.slot ?? 0) || undefined,
        slotLabel: answers.slotLabel ?? answers.photo?.slotLabel ?? "",
        createdAt: row.created_at.toISOString(),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sessione scaduta. Effettua di nuovo il login." }, { status: 401 });
    }

    const data = await request.formData();
    const orderNumber = cleanOrderNumber(data.get("orderNumber"));
    const slot = Math.min(4, Math.max(1, Number(data.get("slot") ?? 1) || 1));
    const slotLabel = String(data.get("slotLabel") ?? `Foto ${slot}`).trim();
    const file = data.get("file");

    if (!orderNumber) {
      return NextResponse.json({ error: "Inserisci il numero ordine." }, { status: 400 });
    }

    if (!(file instanceof File) || !isAcceptedImage(file)) {
      return NextResponse.json({ error: "Carica una foto valida JPG, PNG, WEBP, HEIC o HEIF fino a 10 MB." }, { status: 400 });
    }

    const worker = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!worker) {
      return NextResponse.json({ error: "Utente non trovato." }, { status: 401 });
    }
    if (!worker.active) {
      return NextResponse.json({ error: "Utente non attivo." }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = fileExtension(file);
    const mimeType = file.type || (extension === "heic" ? "image/heic" : extension === "heif" ? "image/heif" : "application/octet-stream");
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const cleanSlotLabel = slotLabel.toUpperCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
    const fileName = `${orderNumber}-${cleanSlotLabel}-${worker.name.replace(/[^\w]+/g, "-")}-${timestamp}.${extension}`;
    const driveFile = await uploadFotoOrdineToGoogleDrive(buffer, fileName, mimeType, orderNumber);
    const form = await ensureFotoForm(worker.id);

    const response = await prisma.serviceFormResponse.create({
      data: {
        form_id: form.id,
        user_id: worker.id,
        user_role: worker.role,
        answers: {
          orderNumber,
          slot,
          slotLabel,
          uploadedById: worker.id,
          uploadedByName: worker.name,
          photo: {
            driveFileId: driveFile.id,
            driveFileUrl: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
            webViewLink: driveFile.webViewLink,
            webContentLink: driveFile.webContentLink,
            name: driveFile.name ?? fileName,
            type: mimeType,
            originalName: file.name,
            slot,
            slotLabel,
            uploadedAt: now.toISOString(),
          },
        },
        status: "NEW",
        priority: "MEDIA",
        activity_log: [
          {
            type: "FOTO_ORDINE_UPLOADED",
            text: `${worker.name} ha caricato una foto per ordine ${orderNumber}.`,
            at: now.toISOString(),
          },
        ],
      },
      include: { user: { select: { name: true, photo_url: true } } },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: response.id,
        orderNumber,
        uploadedBy: worker.name,
        uploadedByPhoto: response.user.photo_url,
        driveUrl: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
        fileName: driveFile.name ?? fileName,
        slot,
        slotLabel,
        createdAt: response.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Foto upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caricamento foto non riuscito." }, { status: 500 });
  }
}
