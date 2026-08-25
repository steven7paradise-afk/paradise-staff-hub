import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedDocumentUrl } from "@/lib/supabase-storage";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const taskId = params.get("taskId")?.trim() ?? "";
  const path = params.get("path")?.trim() ?? "";
  if (!taskId || !path.startsWith(`task-attachments/${taskId}/`)) {
    return NextResponse.json({ error: "Allegato non valido." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const isAssignee = task.assignees.some((assignee) => assignee.id === session.user.id);
  const canOpen = managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id;
  if (!canOpen || (session.user.role === "RESPONSABILE" && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Allegato non disponibile." }, { status: 403 });
  }

  try {
    return NextResponse.redirect(await signedDocumentUrl(path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Allegato non disponibile." }, { status: 503 });
  }
}
