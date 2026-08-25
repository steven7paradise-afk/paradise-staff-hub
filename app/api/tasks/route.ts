import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadTaskImageToGoogleDrive } from "@/lib/google-drive";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { hasTaskAccess, isTaskOfficeUser, taskEscalationRecipientWhere, taskWorkerWhere } from "@/lib/task-access";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function safeTaskFileName(name: string, taskId: string) {
  const ext = String(name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file";
  const base = String(name || "allegato")
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "") || "allegato";
  const cleanTaskId = String(taskId || "task").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 36);
  return `${new Date().toISOString().slice(0, 10)}-${cleanTaskId}-${base}.${ext}`;
}

async function normalizeTaskAttachment(attachmentName: string | null, photoUrl: string | null, taskId: string) {
  let cleanName = attachmentName?.trim() || null;
  let cleanPhotoUrl = photoUrl?.trim() || null;
  let attachmentUrl: string | null = null;

  if (cleanPhotoUrl && cleanPhotoUrl.startsWith("data:")) {
    const match = cleanPhotoUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1] || "application/octet-stream";
      const buffer = Buffer.from(match[2], "base64");
      const nameToUse = cleanName || (mimeType.startsWith("image/") ? "foto-task.jpg" : "file-task");
      const fileName = safeTaskFileName(nameToUse, taskId);

      try {
        const driveFile = await uploadTaskImageToGoogleDrive(buffer, fileName, mimeType);
        cleanName = cleanName || driveFile.name;
        attachmentUrl = driveFile.driveFileUrl || driveFile.webViewLink || driveFile.webContentLink || null;
        if (mimeType.startsWith("image/")) {
          cleanPhotoUrl = driveFile.previewUrl || driveFile.webViewLink || null;
        } else {
          cleanPhotoUrl = null;
        }
      } catch (err) {
        console.error("Failed to upload task attachment to Google Drive:", err);
      }
    }
  }

  return {
    attachmentName: cleanName,
    attachmentUrl,
    photoUrl: cleanPhotoUrl,
  };
}

