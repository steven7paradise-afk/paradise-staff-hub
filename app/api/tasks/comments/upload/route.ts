import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedTaskAttachmentUpload } from "@/lib/supabase-storage";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const taskId = String(body?.taskId ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim();
  const fileSize = Number(body?.fileSize ?? 0);
  const fileType = String(body?.fileType ?? "application/octet-stream");
  if (!taskId || !fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "Dati del file non validi." }, { status: 400 });
  }
  if (fileSize > MAX_FILE_BYTES) {
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
    const upload = await createSignedTaskAttachmentUpload(session.user.id, taskId, fileName);
    return NextResponse.json({
      ...upload,
      fileType,
      fileUrl: `/api/tasks/comments/files?taskId=${encodeURIComponent(taskId)}&path=${encodeURIComponent(upload.path)}`,
    });
  } catch (error) {
    console.error("Task attachment upload failed:", error);
    return NextResponse.json({ error: "Caricamento non riuscito. Riprova tra poco." }, { status: 503 });
  }
}
