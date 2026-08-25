import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadTaskImageToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function safeFilePart(value: string) {
  return String(value || "file")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "") || "file";
}

function taskFileName(name: string, taskId: string) {
  const cleanName = safeFilePart(name).slice(-100);
  return `${new Date().toISOString().slice(0, 10)}-${safeFilePart(taskId).slice(0, 36)}-${cleanName}`;
}

function driveErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || "");
  if (/credentials|private key|service account/i.test(detail)) {
    return "Google Drive non configurato sul server. Controlla le credenziali Drive in Coolify.";
  }
  if (/permission|forbidden|insufficient|not found|404|403/i.test(detail)) {
    return "Google Drive non permette di usare la cartella Task. Condividila con la service account configurata.";
  }
  return detail ? `Google Drive ha rifiutato il file: ${detail}` : "Caricamento su Google Drive non riuscito.";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const taskId = String(formData?.get("taskId") ?? "").trim();
  const file = formData?.get("file");
  if (!taskId || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Dati del file non validi." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Il file supera il limite di 50 MB." }, { status: 413 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const isAssignee = task.assignees.some((assignee) => assignee.id === session.user.id);
  const canUpload = managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id;
  if (!canUpload || (session.user.role === "RESPONSABILE" && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Non puoi allegare file a questa task." }, { status: 403 });
  }

  try {
    const mimeType = file.type || "application/octet-stream";
    const driveFile = await uploadTaskImageToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      taskFileName(file.name, taskId),
      mimeType
    );
    const isImage = mimeType.startsWith("image/");
    const driveFileUrl = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
    return NextResponse.json({
      name: driveFile.name || file.name,
      url: isImage ? driveFile.previewUrl : driveFileUrl,
      previewUrl: isImage ? driveFile.previewUrl : null,
      driveFileId: driveFile.id,
      driveFileUrl,
      webContentLink: driveFile.webContentLink,
      type: mimeType,
    });
  } catch (error) {
    console.error("Task attachment Google Drive upload failed:", error);
    return NextResponse.json({ error: driveErrorMessage(error) }, { status: 503 });
  }
}