async function normalizeCompletionFilesForDb(files: Array<{ name: string; url?: string | null }>, taskId: string) {
  const result = [];
  for (const file of files) {
    if (!file.url || !file.url.startsWith("data:")) {
      result.push(file);
      continue;
    }
    const match = file.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      result.push(file);
      continue;
    }
    const mimeType = match[1] || "application/octet-stream";
    const buffer = Buffer.from(match[2], "base64");
    const fileName = safeTaskFileName(file.name || "completamento", taskId);
    try {
      const driveFile = await uploadTaskImageToGoogleDrive(buffer, fileName, mimeType);
      const isImage = mimeType.startsWith("image/");
      const driveUrl = driveFile.driveFileUrl || driveFile.webViewLink || driveFile.webContentLink;
      result.push({
        name: driveFile.name || file.name,
        url: isImage ? driveFile.previewUrl : driveUrl,
        previewUrl: isImage ? driveFile.previewUrl : null,
        driveFileId: driveFile.id,
        driveFileUrl: driveUrl,
        type: mimeType,
      });
    } catch (err) {
      console.error("Failed to upload completion file to Google Drive:", err);
      result.push(file);
    }
  }
  return result;
}


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
  
  const workerIds: string[] = Array.from(new Set<string>(Array.isArray(payload.assignedToIds)
    ? payload.assignedToIds.map(String).filter(Boolean)
    : [String(payload.assignedToId ?? "")].filter(Boolean)));

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

  const canAssignAcrossLocations = isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name);
  const assignmentWhere = canAssignAcrossLocations
    ? taskWorkerWhere()
    : taskEscalationRecipientWhere(currentUser.sede_id);
  const workers = await prisma.user.findMany({
    where: { ...assignmentWhere, id: { in: workerIds } },
  });
  if (workers.length !== workerIds.length) {
    return NextResponse.json({ error: "Puoi assegnare la task solo agli Admin o ai Responsabili autorizzati." }, { status: 403 });
  }

  const firstLocationId = canAssignAcrossLocations ? workers[0]?.sede_id : currentUser.sede_id;
  if (!firstLocationId) {
    return NextResponse.json({ error: "I lavoratori selezionati devono essere assegnati a un salone." }, { status: 400 });
  }
  
  const tempTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const normalized = await normalizeTaskAttachment(attachmentName, photoUrl, tempTaskId);

  const task = await prisma.staffTask.create({
    data: {
      title,
      description,
      priority: ["ALTA", "MEDIA", "BASSA"].includes(priority) ? priority : "MEDIA",
      category,
      checklist,
      link_url: linkUrl || null,
      attachment_name: normalized.attachmentName,
      attachment_url: normalized.attachmentUrl,
      photo_url: normalized.photoUrl,
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
      action_url: `/tasks?task=${encodeURIComponent(task.id)}`,
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
  const canEdit = isEvaluation
    ? managerRoles.has(session.user.role)
    : managerRoles.has(session.user.role) || isAssignee || task.created_by_id === session.user.id;
  if (!canEdit || (!isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name) && currentUser.sede_id !== task.location_id)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }

  let updated;
  try {
    const normalizedImage = isDescriptionImageUpdate
      ? await normalizeTaskAttachment(attachmentName, photoUrl, id)
      : null;
    const normalizedCompletionFiles = status === "COMPLETED"
      ? await normalizeCompletionFilesForDb(completionFiles, id)
      : null;

    updated = await prisma.staffTask.update({
      where: { id },
      data: isNotesUpdate
        ? { notes: notes || null }
        : isDescriptionImageUpdate
        ? { photo_url: normalizedImage?.photoUrl, attachment_name: normalizedImage?.attachmentName, attachment_url: normalizedImage?.attachmentUrl }
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
            completion_files: status === "COMPLETED" ? (normalizedCompletionFiles ?? completionFiles) : task.completion_files,
          },
      include: { assignees: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
    });
  } catch (error) {
    console.error("Task update failed:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della Task. Riprova." }, { status: 500 });
  }

  if (status === "COMPLETED" && task.created_by_id !== session.user.id) {
    await createNotification({
        user_id: task.created_by_id,
        title: `Task completata: ${task.title}`,
        message: `${session.user.name} ha completato la task in ${Math.floor((updated.timer_seconds ?? 0) / 60)} min.`,
        type: "TASK",
        action_url: `/tasks?task=${encodeURIComponent(task.id)}`,
    }).catch((error) => console.error("Task completion notification failed:", error));
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
  
  const workerIds: string[] = Array.from(new Set<string>(Array.isArray(payload.assignedToIds)
    ? payload.assignedToIds.map(String).filter(Boolean)
    : [String(payload.assignedToId ?? "")].filter(Boolean)));

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

  const canAssignAcrossLocations = isTaskOfficeUser(session.user.role, currentUser.mansione, currentUser.location?.name);
  const isAssignee = task.assignees.some((worker) => worker.id === session.user.id);
  const canEditTask = canAssignAcrossLocations
    || session.user.role === "RESPONSABILE"
    || task.created_by_id === session.user.id
    || isAssignee;
  if (!canEditTask) {
    return NextResponse.json({ error: "Puoi modificare soltanto le task create da te o assegnate a te." }, { status: 403 });
  }

  const assignmentWhere = canAssignAcrossLocations
    ? taskWorkerWhere()
    : taskEscalationRecipientWhere(currentUser.sede_id);
  const workers = await prisma.user.findMany({
    where: { ...assignmentWhere, id: { in: workerIds } },
  });
  if (workers.length !== workerIds.length) {
    return NextResponse.json({ error: "Puoi assegnare la task solo agli Admin o ai Responsabili autorizzati." }, { status: 403 });
  }

  if (!canAssignAcrossLocations && currentUser.sede_id !== task.location_id) {
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

  const normalized = await normalizeTaskAttachment(attachmentName, photoUrl, id);

  const updated = await prisma.staffTask.update({
    where: { id },
    data: {
      title,
      description,
      priority: ["ALTA", "MEDIA", "BASSA"].includes(priority) ? priority : "MEDIA",
      category,
      checklist,
      link_url: linkUrl || null,
      attachment_name: normalized.attachmentName,
      attachment_url: normalized.attachmentUrl || (normalized.photoUrl ? null : task.attachment_url),
      photo_url: normalized.photoUrl,
      assignees: {
        set: workers.map(w => ({ id: w.id }))
      },
      location_id: task.location_id,
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
      action_url: `/tasks?task=${encodeURIComponent(updated.id)}`,
      read: false,
    }).catch(err => console.error("Notification failed for", worker.id, err))
  ));

  return NextResponse.json(updated);
}
