import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const managerRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const taskId = String(payload.taskId ?? "");
  const message = String(payload.message ?? "").trim();
  if (!taskId || !message) return NextResponse.json({ error: "Commento mancante." }, { status: 400 });

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assigned_to: true, created_by: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const canComment = managerRoles.has(session.user.role) || task.assigned_to_id === session.user.id;
  if (!canComment || (session.user.role === "RESPONSABILE" && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  const comment = await prisma.staffTaskComment.create({
    data: { task_id: taskId, user_id: session.user.id, message },
    include: { user: true },
  });
  const targetId = session.user.id === task.assigned_to_id ? task.created_by_id : task.assigned_to_id;
  if (targetId !== session.user.id) {
    await createNotification({
        user_id: targetId,
        title: `Nuovo commento: ${task.title}`,
        message,
        type: "TASK",
        action_url: "/tasks",
    });
  }
  return NextResponse.json(comment);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const id = String(payload.id ?? "");
  const message = String(payload.message ?? "").trim();
  const comment = await prisma.staffTaskComment.findUnique({ where: { id }, include: { task: true } });
  if (!comment) return NextResponse.json({ error: "Commento non trovato." }, { status: 404 });
  const canEdit = comment.user_id === session.user.id || session.user.role === "SUPER_ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Puoi modificare solo i tuoi commenti." }, { status: 403 });
  const updated = await prisma.staffTaskComment.update({ where: { id }, data: { message }, include: { user: true } });
  return NextResponse.json(updated);
}
