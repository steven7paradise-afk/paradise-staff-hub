import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import {
  activeShiftFollowUps,
  normalizeShiftResponsibleAnswers,
  normalizeShiftResponsibleQuestions,
  SHIFT_RESPONSIBLE_ANSWERS_KEY,
  SHIFT_RESPONSIBLE_QUESTIONS_KEY,
} from "@/lib/shift-responsible-questions";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";
import { romeDayRange } from "@/lib/shift-reports";
import { getShiftAppointmentClients } from "@/lib/shift-responsible-appointments";
import { createNotifications } from "@/lib/notifications";
import { taskWorkerWhere } from "@/lib/task-access";
import { buildShiftTaskCommentContext } from "@/lib/shift-task-comment";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output ?? []).flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((item: any) => typeof item?.text === "string" ? item.text : "").join("").trim();
}

async function generateTaskComment(day: string, questions: ReturnType<typeof normalizeShiftResponsibleQuestions>, dayAnswers: Record<string, string>, taskTitle: string) {
  const context = buildShiftTaskCommentContext(day, taskTitle, questions, dayAnswers);
  const fallback = context.readableText;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_NOTE_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: "Leggi il riepilogo del controllo giornaliero di un salone beauty e scrivi un commento operativo chiaro da inserire dentro una task. Riporta solo fatti presenti, persone coinvolte, problemi e azioni utili. Mantieni leggibili le note associate a staff e clienti. Non mostrare JSON, identificativi tecnici o nomi di campi interni. Non ripetere la task tra le risposte. Scrivi in italiano, massimo 180 parole, con brevi righe e senza titolo." },
          { role: "user", content: context.readableText },
        ],
        max_output_tokens: 500,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(35_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return fallback;
    return extractOutputText(data).slice(0, 4000) || fallback;
  } catch (error) {
    console.error("Shift task AI comment failed:", error);
    return fallback;
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { day?: unknown; questionId?: unknown; answer?: unknown } | null;
  const day = typeof payload?.day === "string" ? payload.day : "";
  const questionId = typeof payload?.questionId === "string" ? payload.questionId : "";
  const answer = typeof payload?.answer === "string" ? payload.answer.trim().slice(0, 12000) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !questionId || !answer) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  if (day !== today) return NextResponse.json({ error: "È possibile modificare soltanto il turno di oggi" }, { status: 400 });

  const [questionsSetting, answersSetting, accessSetting, assignmentSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_QUESTIONS_KEY } }),
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY } }),
    prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY } }),
    prisma.setting.findUnique({ where: { key: WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } }),
  ]);
  const access = normalizeShiftResponsibleAccess(accessSetting?.value);
  const dayAccess = access[day] ?? emptyShiftAccessDay();
  const selectedResponsibleId = normalizeShiftResponsibleAssignments(assignmentSetting?.value)[day];
  if (!hasShiftWriteAccess(dayAccess, session.user.id, selectedResponsibleId)) {
    return NextResponse.json({ error: dayAccess.acknowledgements[session.user.id] ? "Serve il permesso del responsabile di turno" : "Attiva la presa visione prima di scrivere" }, { status: 403 });
  }
  const questions = normalizeShiftResponsibleQuestions(questionsSetting?.value);
  const answers = normalizeShiftResponsibleAnswers(answersSetting?.value);
  const [baseQuestionId, branch, extraPart] = questionId.split("::");
  const question = questions.find((item) => item.id === baseQuestionId);
  const primaryAnswer = answers[day]?.[baseQuestionId];
  const validFollowUp = question && branch ? activeShiftFollowUps(question, primaryAnswer).some((followUp) => followUp.key === branch) : false;
  const isPrimaryChoice = answer === "YES" || answer === "NO";
  const isSingleChoice = ["MULTIPLE_CHOICE", "DROPDOWN"].includes(question?.answerType ?? "")
    && (question?.options?.includes(answer) || (question?.answerType === "MULTIPLE_CHOICE" && question?.allowOther === true && answer.startsWith("Altro: ") && answer.length > 7));
  const isNumberChoice = ["LINEAR_SCALE", "RATING"].includes(question?.answerType ?? "")
    && Number.isFinite(Number(answer)) && Number(answer) >= (question?.answerType === "RATING" ? 1 : question?.scaleMin ?? 1) && Number(answer) <= (question?.scaleMax ?? 5);
  let isStructuredChoice = false;
  if (["CHECKBOXES", "MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"].includes(question?.answerType ?? "")) {
    try {
      const parsed = JSON.parse(answer) as unknown;
      if (question?.answerType === "CHECKBOXES" && Array.isArray(parsed)) {
        isStructuredChoice = parsed.length > 0 && parsed.every((value) => typeof value === "string" && (question.options?.includes(value) || (question.allowOther && value.startsWith("Altro: "))));
      } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        isStructuredChoice = Object.entries(parsed as Record<string, unknown>).every(([row, value]) => question?.rows?.includes(row) && (question.answerType === "CHECKBOX_GRID" ? Array.isArray(value) && value.every((item) => typeof item === "string" && question.options?.includes(item)) : typeof value === "string" && question.options?.includes(value)));
      }
    } catch { /* invalid structured answer */ }
  }
  let isUploadedFile = false;
  if (question?.answerType === "FILE_UPLOAD") {
    try {
      const parsed = JSON.parse(answer) as { driveFileId?: unknown; url?: unknown };
      isUploadedFile = typeof parsed.driveFileId === "string" && typeof parsed.url === "string" && parsed.url.startsWith("https://drive.google.com/");
    } catch { /* invalid file answer */ }
  }
  let isStaffNote = false;
  if (question?.answerType === "STAFF_NOTE") {
    try {
      const parsed = JSON.parse(answer) as { staffNotes?: unknown; staffId?: unknown; name?: unknown; note?: unknown };
      const rawEntries = Array.isArray(parsed.staffNotes)
        ? parsed.staffNotes
        : typeof parsed.staffId === "string" ? [{ staffId: parsed.staffId, name: parsed.name, note: parsed.note }] : [];
      const entries = rawEntries.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { staffId?: unknown; name?: unknown; note?: unknown };
        return typeof entry.staffId === "string" && typeof entry.name === "string" && typeof entry.note === "string"
          ? [{ staffId: entry.staffId, name: entry.name, note: entry.note }]
          : [];
      });
      const uniqueIds = new Set(entries.map((entry) => entry.staffId));
      const validEntries = entries.length > 0
        && entries.length <= 30
        && uniqueIds.size === entries.length
        && entries.every((entry) => entry.note.trim().length > 0 && entry.note.length <= 400);
      if (validEntries) {
        const scheduledStaff = await prisma.scheduleEntry.findMany({
          where: {
            date: romeDayRange(day).date,
            user_id: { in: [...uniqueIds] },
            location: { name: { contains: "Buenos Aires", mode: "insensitive" } },
            user: { active: true, employee_status: { not: "Ex dipendente" } },
          },
          select: { user_id: true, user: { select: { name: true } }, category: { select: { start_time: true, end_time: true } }, start_time: true, end_time: true },
        });
        const scheduledPeople = new Map(scheduledStaff
          .filter((row) => (row.start_time || row.category.start_time) && (row.end_time || row.category.end_time))
          .map((row) => [row.user_id, row.user.name]));
        isStaffNote = scheduledPeople.size === entries.length && entries.every((entry) => scheduledPeople.get(entry.staffId) === entry.name);
      }
    } catch { /* invalid staff answer */ }
  }
  let isClientNote = false;
  if (question?.answerType === "CLIENT_NOTE") {
    try {
      const parsed = JSON.parse(answer) as { clientNotes?: unknown; appointmentId?: unknown; name?: unknown; time?: unknown; service?: unknown; note?: unknown };
      const rawEntries = Array.isArray(parsed.clientNotes)
        ? parsed.clientNotes
        : typeof parsed.appointmentId === "string" ? [parsed] : [];
      const entries = rawEntries.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { appointmentId?: unknown; name?: unknown; time?: unknown; service?: unknown; note?: unknown };
        return typeof entry.appointmentId === "string" && typeof entry.name === "string" && typeof entry.time === "string" && typeof entry.service === "string" && typeof entry.note === "string"
          ? [{ appointmentId: entry.appointmentId, name: entry.name, time: entry.time, service: entry.service, note: entry.note }]
          : [];
      });
      const uniqueIds = new Set(entries.map((entry) => entry.appointmentId));
      if (entries.length > 0 && entries.length <= 10 && uniqueIds.size === entries.length && entries.every((entry) => entry.note.trim().length > 0 && entry.note.length <= 1000)) {
        const appointmentMap = new Map((await getShiftAppointmentClients(day)).map((item) => [item.id, item]));
        isClientNote = entries.every((entry) => {
          const appointment = appointmentMap.get(entry.appointmentId);
          return appointment?.name === entry.name && appointment.time === entry.time && appointment.service === entry.service;
        });
      }
    } catch { /* invalid client answer */ }
  }
  let isMultiText = false;
  if (question?.answerType === "MULTI_TEXT") {
    try {
      const parsed = JSON.parse(answer) as { textEntries?: unknown };
      const entries = Array.isArray(parsed.textEntries) ? parsed.textEntries.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { label?: unknown; value?: unknown };
        return typeof entry.label === "string" && typeof entry.value === "string" ? [{ label: entry.label, value: entry.value }] : [];
      }) : [];
      const labels = question.options ?? [];
      isMultiText = labels.length > 0
        && labels.length <= 10
        && entries.length === labels.length
        && entries.every((entry, index) => entry.label === labels[index] && entry.value.trim().length > 0 && entry.value.length <= 1000);
    } catch { /* invalid multiple written answers */ }
  }
  let isTimeline = false;
  if (question?.answerType === "TIMELINE") {
    try {
      const parsed = JSON.parse(answer) as { timelineEntries?: unknown };
      const entries = Array.isArray(parsed.timelineEntries) ? parsed.timelineEntries.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { time?: unknown; note?: unknown };
        return typeof entry.time === "string" && typeof entry.note === "string" ? [{ time: entry.time, note: entry.note }] : [];
      }) : [];
      isTimeline = entries.length > 0
        && entries.length <= 10
        && entries.every((entry) => /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time) && entry.note.trim().length > 0 && entry.note.length <= 1000);
    } catch { /* invalid timeline answer */ }
  }
  let taskRequest: { taskTitle: string; assigneeIds: string[] } | null = null;
  let taskWorkers: Array<{ id: string; name: string; sede_id: string | null; mansione: string | null; location: { name: string } | null }> = [];
  if (question?.answerType === "TASK" && !branch) {
    try {
      const parsed = JSON.parse(answer) as { taskTitle?: unknown; assignees?: unknown };
      const taskTitle = typeof parsed.taskTitle === "string" ? parsed.taskTitle.trim().slice(0, 500) : "";
      const assigneeIds = Array.isArray(parsed.assignees) ? Array.from(new Set(parsed.assignees.flatMap((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []))).slice(0, 10) : [];
      if (taskTitle && assigneeIds.length && !answers[day]?.[baseQuestionId]) {
        taskWorkers = await prisma.user.findMany({
          where: { ...taskWorkerWhere(), id: { in: assigneeIds } },
          select: { id: true, name: true, sede_id: true, mansione: true, location: { select: { name: true } } },
        });
        if (taskWorkers.length === assigneeIds.length) taskRequest = { taskTitle, assigneeIds };
      }
    } catch { /* invalid task answer */ }
  }
  const validPrimaryAnswer = ["SHORT_TEXT", "TEXT", "DATE", "TIME"].includes(question?.answerType ?? "")
    || (question?.answerType === "YES_NO" && isPrimaryChoice)
    || isSingleChoice || isNumberChoice || isStructuredChoice || isUploadedFile || isStaffNote || isClientNote || isMultiText || isTimeline || Boolean(taskRequest);
  if (!question || extraPart || (branch ? !validFollowUp : !validPrimaryAnswer)) {
    return NextResponse.json({ error: "Domanda non valida" }, { status: 400 });
  }

  const previousAnswer = answers[day]?.[questionId];
  const dayAnswers: Record<string, string> = {
    ...(answers[day] ?? {}),
    [questionId]: answer,
  };
  if (!branch) {
    Object.keys(dayAnswers).filter((key) => key.startsWith(`${questionId}::`)).forEach((key) => delete dayAnswers[key]);
  }
  answers[day] = dayAnswers;
  if (previousAnswer !== answer) {
    dayAccess.audit.push({
      id: crypto.randomUUID(),
      questionId,
      actorId: session.user.id,
      actorName: session.user.name || "Utente",
      at: new Date().toISOString(),
      action: "ANSWER",
      previousValue: previousAnswer,
      nextValue: answer,
    });
  }
  dayAccess.audit = dayAccess.audit.slice(-300);
  access[day] = dayAccess;
  if (taskRequest) {
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { sede_id: true } });
    const locationId = taskWorkers.find((worker) => worker.sede_id)?.sede_id || currentUser?.sede_id;
    if (!locationId) return NextResponse.json({ error: "Serve una sede per creare la task" }, { status: 400 });
    const aiComment = await generateTaskComment(day, questions, answers[day] ?? {}, taskRequest.taskTitle);
    const createdTask = await prisma.$transaction(async (transaction) => {
      const task = await transaction.staffTask.create({
        data: {
          title: taskRequest.taskTitle.slice(0, 120),
          description: taskRequest.taskTitle,
          priority: "MEDIA",
          category: "Responsabile di turno",
          location_id: locationId,
          created_by_id: session.user.id,
          assignees: { connect: taskWorkers.map((worker) => ({ id: worker.id })) },
          comments: { create: { user_id: session.user.id, message: aiComment } },
        },
      });
      dayAnswers[questionId] = JSON.stringify({
        taskId: task.id,
        taskTitle: taskRequest.taskTitle,
        assignees: taskWorkers.map((worker) => ({ id: worker.id, name: worker.name, group: worker.mansione?.toLocaleLowerCase("it").includes("ufficio") || worker.location?.name.toLocaleLowerCase("it").includes("ufficio") ? "Ufficio" : "Responsabile" })),
        aiComment,
      });
      answers[day] = dayAnswers;
      await transaction.setting.upsert({ where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY }, create: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY, value: answers }, update: { value: answers } });
      await transaction.setting.upsert({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY }, create: { key: SHIFT_RESPONSIBLE_ACCESS_KEY, value: access }, update: { value: access } });
      return task;
    });
    void createNotifications(taskWorkers.map((worker) => ({ user_id: worker.id, title: `Nuova task: ${createdTask.title}`, message: taskRequest.taskTitle, type: "TASK", action_url: `/tasks?task=${encodeURIComponent(createdTask.id)}`, read: false }))).catch((error) => console.error("Shift task notifications failed:", error));
    return NextResponse.json(answers[day]);
  }
  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY }, create: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY, value: answers }, update: { value: answers } }),
    prisma.setting.upsert({ where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY }, create: { key: SHIFT_RESPONSIBLE_ACCESS_KEY, value: access }, update: { value: access } }),
  ]);
  return NextResponse.json(answers[day]);
}
