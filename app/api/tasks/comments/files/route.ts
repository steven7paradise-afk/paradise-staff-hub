import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedDocumentUrl } from "@/lib/supabase-storage";
import { canViewAllTasks, taskParticipantWhere } from "@/lib/task-access";

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

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assignees: true, location: { select: { name: true } } } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mansione: true, location: { select: { name: true } } },
  });
  const canOpenAll = canViewAllTasks(session.user.role, currentUser?.mansione, currentUser?.location?.name) || managerRoles.has(session.user.role);
  const participantTask = canOpenAll
    ? task
    : await prisma.staffTask.findFirst({
        where: { AND: [{ id: taskId }, taskParticipantWhere(session.user.id, session.user.name)] },
        select: { id: true },
      });
  if (!participantTask) {
    return NextResponse.json({ error: "Allegato non disponibile." }, { status: 403 });
  }

  try {
    return NextResponse.redirect(await signedDocumentUrl(path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Allegato non disponibile." }, { status: 503 });
  }
}
