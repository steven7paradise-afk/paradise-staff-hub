import type { LeaveType, RequestStatus } from "@prisma/client";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const ASSISTANCE_TASK_CATEGORY = "Assistenza personale";
const SUPPORTED_LEAVE_TYPES = new Set<LeaveType>(["FERIE", "PERMESSO", "MALATTIA", "RIPOSO"]);

type ApprovedLeave = {
  id: string;
  type: LeaveType;
  start_date: Date;
  end_date: Date;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  admin_note: string | null;
  user: {
    name: string;
    sede_id: string | null;
  };
};

export function shouldCreateLeaveAssistanceWorkflow(
  previousStatus: RequestStatus | null,
  currentStatus: RequestStatus,
  type: LeaveType,
) {
  return currentStatus === "APPROVED" && previousStatus !== "APPROVED" && SUPPORTED_LEAVE_TYPES.has(type);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(date);
}

function approvedLeaveCopy(leaveRequest: ApprovedLeave) {
  const type = leaveRequest.type.toLocaleLowerCase("it");
  const period = `dal ${formatDate(leaveRequest.start_date)} al ${formatDate(leaveRequest.end_date)}`;
  const hours = leaveRequest.start_time && leaveRequest.end_time
    ? `, dalle ${leaveRequest.start_time} alle ${leaveRequest.end_time}`
    : "";
  const details = [
    `È stata approvata la richiesta di ${type} di ${leaveRequest.user.name}, ${period}${hours}.`,
    leaveRequest.reason ? `Motivo: ${leaveRequest.reason}` : null,
    leaveRequest.admin_note ? `Nota amministrazione: ${leaveRequest.admin_note}` : null,
  ].filter(Boolean).join("\n");

  return {
    communicationTitle: `Richiesta approvata · ${leaveRequest.user.name}`,
    taskTitle: `Gestire ${type} · ${leaveRequest.user.name}`,
    details,
  };
}

/**
 * Avvisa il team Assistenza e crea una sola task operativa per la richiesta.
 * La funzione è idempotente: salvataggi ripetuti della stessa approvazione non
 * duplicano né la task né le comunicazioni già consegnate.
 */
export async function ensureLeaveAssistanceWorkflow(
  leaveRequest: ApprovedLeave,
  approvedById: string,
) {
  if (!SUPPORTED_LEAVE_TYPES.has(leaveRequest.type)) {
    return { skipped: true, reason: "Tipo richiesta non gestito." } as const;
  }

  const assistanceUsers = await prisma.user.findMany({
    where: {
      active: true,
      employee_status: { not: "Ex dipendente" },
      mansione: { contains: "assistenza", mode: "insensitive" },
    },
    select: { id: true, sede_id: true },
  });

  if (assistanceUsers.length === 0) {
    return { skipped: true, reason: "Nessun addetto Assistenza attivo trovato." } as const;
  }

  const actionUrl = "/requests";
  const taskMarker = `leave-request:${leaveRequest.id}`;
  const { communicationTitle, taskTitle, details } = approvedLeaveCopy(leaveRequest);
  const locationId = leaveRequest.user.sede_id ?? assistanceUsers.find((user) => user.sede_id)?.sede_id ?? null;
  let taskCreated = false;
  let taskId: string | null = null;

  if (locationId) {
    const existingTask = await prisma.staffTask.findFirst({
      where: { category: ASSISTANCE_TASK_CATEGORY, notes: taskMarker },
      select: { id: true },
    });

    if (existingTask) {
      taskId = existingTask.id;
      await prisma.staffTask.update({
        where: { id: existingTask.id },
        data: { assignees: { connect: assistanceUsers.map((user) => ({ id: user.id })) } },
      });
    } else {
      const task = await prisma.staffTask.create({
        data: {
          title: taskTitle,
          description: `${details}\n\nControllare la richiesta approvata e completare le attività di assistenza necessarie.`,
          priority: "MEDIA",
          category: ASSISTANCE_TASK_CATEGORY,
          checklist: [
            { text: "Controllare periodo e informazioni della richiesta", done: false, completedBy: null, completedAt: null },
            { text: "Aggiornare le attività operative di Assistenza", done: false, completedBy: null, completedAt: null },
          ],
          notes: taskMarker,
          link_url: actionUrl,
          location_id: locationId,
          created_by_id: approvedById,
          assignees: { connect: assistanceUsers.map((user) => ({ id: user.id })) },
        },
        select: { id: true },
      });
      taskId = task.id;
      taskCreated = true;
    }
  }

  const existingCommunications = await prisma.notification.findMany({
    where: {
      user_id: { in: assistanceUsers.map((user) => user.id) },
      type: "COMUNICAZIONE",
      title: communicationTitle,
      message: details,
      action_url: actionUrl,
    },
    select: { user_id: true },
  });
  const alreadyNotified = new Set(existingCommunications.map((item) => item.user_id));
  const communications = assistanceUsers
    .filter((user) => !alreadyNotified.has(user.id))
    .map((user) => ({
      user_id: user.id,
      title: communicationTitle,
      message: details,
      type: "COMUNICAZIONE",
      action_url: actionUrl,
      read: false,
    }));

  if (communications.length > 0) await createNotifications(communications);

  if (taskCreated && taskId) {
    await createNotifications(assistanceUsers.map((user) => ({
      user_id: user.id,
      title: `Nuova task: ${taskTitle}`,
      message: details,
      type: "TASK",
      action_url: `/tasks?task=${encodeURIComponent(taskId!)}`,
      read: false,
    })));
  }

  return {
    skipped: false,
    recipients: assistanceUsers.length,
    communicationsCreated: communications.length,
    taskCreated,
    taskId,
  } as const;
}
