import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadTaskImageToGoogleDrive } from "@/lib/google-drive";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function mentionSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function extractMentionTags(message: string) {
  return Array.from(message.matchAll(/@([a-zA-Z0-9_]+)/g)).map((match) => match[1].toLowerCase());
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json();
  const taskId = String(payload.taskId ?? "");
  const message = String(payload.message ?? "").trim();
  const files = await normalizeTaskCommentFiles(payload.files, taskId); // Array of { name, url, previewUrl, driveFileId }

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

  const recentDuplicate = await prisma.staffTaskComment.findFirst({
    where: {
      task_id: taskId,
      user_id: session.user.id,
      message,
      created_at: { gte: new Date(Date.now() - 10_000) },
    },
    include: { user: true },
    orderBy: { created_at: "desc" },
  });
  if (recentDuplicate) return NextResponse.json(recentDuplicate);

  const comment = await prisma.staffTaskComment.create({
    data: { 
      task_id: taskId, 
      user_id: session.user.id, 
      message, 
      files: files || undefined 
    },
    include: { user: true },
  });

  const mentionTags = extractMentionTags(message);
  const canMentionAcrossLocations = ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role);
  const mentionedUsers = mentionTags.length > 0
    ? await prisma.user.findMany({
        where: {
          active: true,
          role: { not: "ZERO" },
          OR: canMentionAcrossLocations
            ? [
                { role: "SUPER_ADMIN" },
                { role: "ADMIN" },
                { role: "RESPONSABILE" },
                { mansione: { contains: "responsabile salone", mode: "insensitive" } },
                { mansione: { contains: "vice responsabile salone", mode: "insensitive" } },
              ]
            : [
                { role: "SUPER_ADMIN" },
                { role: "ADMIN" },
                { role: "RESPONSABILE", sede_id: task.location_id },
                { sede_id: task.location_id, mansione: { contains: "responsabile salone", mode: "insensitive" } },
                { sede_id: task.location_id, mansione: { contains: "vice responsabile salone", mode: "insensitive" } },
              ],
        },
        select: { id: true, name: true },
      }).then((users) => users.filter((user) => mentionTags.includes(mentionSlug(user.name))))
    : [];

  const mentionedUserIds = mentionedUsers.map((user) => user.id).filter((id) => id !== session.user.id);
  const isCommenterCreator = session.user.id === task.created_by_id;
  const baseNotifyUsers = isCommenterCreator 
    ? task.assignees.map((a) => a.id) 
    : Array.from(new Set([task.created_by_id, ...task.assignees.filter((a) => a.id !== session.user.id).map((a) => a.id)]));
  const notifyUsers = baseNotifyUsers.filter((userId) => !mentionedUserIds.includes(userId));

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

  await Promise.all(mentionedUserIds.map((userId) =>
    createNotification({
      user_id: userId,
      title: `Ti hanno taggato: ${task.title}`,
      message: `${session.user.name} ti ha menzionato in un commento: ${notificationMessage}`,
      type: "TASK",
      action_url: "/tasks",
    }).catch((err) => console.error("Mention notification failed for task:", userId, err))
  ));

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
  const canEdit = comment.user_id === session.user.id || session.user.role === "ZERO" || session.user.role === "SUPER_ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Puoi modificare solo i tuoi commenti." }, { status: 403 });
  const files = payload.files !== undefined ? await normalizeTaskCommentFiles(payload.files, comment.task_id) : undefined;
  const data: Prisma.StaffTaskCommentUpdateInput = { message };
  if (files !== undefined && files !== null) data.files = files as Prisma.InputJsonValue;
  const updated = await prisma.staffTaskComment.update({ 
    where: { id }, 
    data,
    include: { user: true } 
  });
  return NextResponse.json(updated);
}

async function normalizeTaskCommentFiles(files: unknown, taskId: string) {
  if (!Array.isArray(files)) return files;

  const normalized = [];
  for (const item of files) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? "immagine-task").trim() || "immagine-task";
    const url = String(record.url ?? "").trim();

    if (url.startsWith("/api/drive-image") || record.driveFileId || record.driveFileUrl) {
      normalized.push(record);
      continue;
    }

    if (!url.startsWith("data:image/")) {
      normalized.push({ name, url });
      continue;
    }

    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      normalized.push({ name });
      continue;
    }

    const mimeType = match[1] || "image/jpeg";
    const buffer = Buffer.from(match[2], "base64");
    const driveFile = await uploadTaskImageToGoogleDrive(buffer, taskImageFileName(name, taskId), mimeType);
    normalized.push({
      name: driveFile.name || name,
      url: driveFile.previewUrl,
      previewUrl: driveFile.previewUrl,
      driveFileId: driveFile.id,
      driveFileUrl: driveFile.webViewLink,
      webContentLink: driveFile.webContentLink,
      type: mimeType,
    });
  }

  return normalized;
}

function taskImageFileName(name: string, taskId: string) {
  const extension = safeExtension(name);
  const cleanName = safeFilePart(name.replace(/\.[^.]+$/, "") || "immagine-task").slice(0, 60);
  return `${new Date().toISOString().slice(0, 10)}-${taskId}-${cleanName}.${extension}`;
}

function safeExtension(name: string) {
  const extension = String(name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!extension || extension.length > 5) return "jpg";
  return extension;
}

function safeFilePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "") || "immagine-task";
}
