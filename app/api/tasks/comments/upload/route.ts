import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadTaskImageToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function safeFilePart(value: string) {
  return String(value || "allegato-task")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "") || "allegato-task";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const form = await request.formData();
  const taskId = String(form.get("taskId") ?? "").trim();
  const file = form.get("file");
  if (!taskId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Seleziona un file valido." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Il file supera il limite di 5 MB." }, { status: 413 });
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
    const stored = await uploadTaskImageToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      `${new Date().toISOString().slice(0, 10)}-${taskId}-${safeFilePart(file.name)}`,
      mimeType,
    );
    const isImage = mimeType.startsWith("image/");
    return NextResponse.json({
      name: stored.name || file.name,
      url: isImage ? stored.previewUrl : (stored.webViewLink || stored.webContentLink || stored.previewUrl),
      previewUrl: isImage ? stored.previewUrl : null,
      driveFileId: stored.id,
      driveFileUrl: stored.webViewLink,
      webContentLink: stored.webContentLink,
      type: mimeType,
    });
  } catch (error) {
    console.error("Task attachment upload failed:", error);
    return NextResponse.json({ error: "Caricamento non riuscito. Riprova tra poco." }, { status: 503 });
  }
}
