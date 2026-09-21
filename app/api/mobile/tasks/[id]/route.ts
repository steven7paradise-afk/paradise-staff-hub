import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canRequestTaskCompletion, isFinalTaskStatus } from "@/lib/task-completion-workflow";

export const dynamic = "force-dynamic";

type ChecklistItem = {
  text: string;
  done?: boolean;
  completedBy?: string | null;
  completedAt?: string | null;
};

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

  if (action === "START") {
    if (isFinalTaskStatus(task.status) || task.status === "COMPLETION_REQUESTED") {
      return NextResponse.json({ error: "Questa task non può essere avviata." }, { status: 400 });
    }
    await prisma.staffTask.update({
      where: { id },
      data: { status: "ACTIVE", started_at: task.started_at ?? new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "CHECKLIST") {
    if (isFinalTaskStatus(task.status)) {
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
    await prisma.staffTask.update({
      where: { id },
      data: {
        checklist,
        status: task.status === "NEW" ? "ACTIVE" : task.status,
        started_at: task.started_at ?? new Date(),
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "REQUEST_COMPLETION") {
    if (!canRequestTaskCompletion({ isAssignee: true, currentStatus: task.status })) {
      return NextResponse.json({ error: "Il completamento non può essere richiesto." }, { status: 400 });
    }
    await prisma.staffTask.update({
      where: { id },
      data: {
        status: "COMPLETION_REQUESTED",
        started_at: task.started_at ?? new Date(),
        completion_note: String(payload.note ?? "").trim() || task.completion_note,
      },
    });
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
