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
  const files = payload.files; // Expected: Array of { name: string, url: string }

  const hasFiles = Array.isArray(files) && files.length > 0;
  if (!taskId || (!message && !hasFiles)) {
    return NextResponse.json({ error: "Commento o allegato mancante." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id: taskId }, include: { assignees: true, created_by: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const isAssignee = task.assignees.some((a) => a.id === session.user.id);
  const canComment = managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id;
  if (!canComment || (session.user.role === "RESPONSABILE" && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  const comment = await prisma.staffTaskComment.create({
    data: { 
      task_id: taskId, 
      user_id: session.user.id, 
      message, 
      files: files || undefined 
    },
    include: { user: true },
  });

  const isCommenterCreator = session.user.id === task.created_by_id;
  const notifyUsers = isCommenterCreator 
    ? task.assignees.map((a) => a.id) 
    : Array.from(new Set([task.created_by_id, ...task.assignees.filter((a) => a.id !== session.user.id).map((a) => a.id)]));

  const notificationMessage = message || (hasFiles ? "Ha allegato dei file." : "Nuovo aggiornamento.");

  await Promise.all(notifyUsers.map((userId) => 
    createNotification({
      user_id: userId,
      title: `Nuovo commento: ${task.title}`,
      message: notificationMessage,
      type: "TASK",
      action_url: "/tasks",
    }).catch((err) => console.error("Notification failed for comment on task:", userId, err))
  ));

  return NextResponse.json(comment);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const id = String(payload.id ?? "");
  const message = String(payload.message ?? "").trim();
  const files = payload.files;
  const comment = await prisma.staffTaskComment.findUnique({ where: { id }, include: { task: true } });
  if (!comment) return NextResponse.json({ error: "Commento non trovato." }, { status: 404 });
  const canEdit = comment.user_id === session.user.id || session.user.role === "SUPER_ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Puoi modificare solo i tuoi commenti." }, { status: 403 });
  const updated = await prisma.staffTaskComment.update({ 
    where: { id }, 
    data: { 
      message, 
      files: files !== undefined ? files : undefined 
    }, 
    include: { user: true } 
  });
  return NextResponse.json(updated);
}
