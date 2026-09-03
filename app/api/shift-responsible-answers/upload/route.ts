import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import { prisma } from "@/lib/prisma";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function safePart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const day = typeof form?.get("day") === "string" ? String(form.get("day")) : "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  if (day !== today) return NextResponse.json({ error: "Caricamento disponibile soltanto per il turno di oggi" }, { status: 400 });
  const [accessSetting, assignmentSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
  ]);
  const dayAccess = normalizeShiftResponsibleAccess(accessSetting?.value)[day] ?? emptyShiftAccessDay();
  const selectedResponsibleId = normalizeShiftResponsibleAssignments(assignmentSetting?.value)[day];
  if (!hasShiftWriteAccess(dayAccess, session.user.id, selectedResponsibleId)) return NextResponse.json({ error: "Attiva la presa visione e ottieni il permesso prima di caricare file" }, { status: 403 });
  const candidate = form?.get("file");
  if (!candidate || typeof candidate === "string") return NextResponse.json({ error: "Seleziona un file" }, { status: 400 });
  const file = candidate as File;
  if (!file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Il file deve essere inferiore a 20 MB" }, { status: 413 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = `turno-${safePart(session.user.id)}-${Date.now()}-${safePart(file.name)}`;
    const uploaded = await uploadFileToGoogleDrive(buffer, name, file.type || "application/octet-stream");
    const url = uploaded.webViewLink || uploaded.webContentLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
    return NextResponse.json({ name: file.name, url, driveFileId: uploaded.id, type: file.type || "application/octet-stream" });
  } catch (error) {
    console.error("Shift questionnaire upload failed", error);
    return NextResponse.json({ error: "Caricamento su Google Drive non riuscito" }, { status: 503 });
  }
}
