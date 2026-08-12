import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { hasTaskAccess, isTaskOfficeUser, taskWorkerWhere } from "@/lib/task-access";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

async function getAuthorizedTaskUser(userId: string, role: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mansione: true, sede_id: true, location: { select: { name: true } } },
  });
  if (!hasTaskAccess(role, user?.mansione, user?.location?.name)) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const currentUser = await getAuthorizedTaskUser(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id")?.trim();
  const section = request.nextUrl.searchParams.get("section") === "extras" ? "extras" : "core";
  if (!id) return NextResponse.json({ error: "Task non valida" }, { status: 400 });

  const accessSelect = {
    assignees: { select: { id: true, name: true, photo_url: true } },
    created_by: { select: { id: true, name: true, photo_url: true } },
    location: { select: { id: true, name: true } },
  } as const;
  const task = section === "extras"
    ? await prisma.staffTask.findUnique({
        where: { id },
        select: {
          id: true,
          location_id: true,
          created_by_id: true,
          attachment_name: true,
          attachment_url: true,
          photo_url: true,
          notes: true,
          completion_note: true,
          completion_files: true,
          completion_links: true,
          comments: {
            include: { user: { select: { id: true, name: true, photo_url: true } } },
            orderBy: { created_at: "asc" },
            take: 30,
          },
          ...accessSelect,
        },
      })
    : await prisma.staffTask.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          category: true,
          checklist: true,
          link_url: true,
          timer_seconds: true,
          evaluation: true,
          location_id: true,
          created_by_id: true,
          due_date: true,
          started_at: true,
          completed_at: true,
          created_at: true,
          updated_at: true,
          ...accessSelect,
        },
      });
  if (!task) return NextResponse.json({ error: "Task non trovata" }, { status: 404 });

  const canSeeAllLocations = isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name);
  const canSeeAllTasks = ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role) || canSeeAllLocations;
  const isAssignee = task.assignees.some((user) => user.id === session.user.id);
  const locationAllowed = canSeeAllLocations || task.location_id === currentUser.sede_id;
  const taskAllowed = canSeeAllTasks || task.created_by_id === session.user.id || isAssignee;
  if (!locationAllowed || !taskAllowed) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  return NextResponse.json(task);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  const currentUser = await getAuthorizedTaskUser(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const payload = await request.json();
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  
  const workerIds = Array.isArray(payload.assignedToIds)
    ? payload.assignedToIds.map(String).filter(Boolean)
    : [String(payload.assignedToId ?? "")].filter(Boolean);

  const priority = String(payload.priority ?? "MEDIA").toUpperCase();
  const category = String(payload.category ?? "Operativa").trim() || "Operativa";
  const linkUrl = String(payload.linkUrl ?? "").trim();
  const attachmentName = String(payload.attachmentName ?? "").trim();
  const photoUrl = String(payload.photoUrl ?? "").trim();
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist
        .map((item: unknown) => ({ text: String(typeof item === "object" && item !== null ? (item as Record<string, unknown>).text ?? "" : item).trim(), done: false, completedBy: null, completedAt: null }))
        .filter((item: { text: string }) => item.text)
    : [];
  const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : null;

  if (!title || !description || workerIds.length === 0) {
    return NextResponse.json({ error: "Inserisci titolo, descrizione e almeno un lavoratore." }, { status: 400 });
  }

  const workers = await prisma.user.findMany({
    where: { ...taskWorkerWhere(), id: { in: workerIds } }
  });
  if (workers.length === 0) {
    return NextResponse.json({ error: "Nessun lavoratore valido selezionato." }, { status: 400 });
  }

  const firstLocationId = workers[0]?.sede_id;
  if (!firstLocationId) {
    return NextResponse.json({ error: "I lavoratori selezionati devono essere assegnati a un salone." }, { status: 400 });
  }
  
  if (!isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name) && currentUser.sede_id !== firstLocationId) {
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
      assignees: {
        connect: workers.map(w => ({ id: w.id }))
      },
      location_id: firstLocationId,
      created_by_id: session.user.id,
      due_date: dueDate && !Number.isNaN(dueDate.valueOf()) ? dueDate : null,
    },
    include: { assignees: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });

  await Promise.all(workers.map(worker => 
    createNotification({
      user_id: worker.id,
      title: `Nuova task: ${title}`,
      message: description,
      type: "TASK",
      action_url: "/tasks",
      read: false,
    }).catch(err => console.error("Notification failed for", worker.id, err))
  ));

  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const currentUser = await getAuthorizedTaskUser(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const payload = await request.json();
  const id = String(payload.id ?? "");
  const status = String(payload.status ?? "").toUpperCase();
  const evaluation = String(payload.evaluation ?? "").toUpperCase();
  const notes = typeof payload.notes === "string" ? payload.notes : null;
  const attachmentName = typeof payload.attachmentName === "string" ? payload.attachmentName.trim() : null;
  const photoUrl = typeof payload.photoUrl === "string" ? payload.photoUrl.trim() : null;
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

  const requestedChecklist = Array.isArray(payload.checklist)
    ? payload.checklist
        .map((item: any) => {
          if (item && typeof item === "object") {
            return {
              text: String(item.text ?? "").trim(),
              done: Boolean(item.done),
            };
          }
          return null;
        })
        .filter(Boolean)
    : null;

  const isNotesUpdate = notes !== null && !status && !evaluation;
  const isDescriptionImageUpdate = photoUrl !== null && attachmentName !== null && !status && !evaluation && notes === null;
  const isChecklistUpdate = requestedChecklist !== null && !status && !evaluation && notes === null && photoUrl === null;
  
  if (!id || (!isNotesUpdate && !isDescriptionImageUpdate && !isChecklistUpdate && !["ACTIVE", "WAITING", "COMPLETED"].includes(status) && !["LIKE", "OK", "DISLIKE"].includes(evaluation))) {
    return NextResponse.json({ error: "Stato task non valido." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id }, include: { assignees: true, created_by: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });
  const existingChecklist = Array.isArray(task.checklist)
    ? task.checklist as Array<{ text: string; done?: boolean; completedBy?: string | null; completedAt?: string | null }>
    : [];
  const checklist = requestedChecklist?.map((item: { text: string; done: boolean }, index: number) => {
    const previous = existingChecklist[index]?.text === item.text
      ? existingChecklist[index]
      : existingChecklist.find((entry) => entry.text === item.text);
    if (!item.done) return { text: item.text, done: false, completedBy: null, completedAt: null };
    if (previous?.done) {
      return {
        text: item.text,
        done: true,
        completedBy: previous.completedBy ?? session.user.name ?? "Collaboratore",
        completedAt: previous.completedAt ?? new Date().toISOString(),
      };
    }
    return { text: item.text, done: true, completedBy: session.user.name ?? "Collaboratore", completedAt: new Date().toISOString() };
  }) ?? null;
  const isEvaluation = ["LIKE", "OK", "DISLIKE"].includes(evaluation) && !status;
  
  const isAssignee = task.assignees.some(u => u.id === session.user.id);
  const canEdit = isEvaluation ? managerRoles.has(session.user.role) : managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id || hasTaskAccess(session.user.role, currentUser.mansione, currentUser.location?.name);
  if (!canEdit || (!isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name) && currentUser.sede_id !== task.location_id)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  const updated = await prisma.staffTask.update({
    where: { id },
    data: isNotesUpdate
      ? { notes: notes || null }
      : isDescriptionImageUpdate
      ? { photo_url: photoUrl || null, attachment_name: attachmentName || null }
      : isChecklistUpdate
      ? { checklist }
      : isEvaluation
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
    include: { assignees: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });

  if (status === "COMPLETED" && task.created_by_id !== session.user.id) {
    await createNotification({
        user_id: task.created_by_id,
        title: `Task completata: ${task.title}`,
        message: `${session.user.name} ha completato la task in ${Math.floor((updated.timer_seconds ?? 0) / 60)} min.`,
        type: "TASK",
        action_url: "/tasks",
    });
  }
  return NextResponse.json(updated);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  const currentUser = await getAuthorizedTaskUser(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const payload = await request.json();
  const id = String(payload.id ?? "");
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  
  const workerIds = Array.isArray(payload.assignedToIds)
    ? payload.assignedToIds.map(String).filter(Boolean)
    : [String(payload.assignedToId ?? "")].filter(Boolean);

  const priority = String(payload.priority ?? "MEDIA").toUpperCase();
  const category = String(payload.category ?? "Operativa").trim() || "Operativa";
  const linkUrl = String(payload.linkUrl ?? "").trim();
  const attachmentName = String(payload.attachmentName ?? "").trim();
  const photoUrl = String(payload.photoUrl ?? "").trim();
  const dueDate = payload.dueDate ? new Date(String(payload.dueDate)) : null;

  if (!id || !title || !description || workerIds.length === 0) {
    return NextResponse.json({ error: "Inserisci titolo, descrizione e almeno un lavoratore." }, { status: 400 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "Task non trovata." }, { status: 404 });

  const workers = await prisma.user.findMany({
    where: { ...taskWorkerWhere(), id: { in: workerIds } }
  });
  if (workers.length === 0) {
    return NextResponse.json({ error: "Nessun lavoratore valido selezionato." }, { status: 400 });
  }

  const firstLocationId = workers[0]?.sede_id;
  if (!firstLocationId) {
    return NextResponse.json({ error: "Lavoratori senza salone." }, { status: 400 });
  }
  
  if (!isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name) && (currentUser.sede_id !== task.location_id || currentUser.sede_id !== firstLocationId)) {
    return NextResponse.json({ error: "Puoi modificare task solo nel tuo salone." }, { status: 403 });
  }

  const existingChecklist = Array.isArray(task.checklist)
    ? task.checklist as Array<{ text: string; done?: boolean; completedBy?: string | null; completedAt?: string | null }>
    : [];
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist
        .map((item: unknown) => String(item).trim())
        .filter(Boolean)
        .map((text: string) => {
          const existing = existingChecklist.find((item) => item.text === text);
          return {
            text,
            done: Boolean(existing?.done),
            completedBy: existing?.completedBy ?? null,
            completedAt: existing?.completedAt ?? null,
          };
        })
    : existingChecklist.map((item) => ({ text: item.text, done: Boolean(item.done), completedBy: item.completedBy ?? null, completedAt: item.completedAt ?? null }));

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
      assignees: {
        set: workers.map(w => ({ id: w.id }))
      },
      location_id: firstLocationId,
      due_date: dueDate && !Number.isNaN(dueDate.valueOf()) ? dueDate : null,
    },
    include: { assignees: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
  });

  const existingAssigneeIds = new Set(task.assignees.map(a => a.id));
  const newWorkers = workers.filter(w => !existingAssigneeIds.has(w.id));
  
  await Promise.all(newWorkers.map(worker =>
    createNotification({
      user_id: worker.id,
      title: `Task assegnata: ${title}`,
      message: description,
      type: "TASK",
      action_url: "/tasks",
      read: false,
    }).catch(err => console.error("Notification failed for", worker.id, err))
  ));

  return NextResponse.json(updated);
}
