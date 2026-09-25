import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canRequestTaskCompletion, isFinalTaskStatus } from "@/lib/task-completion-workflow";
import { parseMobileTaskComment } from "@/lib/mobile-task-comment";

export const dynamic = "force-dynamic";

type ChecklistItem = {
  text: string;
  done?: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
};

const commentSelect = { id: true, message: true, created_at: true, files: true, user: { select: { name: true, photo_url: true } } } as const;
function commentDTO(c: { id: string; message: string; created_at: Date; files: unknown; user: { name: string; photo_url: string | null } }) {
  return { id: c.id, message: c.message, createdAt: c.created_at.toISOString(), author: c.user.name, photoUrl: c.user.photo_url, attachmentCount: Array.isArray(c.files) ? c.files.length : 0 };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const { id } = await params;
  const task = await prisma.staffTask.findFirst({ where: { id, assignees: { some: { id: auth.user.id } } }, select: { id: true, status: true, completion_note: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const comments = await prisma.staffTaskComment.findMany({ where: { task_id: id }, select: commentSelect, orderBy: { created_at: "desc" }, take: 200 });
  return NextResponse.json({ status: task.status, completionNote: task.completion_note, comments: comments.reverse().map(commentDTO) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });

  const { id } = await params;
  const task = await prisma.staffTask.findFirst({
    where: { id, assignees: { some: { id: auth.user.id } } },
    include: { assignees: { select: { id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });

  const payload = await request.json().catch(() => ({}));
  const action = String(payload.action ?? "").toUpperCase();

  if (action === "COMMENT") {
    const parsed = parseMobileTaskComment(payload);
    if (!parsed) return NextResponse.json({ error: "Scrivi un commento entro 5.000 caratteri." }, { status: 400 });
    const { message, id: commentId } = parsed;
    const duplicate = await prisma.staffTaskComment.findUnique({ where: { id: commentId }, select: { task_id: true, user_id: true, ...commentSelect } });
    if (duplicate) {
      if (duplicate.task_id !== id || duplicate.user_id !== auth.user.id || duplicate.message !== message) return NextResponse.json({ error: "Invio già utilizzato. Riprova." }, { status: 409 });
      return NextResponse.json(commentDTO(duplicate));
    }
    const comment = await prisma.staffTaskComment.create({ data: { id: commentId, task_id: id, user_id: auth.user.id, message }, select: commentSelect });
    const recipients = [...new Set([task.created_by_id, ...task.assignees.map(a => a.id)])].filter(userId => userId !== auth.user.id);
    await Promise.all(recipients.map(user_id => createNotification({ user_id, title: `Nuovo commento: ${task.title}`, message: `${auth.user.name}: ${message}`, type: "TASK", action_url: `/tasks?task=${encodeURIComponent(id)}` }).catch(() => null)));
    return NextResponse.json(commentDTO(comment));
  }

  if (action === "PAUSE") {
    const result = await prisma.staffTask.updateMany({ where: { id, status: "ACTIVE", assignees: { some: { id: auth.user.id } } }, data: { status: "WAITING" } });
    if (!result.count) return NextResponse.json({ error: "Puoi mettere in pausa solo una task in corso. Aggiorna la scheda." }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  if (action === "START") {
    if (isFinalTaskStatus(task.status) || task.status === "COMPLETION_REQUESTED") {
      return NextResponse.json({ error: "Questa task non può essere avviata." }, { status: 400 });
    }
    const changed = await prisma.staffTask.updateMany({
      where: { id, status: task.status, updated_at: task.updated_at, assignees: { some: { id: auth.user.id } } },
      data: { status: "ACTIVE", started_at: task.started_at ?? new Date() },
    });
    if (!changed.count) return NextResponse.json({ error: "Task aggiornata da un’altra persona. Aggiorna e riprova." }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  if (action === "CHECKLIST") {
    if (isFinalTaskStatus(task.status) || task.status === "COMPLETION_REQUESTED") {
      return NextResponse.json({ error: "La task è già completata." }, { status: 400 });
    }
    const requested = Array.isArray(payload.checklist) ? payload.checklist : [];
    const existing = Array.isArray(task.checklist) ? task.checklist as ChecklistItem[] : [];
    if (requested.length !== existing.length) {
      return NextResponse.json({ error: "Checklist non valida." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const checklist = existing.map((item, index) => {
      const done = Boolean(requested[index]?.done);
      if (!done) return { text: item.text, done: false, completedBy: null, completedAt: null };
      return {
        text: item.text,
        done: true,
        completedBy: item.done ? item.completedBy : auth.user.name,
        completedAt: item.done ? item.completedAt : now,
      };
    });
    const changed = await prisma.staffTask.updateMany({
      where: { id, status: task.status, updated_at: task.updated_at, assignees: { some: { id: auth.user.id } } },
      data: {
        checklist,
        status: task.status === "NEW" ? "ACTIVE" : task.status,
        started_at: task.started_at ?? new Date(),
      },
    });
    if (!changed.count) return NextResponse.json({ error: "Checklist aggiornata. Aggiorna e riprova." }, { status: 409 });
    return NextResponse.json({ success: true });
  }

  if (action === "REQUEST_COMPLETION") {
    if (!canRequestTaskCompletion({ isAssignee: true, currentStatus: task.status })) {
      return NextResponse.json({ error: "Il completamento non può essere richiesto." }, { status: 400 });
    }
    if (typeof payload.note === "string" && payload.note.length > 5000) return NextResponse.json({ error: "La nota può contenere al massimo 5.000 caratteri." }, { status: 400 });
    const changed = await prisma.staffTask.updateMany({
      where: { id, status: task.status, updated_at: task.updated_at, assignees: { some: { id: auth.user.id } } },
      data: {
        status: "COMPLETION_REQUESTED",
        started_at: task.started_at ?? new Date(),
        completion_note: String(payload.note ?? "").trim() || task.completion_note,
      },
    });
    if (!changed.count) return NextResponse.json({ error: "Task aggiornata. Aggiorna e riprova." }, { status: 409 });
    if (task.created_by_id !== auth.user.id) {
      await createNotification({
        user_id: task.created_by_id,
        title: `Completamento da confermare: ${task.title}`,
        message: `${auth.user.name} ha completato la task dall’app MyParadise.`,
        type: "TASK",
        action_url: `/tasks?task=${encodeURIComponent(task.id)}`,
      }).catch((error) => console.error("Mobile task notification failed:", error));
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Azione task non valida." }, { status: 400 });
}
