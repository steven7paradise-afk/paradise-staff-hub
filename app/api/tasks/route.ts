import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const managerRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const assignRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !assignRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const assignedToId = String(payload.assignedToId ?? "");
  const priority = String(payload.priority ?? "MEDIA").toUpperCase();
  const category = String(payload.category ?? "Operativa").trim() || "Operativa";
  const linkUrl = String(payload.linkUrl ?? "").trim();
  const attachmentName = String(payload.attachmentName ?? "").trim();
  const photoUrl = String(payload.photoUrl ?? "").trim();
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist.map((item: unknown) => ({ text: String(item).trim(), done: false })).filter((item: { text: string; done: boolean }) => item.text)
    : [];
  const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : null;
  if (!title || !description || !assignedToId) {
    return NextResponse.json({ error: "Inserisci titolo, descrizione e lavoratore." }, { status: 400 });
  }

  const worker = await prisma.user.findFirst({ where: { id: assignedToId, active: true, role: { not: "SUPER_ADMIN" } } });
  if (!worker?.sede_id) return NextResponse.json({ error: "Lavoratore senza salone." }, { status: 400 });
  if ((session.user.role === "RESPONSABILE" || session.user.role === "DIPENDENTE") && session.user.sedeId !== worker.sede_id) {
    return NextResponse.json({ error: "Puoi assegnare task solo al tuo salone." }, { status: 403 });
  }

  const task = await prisma.staffTask.create({
    data: {
      title,
      description,
      priority: ["ALTA", "MEDIA", "BASSA"].includes(priority) ? priority : "MEDIA",
      category,
      checklist,
      link_url: linkUrl || null,
      attachment_name: attachmentName || null,
      photo_url: photoUrl || null,
      assigned_to_id: assignedToId,
      location_id: worker.sede_id,
      created_by_id: session.user.id,
      due_date: dueDate && !Number.isNaN(dueDate.valueOf()) ? dueDate : null,
    },
    include: { assigned_to: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });
  await createNotification({
      user_id: assignedToId,
      title: `Nuova task: ${title}`,
      message: description,
      type: "TASK",
      action_url: "/tasks",
      read: false,
  });

  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const payload = await request.json();
  const id = String(payload.id ?? "");
  const status = String(payload.status ?? "").toUpperCase();
  const evaluation = String(payload.evaluation ?? "").toUpperCase();
  const timerSeconds = Number(payload.timerSeconds ?? 0);
  const completionNote = String(payload.completionNote ?? "").trim();
  const completionLinks = Array.isArray(payload.completionLinks) ? payload.completionLinks.map(String).filter(Boolean) : [];
  const completionFiles = Array.isArray(payload.completionFiles)
    ? payload.completionFiles
        .map((item: unknown) => {
          if (typeof item === "string") return item.trim() ? { name: item.trim() } : null;
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const name = String(record.name ?? "").trim();
            const url = String(record.url ?? "").trim();
            return name || url ? { name: name || "file", url: url || null } : null;
          }
          return null;
        })
        .filter(Boolean)
    : [];
  if (!id || (!["ACTIVE", "COMPLETED"].includes(status) && !["LIKE", "OK", "DISLIKE"].includes(evaluation))) {
    return NextResponse.json({ error: "Stato task non valido." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id }, include: { assigned_to: true, created_by: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const isEvaluation = ["LIKE", "OK", "DISLIKE"].includes(evaluation) && !status;
  const canEdit = isEvaluation ? managerRoles.has(session.user.role) : managerRoles.has(session.user.role) || task.assigned_to_id === session.user.id || task.created_by_id === session.user.id;
  if (!canEdit || ((session.user.role === "RESPONSABILE" || session.user.role === "DIPENDENTE") && session.user.sedeId !== task.location_id)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  const updated = await prisma.staffTask.update({
    where: { id },
    data: isEvaluation
      ? { evaluation, evaluated_by_id: session.user.id, evaluated_at: new Date() }
      : {
          status,
          timer_seconds: Number.isFinite(timerSeconds) ? Math.max(0, Math.round(timerSeconds)) : task.timer_seconds,
          started_at: status === "ACTIVE" && !task.started_at ? new Date() : task.started_at,
          completed_at: status === "COMPLETED" ? new Date() : null,
          completion_note: status === "COMPLETED" ? completionNote || task.completion_note : task.completion_note,
          completion_links: status === "COMPLETED" ? completionLinks : task.completion_links,
          completion_files: status === "COMPLETED" ? completionFiles : task.completion_files,
        },
    include: { assigned_to: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });
  if (status === "COMPLETED" && task.created_by_id !== session.user.id) {
    await createNotification({
        user_id: task.created_by_id,
        title: `Task completata: ${task.title}`,
        message: `${task.assigned_to.name} ha completato la task in ${Math.floor((updated.timer_seconds ?? 0) / 60)} min.`,
        type: "TASK",
        action_url: "/tasks",
    });
  }
  return NextResponse.json(updated);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !assignRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const id = String(payload.id ?? "");
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const assignedToId = String(payload.assignedToId ?? "");
  const priority = String(payload.priority ?? "MEDIA").toUpperCase();
  const category = String(payload.category ?? "Operativa").trim() || "Operativa";
  const linkUrl = String(payload.linkUrl ?? "").trim();
  const attachmentName = String(payload.attachmentName ?? "").trim();
  const photoUrl = String(payload.photoUrl ?? "").trim();
  const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : null;

  if (!id || !title || !description || !assignedToId) {
    return NextResponse.json({ error: "Inserisci titolo, descrizione e lavoratore." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id }, include: { assigned_to: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });

  const worker = await prisma.user.findFirst({ where: { id: assignedToId, active: true, role: { not: "SUPER_ADMIN" } } });
  if (!worker?.sede_id) return NextResponse.json({ error: "Lavoratore senza salone." }, { status: 400 });
  if ((session.user.role === "RESPONSABILE" || session.user.role === "DIPENDENTE") && (session.user.sedeId !== task.location_id || session.user.sedeId !== worker.sede_id)) {
    return NextResponse.json({ error: "Puoi modificare task solo nel tuo salone." }, { status: 403 });
  }

  const existingChecklist = Array.isArray(task.checklist) ? task.checklist as { text: string; done?: boolean }[] : [];
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist
        .map((item: unknown) => String(item).trim())
        .filter(Boolean)
        .map((text: string) => ({ text, done: Boolean(existingChecklist.find((item) => item.text === text)?.done) }))
    : existingChecklist.map((item) => ({ text: item.text, done: Boolean(item.done) }));

  const updated = await prisma.staffTask.update({
    where: { id },
    data: {
      title,
      description,
      priority: ["ALTA", "MEDIA", "BASSA"].includes(priority) ? priority : "MEDIA",
      category,
      checklist,
      link_url: linkUrl || null,
      attachment_name: attachmentName || null,
      photo_url: photoUrl || null,
      assigned_to_id: assignedToId,
      location_id: worker.sede_id,
      due_date: dueDate && !Number.isNaN(dueDate.valueOf()) ? dueDate : null,
    },
    include: { assigned_to: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });

  if (task.assigned_to_id !== assignedToId) {
    await createNotification({
      user_id: assignedToId,
      title: `Task assegnata: ${title}`,
      message: description,
      type: "TASK",
      action_url: "/tasks",
      read: false,
    });
  }

  return NextResponse.json(updated);
}
