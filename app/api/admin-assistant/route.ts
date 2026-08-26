import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getShopifyRevenueRange } from "@/lib/shopify-payment-register";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 2_000;

const APP_PAGES = {
  dashboard: { path: "/dashboard", label: "Dashboard" },
  staff: { path: "/staff", label: "Staff Paradise" },
  tasks: { path: "/tasks", label: "Task" },
  attendance: { path: "/attendance", label: "Timbrature" },
  requests: { path: "/requests", label: "Ferie e permessi" },
  sickness: { path: "/malattie", label: "Malattie" },
  communications: { path: "/notifications", label: "Comunicazioni" },
  new_communication: { path: "/notifications/new", label: "Nuova comunicazione" },
  schedules: { path: "/schedules", label: "Planning" },
  documents: { path: "/documents", label: "Documenti" },
  payslips: { path: "/cedolini", label: "Cedolini" },
  cash: { path: "/cash", label: "Cassa" },
} as const;

type PageKey = keyof typeof APP_PAGES;
type ChatMessage = { role: "user" | "assistant"; content: string };
type ToolCall = { type: "function_call"; name: string; arguments: string; call_id: string };
type OpenAIResponse = {
  output?: Array<Record<string, unknown>>;
  output_text?: string;
  error?: { message?: string };
};
type CommunicationAction = {
  type: "SEND_COMMUNICATION";
  auditId: string;
  recipientId: string;
  recipientName: string;
  title: string;
  message: string;
  taskId: string | null;
  taskTitle: string | null;
};
type PendingAction = {
  token: string;
  type: "SEND_COMMUNICATION";
  label: string;
  recipient: string;
  title: string;
  message: string;
  expiresAt: string;
};
type AssistantCard = {
  id: string;
  person: string;
  photoUrl: string | null;
  status: string;
  type: string;
  location: string;
  date: string | null;
  time: string | null;
  detail: string | null;
  tone: "green" | "amber" | "red" | "violet" | "blue" | "slate";
};
type AssistantMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AssistantCard["tone"];
};

const tools = [
  {
    type: "function",
    name: "remember_instruction",
    description: "Salva nella memoria amministrativa condivisa una regola, preferenza o decisione stabile. Usalo quando l'amministratore dice ricorda, da ora in poi, sempre, oppure esprime chiaramente una regola permanente. Non salvare segreti o dati personali sensibili.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Regola autosufficiente, sintetica e comprensibile anche in una conversazione futura." },
        category: { type: "string", enum: ["REGOLA", "PREFERENZA", "GRAFICA", "COMUNICAZIONE", "PROCESSO"] },
      },
      required: ["content", "category"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_memories",
    description: "Elenca ciò che Paradise Assistant ricorda. Usalo quando l'amministratore chiede cosa ricordi o cerca una regola salvata.",
    strict: true,
    parameters: {
      type: "object",
      properties: { query: { type: ["string", "null"], description: "Filtro testuale opzionale." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "forget_memory",
    description: "Disattiva una memoria quando l'amministratore chiede esplicitamente di dimenticare o rimuovere una regola.",
    strict: true,
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Testo preciso che identifica la memoria da dimenticare." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "prepare_communication",
    description: "Prepara una comunicazione professionale a una persona, verificando destinatario e task. Non invia: crea un'anteprima da confermare.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        recipient_name: { type: "string", description: "Nome o parte del nome del destinatario." },
        task_query: { type: ["string", "null"], description: "Titolo o parole della task da collegare, se citata." },
        title: { type: "string", description: "Titolo professionale e sintetico della comunicazione." },
        message: { type: "string", description: "Testo professionale completo, pronto per l'anteprima." },
      },
      required: ["recipient_name", "task_query", "title", "message"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_team_status",
    description: "Legge lo stato odierno del personale: in turno, in pausa, fuori turno o non entrato.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "get_task_overview",
    description: "Legge riepilogo e task recenti, inclusi assegnatari, scadenze e stato.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["NEW", "ACTIVE", "WAITING", "COMPLETED", "OVERDUE", null],
          description: "Filtro opzionale per stato; OVERDUE indica task scadute non completate.",
        },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_requests_overview",
    description: "Legge ferie, permessi, riposi, malattie e richieste di ritardo recenti o in attesa.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        type: {
          type: ["string", "null"],
          enum: ["FERIE", "PERMESSO", "RIPOSO", "MALATTIA", "RITARDO", null],
          description: "Tipo opzionale; RITARDO seleziona i permessi generati per ritardo.",
        },
        pending_only: { type: "boolean", description: "Se true mostra solo richieste da approvare." },
      },
      required: ["type", "pending_only"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_schedule_month_status",
    description: "Verifica se la turnistica di un mese è stata caricata: copertura dipendenti, numero turni, date coperte e persone senza alcuna assegnazione.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        month: { type: "integer", minimum: 1, maximum: 12, description: "Mese numerico da 1 a 12." },
        year: { type: "integer", minimum: 2024, maximum: 2100, description: "Anno a quattro cifre." },
      },
      required: ["month", "year"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_payslip_month_status",
    description: "Verifica i cedolini caricati per mese e anno, indicando quanti collaboratori li hanno ricevuti e chi manca. Se il periodo non è specificato, usa l'ultimo periodo presente nell'archivio e lo dichiara chiaramente.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        month: { type: ["integer", "null"], minimum: 1, maximum: 12, description: "Mese del cedolino; null se non indicato." },
        year: { type: ["integer", "null"], minimum: 2024, maximum: 2100, description: "Anno del cedolino; null se non indicato." },
      },
      required: ["month", "year"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_cash_overview",
    description: "Legge la situazione completa della cassa: contanti disponibili nel periodo aperto, chiusure, prelievi cassaforte, versamenti, fondo cassa, contanti attesi da Shopify, dichiarato, scostamento e giornate da verificare.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        month: { type: ["integer", "null"], minimum: 1, maximum: 12, description: "Mese da analizzare; null indica il mese corrente." },
        year: { type: ["integer", "null"], minimum: 2024, maximum: 2100, description: "Anno da analizzare; null indica l'anno corrente." },
      },
      required: ["month", "year"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "navigate_app",
    description: "Apre una pagina dell'app quando l'amministratore chiede esplicitamente di andarci o aprirla.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        page: { type: "string", enum: Object.keys(APP_PAGES) },
      },
      required: ["page"],
      additionalProperties: false,
    },
  },
] as const;

function actionSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("Segreto di sessione non configurato per confermare le azioni.");
  return secret;
}

function normalizedMemoryContent(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function memoryContainsSensitiveData(value: string) {
  return /\bsk-[a-z0-9_-]{12,}\b/i.test(value)
    || /\b(password|secret|token|api[ _-]?key)\s*[:=]/i.test(value)
    || /\bpin\s*(?:è|e|:|=)\s*\d{2,}\b/i.test(value);
}

async function rememberInstruction(args: Record<string, unknown>, actorId: string) {
  const content = normalizedMemoryContent(String(args.content || "")).slice(0, 600);
  const allowedCategories = new Set(["REGOLA", "PREFERENZA", "GRAFICA", "COMUNICAZIONE", "PROCESSO"]);
  const category = allowedCategories.has(String(args.category)) ? String(args.category) : "REGOLA";
  if (content.length < 5) return { output: { saved: false, error: "La regola è troppo breve per essere ricordata." } };
  if (memoryContainsSensitiveData(content)) {
    return { output: { saved: false, error: "Non posso memorizzare password, PIN, token o chiavi API." } };
  }
  const contentHash = createHash("sha256").update(content.toLocaleLowerCase("it")).digest("hex");
  const memory = await prisma.assistantMemory.upsert({
    where: { content_hash: contentHash },
    create: { content, content_hash: contentHash, category, created_by_id: actorId },
    update: { content, category, active: true, deactivated_at: null, created_by_id: actorId },
  });
  await prisma.assistantActionLog.create({
    data: {
      user_id: actorId,
      action: "REMEMBER_INSTRUCTION",
      target_type: "ASSISTANT_MEMORY",
      target_id: memory.id,
      summary: `Memoria salvata: ${content.slice(0, 140)}`,
      payload: { category, content },
      status: "COMPLETED",
      confirmed_at: new Date(),
    },
  });
  return { output: { saved: true, category, content } };
}

async function listMemories(args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? normalizedMemoryContent(args.query).slice(0, 120) : "";
  const memories = await prisma.assistantMemory.findMany({
    where: { active: true, ...(query ? { content: { contains: query, mode: "insensitive" as const } } : {}) },
    select: { id: true, content: true, category: true, updated_at: true },
    orderBy: { updated_at: "desc" },
    take: 50,
  });
  return {
    output: {
      count: memories.length,
      memories: memories.map((memory) => ({ category: memory.category, content: memory.content, updatedAt: memory.updated_at.toISOString() })),
    },
  };
}

async function forgetMemory(args: Record<string, unknown>, actorId: string) {
  const query = normalizedMemoryContent(String(args.query || "")).slice(0, 180);
  if (query.length < 3) return { output: { removed: false, error: "Specifica meglio cosa devo dimenticare." } };
  const matches = await prisma.assistantMemory.findMany({
    where: { active: true, content: { contains: query, mode: "insensitive" } },
    select: { id: true, content: true, category: true },
    take: 6,
  });
  if (matches.length !== 1) {
    return {
      output: {
        removed: false,
        error: matches.length === 0 ? "Non trovo una memoria corrispondente." : "La richiesta corrisponde a più ricordi: indica la frase in modo più preciso.",
        candidates: matches.map((memory) => ({ category: memory.category, content: memory.content })),
      },
    };
  }
  await prisma.$transaction([
    prisma.assistantMemory.update({ where: { id: matches[0].id }, data: { active: false, deactivated_at: new Date() } }),
    prisma.assistantActionLog.create({
      data: {
        user_id: actorId,
        action: "FORGET_MEMORY",
        target_type: "ASSISTANT_MEMORY",
        target_id: matches[0].id,
        summary: `Memoria disattivata: ${matches[0].content.slice(0, 140)}`,
        payload: { content: matches[0].content, category: matches[0].category },
        status: "COMPLETED",
        confirmed_at: new Date(),
      },
    }),
  ]);
  return { output: { removed: true, content: matches[0].content } };
}

function encodeAction(action: CommunicationAction, expiresAt: number) {
  const body = Buffer.from(JSON.stringify({ action, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", actionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decodeAction(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("Conferma non valida.");
  const expected = createHmac("sha256", actionSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("Conferma non valida.");
  }
  const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { action: CommunicationAction; expiresAt: number };
  if (!decoded?.action || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt < Date.now()) {
    throw new Error("La conferma è scaduta. Prepara nuovamente l'operazione.");
  }
  return decoded.action;
}

async function prepareCommunication(args: Record<string, unknown>, actorId: string) {
  const recipientQuery = String(args.recipient_name || "").trim().slice(0, 100);
  const taskQuery = typeof args.task_query === "string" ? args.task_query.trim().slice(0, 140) : "";
  const title = String(args.title || "").trim().slice(0, 120);
  const message = String(args.message || "").trim().slice(0, 3_000);
  if (recipientQuery.length < 2 || !title || !message) {
    return { output: { prepared: false, error: "Destinatario, titolo o messaggio mancanti." } };
  }

  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      employee_status: { not: "Ex dipendente" },
      name: { contains: recipientQuery, mode: "insensitive" },
    },
    select: { id: true, name: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 6,
  });
  const exact = candidates.find((candidate) => candidate.name.toLocaleLowerCase("it").trim() === recipientQuery.toLocaleLowerCase("it").trim());
  const recipient = exact || (candidates.length === 1 ? candidates[0] : null);
  if (!recipient) {
    return {
      output: {
        prepared: false,
        error: candidates.length ? "Destinatario ambiguo: chiedi all'amministratore di scegliere il nome completo." : "Nessun destinatario attivo trovato.",
        candidates: candidates.map((candidate) => ({ name: candidate.name, location: candidate.location?.name || "Nessuna sede" })),
      },
    };
  }

  const task = taskQuery
    ? await prisma.staffTask.findFirst({
        where: {
          assignees: { some: { id: recipient.id } },
          OR: [
            { title: { contains: taskQuery, mode: "insensitive" } },
            { description: { contains: taskQuery, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, status: true, due_date: true },
        orderBy: { updated_at: "desc" },
      })
    : null;
  if (taskQuery && !task) {
    return { output: { prepared: false, error: `Non trovo una task “${taskQuery}” assegnata a ${recipient.name}. Chiedi di specificare meglio la task.` } };
  }

  const audit = await prisma.assistantActionLog.create({
    data: {
      user_id: actorId,
      action: "SEND_COMMUNICATION",
      target_type: "USER",
      target_id: recipient.id,
      summary: `Comunicazione a ${recipient.name}: ${title}`,
      payload: { recipientId: recipient.id, recipientName: recipient.name, title, message, taskId: task?.id || null, taskTitle: task?.title || null },
    },
  });
  const action: CommunicationAction = {
    type: "SEND_COMMUNICATION",
    auditId: audit.id,
    recipientId: recipient.id,
    recipientName: recipient.name,
    title,
    message,
    taskId: task?.id || null,
    taskTitle: task?.title || null,
  };
  const expiresAt = Date.now() + 10 * 60_000;
  const pendingAction: PendingAction = {
    token: encodeAction(action, expiresAt),
    type: action.type,
    label: "Invia comunicazione",
    recipient: recipient.name,
    title,
    message,
    expiresAt: new Date(expiresAt).toISOString(),
  };
  return {
    output: {
      prepared: true,
      recipient: recipient.name,
      task: task ? { title: task.title, status: task.status, dueDate: task.due_date?.toISOString() || null } : null,
      title,
      message,
      confirmationRequired: true,
    },
    pendingAction,
    link: APP_PAGES.communications,
  };
}

async function confirmCommunication(token: string, actorId: string) {
  const action = decodeAction(token);
  if (action.type !== "SEND_COMMUNICATION") throw new Error("Azione non supportata.");
  const audit = await prisma.assistantActionLog.findUnique({ where: { id: action.auditId } });
  if (!audit || audit.user_id !== actorId || audit.status !== "PENDING") {
    throw new Error("Questa operazione non è più disponibile.");
  }
  const recipient = await prisma.user.findFirst({ where: { id: action.recipientId, active: true }, select: { id: true, name: true } });
  if (!recipient) throw new Error("Il destinatario non è più disponibile.");

  try {
    const notificationId = randomUUID();
    await createNotifications([{
      id: notificationId,
      user_id: recipient.id,
      title: action.title,
      message: action.message,
      type: "COMUNICAZIONE",
      page: 1,
      action_url: action.taskId ? "/tasks" : "/notifications",
      read: false,
      created_at: new Date(),
    }], {
      deliveryActionUrl: () => `/notifications?communication=${encodeURIComponent(notificationId)}`,
    });
    await prisma.assistantActionLog.update({ where: { id: audit.id }, data: { status: "COMPLETED", confirmed_at: new Date() } });
    return { answer: `Comunicazione inviata a ${recipient.name}.`, links: [APP_PAGES.communications] };
  } catch (error) {
    await prisma.assistantActionLog.update({ where: { id: audit.id }, data: { status: "FAILED", confirmed_at: new Date() } }).catch(() => null);
    throw error;
  }
}

async function cancelCommunication(token: string, actorId: string) {
  const action = decodeAction(token);
  await prisma.assistantActionLog.updateMany({
    where: { id: action.auditId, user_id: actorId, status: "PENDING" },
    data: { status: "CANCELLED", confirmed_at: new Date() },
  });
  return { answer: "Operazione annullata. Nessuna comunicazione è stata inviata." };
}

function romeDayBounds() {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { key, start, end };
}

async function getTeamStatus() {
  const { key, start, end } = romeDayBounds();
  const workers = await prisma.user.findMany({
    where: {
      active: true,
      employee_status: { not: "Ex dipendente" },
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    },
    select: {
      id: true,
      name: true,
      photo_url: true,
      mansione: true,
      location: { select: { name: true } },
      attendance_logs: {
        where: { date: { gte: start, lt: end } },
        select: { type: true, timestamp: true, time: true },
        orderBy: { timestamp: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const people = workers.map((worker) => {
    const state = deriveAttendanceState(worker.attendance_logs);
    return {
      name: worker.name,
      photoUrl: worker.photo_url,
      role: worker.mansione || "Non specificato",
      location: worker.location?.name || "Nessuna sede",
      status: state.status === "IN" ? "IN_TURNO" : state.status === "BREAK" ? "IN_PAUSA" : state.lastExit ? "USCITO" : "NON_ENTRATO",
      since: state.lastValidLog?.time || null,
    };
  });

  return {
    date: key,
    totals: {
      inShift: people.filter((person) => person.status === "IN_TURNO").length,
      onBreak: people.filter((person) => person.status === "IN_PAUSA").length,
      exited: people.filter((person) => person.status === "USCITO").length,
      notEntered: people.filter((person) => person.status === "NON_ENTRATO").length,
    },
    people,
  };
}

async function getTaskOverview(status: string | null) {
  const now = new Date();
  const where = status === "OVERDUE"
    ? { status: { not: "COMPLETED" }, due_date: { lt: now } }
    : status
      ? { status }
      : {};
  const [groups, recent] = await Promise.all([
    prisma.staffTask.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.staffTask.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
        updated_at: true,
        location: { select: { name: true } },
        assignees: { select: { name: true } },
      },
      orderBy: [{ due_date: "asc" }, { updated_at: "desc" }],
      take: 20,
    }),
  ]);

  return {
    totals: Object.fromEntries(groups.map((group) => [group.status, group._count._all])),
    overdue: await prisma.staffTask.count({ where: { status: { not: "COMPLETED" }, due_date: { lt: now } } }),
    tasks: recent.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date?.toISOString() || null,
      location: task.location.name,
      assignees: task.assignees.map((person) => person.name),
    })),
  };
}

async function getRequestsOverview(type: string | null, pendingOnly: boolean) {
  const since = new Date();
  since.setDate(since.getDate() - 45);
  const where = {
    ...(pendingOnly ? { status: "PENDING" as const } : { OR: [{ status: "PENDING" as const }, { end_date: { gte: since } }] }),
    ...(type === "RITARDO"
      ? { type: "PERMESSO" as const, reason: { startsWith: "RITARDO AUTOMATICO — " } }
      : type
        ? { type: type as "FERIE" | "PERMESSO" | "RIPOSO" | "MALATTIA" }
        : {}),
  };
  const requests = await prisma.leaveRequest.findMany({
    where,
    select: {
      id: true,
      type: true,
      status: true,
      start_date: true,
      end_date: true,
      start_time: true,
      end_time: true,
      reason: true,
      medical_code: true,
      sickness_unjustified: true,
      user: { select: { name: true, photo_url: true, location: { select: { name: true } } } },
    },
    orderBy: [{ status: "asc" }, { start_date: "desc" }],
    take: 30,
  });

  return {
    count: requests.length,
    requests: requests.map((request) => ({
      id: request.id,
      person: request.user.name,
      photoUrl: request.user.photo_url,
      location: request.user.location?.name || "Nessuna sede",
      type: request.reason?.startsWith("RITARDO AUTOMATICO — ") ? "RITARDO" : request.type,
      status: request.status,
      from: request.start_date.toISOString(),
      to: request.end_date.toISOString(),
      time: request.start_time || request.end_time ? `${request.start_time || ""}-${request.end_time || ""}` : null,
      reason: request.reason,
      justified: request.type === "MALATTIA" ? Boolean(request.medical_code) && !request.sickness_unjustified : null,
    })),
  };
}

function monthName(month: number) {
  return new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function activeStaffWhere(): Prisma.UserWhereInput {
  return {
    active: true,
    role: { notIn: [UserRole.ZERO, UserRole.SUPER_ADMIN] },
    employee_status: { not: "Ex dipendente", mode: "insensitive" },
  };
}

async function getScheduleMonthStatus(month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const [workers, entries] = await Promise.all([
    prisma.user.findMany({
      where: activeStaffWhere(),
      select: { id: true, name: true, photo_url: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        id: true,
        user_id: true,
        date: true,
        start_time: true,
        end_time: true,
        user: { select: { name: true } },
        location: { select: { name: true } },
        category: { select: { name: true, code: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);
  const scheduledIds = new Set(entries.map((entry) => entry.user_id));
  const missing = workers.filter((worker) => !scheduledIds.has(worker.id));
  const coveredDates = Array.from(new Set(entries.map((entry) => entry.date.toISOString().slice(0, 10))));
  const byLocation = new Map<string, number>();
  entries.forEach((entry) => {
    const location = entry.location?.name || "Sede non indicata";
    byLocation.set(location, (byLocation.get(location) || 0) + 1);
  });
  const status = entries.length === 0 ? "NON_CARICATA" : missing.length === 0 ? "CARICATA" : "PARZIALE";
  return {
    period: { month, monthName: monthName(month), year },
    status,
    totalEntries: entries.length,
    coveredDays: coveredDates.length,
    firstScheduledDate: coveredDates[0] || null,
    lastScheduledDate: coveredDates.at(-1) || null,
    staff: { total: workers.length, scheduled: workers.length - missing.length, missing: missing.length },
    missingPeople: missing.map((worker) => ({ name: worker.name, photoUrl: worker.photo_url, location: worker.location?.name || "Nessuna sede" })),
    entriesByLocation: Array.from(byLocation, ([location, count]) => ({ location, count })),
  };
}

async function getPayslipMonthStatus(month: number | null, year: number | null) {
  let targetMonth = month;
  let targetYear = year;
  if (!targetMonth || !targetYear) {
    const latest = await prisma.document.findFirst({
      where: { type: "BUSTA_PAGA", month: { not: null }, year: { not: null } },
      select: { month: true, year: true },
      orderBy: [{ year: "desc" }, { month: "desc" }, { created_at: "desc" }],
    });
    targetMonth = latest?.month || new Date().getMonth();
    targetYear = latest?.year || new Date().getFullYear();
  }
  const [workers, documents] = await Promise.all([
    prisma.user.findMany({
      where: activeStaffWhere(),
      select: { id: true, name: true, photo_url: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.document.findMany({
      where: { type: "BUSTA_PAGA", month: targetMonth, year: targetYear },
      select: { id: true, user_id: true, title: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
  ]);
  const uploadedIds = new Set(documents.map((document) => document.user_id));
  const missing = workers.filter((worker) => !uploadedIds.has(worker.id));
  const uploaded = workers.filter((worker) => uploadedIds.has(worker.id));
  const status = documents.length === 0 ? "NON_CARICATI" : missing.length === 0 ? "COMPLETI" : "PARZIALI";
  return {
    period: { month: targetMonth, monthName: monthName(targetMonth), year: targetYear },
    inferredPeriod: month === null || year === null,
    status,
    staff: { total: workers.length, uploaded: uploaded.length, missing: missing.length },
    uploadedDocuments: documents.length,
    lastUploadAt: documents[0]?.created_at.toISOString() || null,
    missingPeople: missing.map((worker) => ({ name: worker.name, photoUrl: worker.photo_url, location: worker.location?.name || "Nessuna sede" })),
  };
}

function cashDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekCloseRange(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const weekKey = String((value as Record<string, unknown>).weekKey || "");
  if (!weekKey) return null;
  const parts = weekKey.split(":");
  const start = new Date(`${parts[0]}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  const end = parts[1] ? new Date(`${parts[1]}T23:59:59`) : new Date(start);
  if (!parts[1]) end.setDate(end.getDate() + 6);
  return { start, end };
}

async function getCashOverview(month: number | null, year: number | null) {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();
  const start = new Date(targetYear, targetMonth - 1, 1);
  const end = new Date(targetYear, targetMonth, 1);
  const [monthClosingsRaw, monthVault, allMonthCloses, weekSettings] = await Promise.all([
    prisma.cashClosing.findMany({
      where: { date: { gte: start, lt: end } },
      include: { location: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.cashVaultWithdrawal.findMany({
      where: { date: { gte: start, lt: end } },
      include: { location: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.cashMonthClose.findMany({ orderBy: { month: "desc" } }).catch(() => []),
    prisma.setting.findMany({ where: { key: { startsWith: "cash_week_close:" } } }).catch(() => []),
  ]);

  const latestByLocationDay = new Map<string, (typeof monthClosingsRaw)[number]>();
  monthClosingsRaw.forEach((closing) => {
    const key = `${closing.location_id}:${cashDateKey(closing.date)}`;
    if (!latestByLocationDay.has(key)) latestByLocationDay.set(key, closing);
  });
  const monthClosings = Array.from(latestByLocationDay.values());
  const declaredByDay = new Map<string, number>();
  monthClosings.forEach((closing) => {
    const key = cashDateKey(closing.date);
    declaredByDay.set(key, (declaredByDay.get(key) || 0) + closing.withdrawn);
  });
  const latestDeclaredDate = monthClosings.reduce<Date | null>((latest, closing) => !latest || closing.date > latest ? closing.date : latest, null);
  const comparisonEnd = latestDeclaredDate ? new Date(latestDeclaredDate) : new Date(start);
  if (latestDeclaredDate) comparisonEnd.setDate(comparisonEnd.getDate() + 1);
  const shopify = await getShopifyRevenueRange(cashDateKey(start), cashDateKey(comparisonEnd));
  const expectedByDay = new Map<string, number>();
  shopify.payments.forEach((payment) => {
    if (payment.method !== "CONTANTI" && payment.method !== "CASHMATIC") return;
    const key = cashDateKey(new Date(payment.processedAt));
    expectedByDay.set(key, (expectedByDay.get(key) || 0) + payment.amount);
  });
  const expectedCash = Array.from(expectedByDay.values()).reduce((sum, amount) => sum + amount, 0);
  const declaredCash = monthClosings.reduce((sum, closing) => sum + closing.withdrawn, 0);
  const discrepancyDays = Array.from(new Set([...expectedByDay.keys(), ...declaredByDay.keys()]))
    .map((date) => ({
      date,
      expected: expectedByDay.get(date) || 0,
      declared: declaredByDay.get(date) || 0,
      difference: (declaredByDay.get(date) || 0) - (expectedByDay.get(date) || 0),
    }))
    .filter((day) => Math.abs(day.difference) > 0.009)
    .sort((left, right) => right.date.localeCompare(left.date));

  const reviewSettings = monthClosings.length
    ? await prisma.setting.findMany({ where: { key: { in: monthClosings.map((closing) => `cash_closing_review:${closing.id}`) } } })
    : [];
  const reviewed = new Map(reviewSettings.map((setting) => [setting.key.replace("cash_closing_review:", ""), setting.value as Record<string, unknown>]));

  const latestClosedMonth = allMonthCloses[0]?.month || null;
  const openStart = latestClosedMonth && /^\d{4}-\d{2}$/.test(latestClosedMonth)
    ? (() => {
        const [closedYear, closedMonth] = latestClosedMonth.split("-").map(Number);
        return new Date(closedYear, closedMonth, 1);
      })()
    : new Date(2026, 0, 1);
  const availabilityEnd = end < now ? end : new Date(now.getTime() + 1);
  const [openClosings, openVault] = await Promise.all([
    prisma.cashClosing.findMany({ where: { date: { gte: openStart, lt: availabilityEnd } } }),
    prisma.cashVaultWithdrawal.findMany({ where: { date: { gte: openStart, lt: availabilityEnd } } }),
  ]);
  const relevantWeekSettings = weekSettings.filter((setting) => {
    const range = weekCloseRange(setting.value);
    return Boolean(range && range.end >= openStart && range.end < availabilityEnd);
  });
  const bankDeposits = relevantWeekSettings.reduce((sum, setting) => sum + Number((setting.value as Record<string, unknown>).bank_deposit || 0), 0);
  const weeklyWithdrawals = relevantWeekSettings.reduce((sum, setting) => sum + Number((setting.value as Record<string, unknown>).withdrawals || 0), 0);
  const closedVaultOverlap = openVault.reduce((sum, withdrawal) => {
    const isIncludedInWeek = relevantWeekSettings.some((setting) => {
      const range = weekCloseRange(setting.value);
      const locationId = setting.key.split(":")[1];
      return Boolean(range && locationId === withdrawal.location_id && withdrawal.date >= range.start && withdrawal.date <= range.end);
    });
    return sum + (isIncludedInWeek ? withdrawal.amount : 0);
  }, 0);
  const availableCash = openClosings.reduce((sum, closing) => sum + closing.withdrawn, 0)
    - openVault.reduce((sum, withdrawal) => sum + withdrawal.amount, 0)
    - bankDeposits
    - weeklyWithdrawals
    + closedVaultOverlap;

  return {
    period: { month: targetMonth, monthName: monthName(targetMonth), year: targetYear },
    openPeriod: { startsAfterClosedMonth: latestClosedMonth, availableCash },
    month: {
      cashClosings: monthClosings.length,
      declaredCash,
      vaultWithdrawals: monthVault.reduce((sum, withdrawal) => sum + withdrawal.amount, 0),
      averageFund: monthClosings.length ? monthClosings.reduce((sum, closing) => sum + closing.fund, 0) / monthClosings.length : 0,
      reviewedCorrect: monthClosings.filter((closing) => reviewed.get(closing.id)?.status === "CORRETTO").length,
      reviewedError: monthClosings.filter((closing) => reviewed.get(closing.id)?.status === "ERRORE").length,
      pendingReview: monthClosings.filter((closing) => !reviewed.has(closing.id) || reviewed.get(closing.id)?.status === "DA_CONTROLLARE").length,
    },
    shopifyComparison: {
      available: shopify.available,
      expectedCash,
      declaredCash,
      difference: declaredCash - expectedCash,
      comparedUntil: latestDeclaredDate?.toISOString() || null,
      discrepancyDays,
    },
    calculation: { cashClosings: openClosings.reduce((sum, closing) => sum + closing.withdrawn, 0), vaultWithdrawals: openVault.reduce((sum, withdrawal) => sum + withdrawal.amount, 0), bankDeposits, weeklyWithdrawals },
  };
}

function assistantCards(toolName: string, output: unknown, question: string): AssistantCard[] {
  if (!output || typeof output !== "object") return [];
  const data = output as Record<string, unknown>;
  const normalizedQuestion = question.toLocaleLowerCase("it");

  if (toolName === "get_team_status" && Array.isArray(data.people)) {
    let people = data.people as Array<Record<string, unknown>>;
    if (normalizedQuestion.includes("paus")) people = people.filter((person) => person.status === "IN_PAUSA");
    else if (normalizedQuestion.includes("assen") || normalizedQuestion.includes("non entr")) people = people.filter((person) => person.status === "NON_ENTRATO");
    else if (normalizedQuestion.includes("turno") || normalizedQuestion.includes("lavor")) people = people.filter((person) => person.status === "IN_TURNO");

    const statusConfig: Record<string, { label: string; tone: AssistantCard["tone"] }> = {
      IN_TURNO: { label: "In turno", tone: "green" },
      IN_PAUSA: { label: "In pausa", tone: "amber" },
      USCITO: { label: "Uscito", tone: "slate" },
      NON_ENTRATO: { label: "Assente · non entrato", tone: "red" },
    };
    return people.slice(0, 20).map((person, index) => {
      const config = statusConfig[String(person.status)] || { label: String(person.status || "Stato"), tone: "slate" as const };
      return {
        id: `team-${String(person.name)}-${index}`,
        person: String(person.name || "Dipendente"),
        photoUrl: typeof person.photoUrl === "string" ? person.photoUrl : null,
        status: config.label,
        type: String(person.role || "Personale"),
        location: String(person.location || "Nessuna sede"),
        date: typeof data.date === "string" ? data.date : null,
        time: typeof person.since === "string" ? person.since : null,
        detail: null,
        tone: config.tone,
      };
    });
  }

  if (toolName === "get_requests_overview" && Array.isArray(data.requests)) {
    let requests = data.requests as Array<Record<string, unknown>>;
    if (normalizedQuestion.includes("ritard")) requests = requests.filter((item) => item.type === "RITARDO");
    else if (normalizedQuestion.includes("malatt")) requests = requests.filter((item) => item.type === "MALATTIA");
    else if (normalizedQuestion.includes("ferie")) requests = requests.filter((item) => item.type === "FERIE");

    return requests.slice(0, 20).map((item, index) => {
      const type = String(item.type || "RICHIESTA");
      const status = String(item.status || "PENDING");
      const justified = item.justified;
      const label = type === "MALATTIA"
        ? justified === true ? "Malattia giustificata" : "Malattia non giustificata"
        : type === "RITARDO"
          ? status === "APPROVED" ? "Ritardo approvato" : "Ritardo da approvare"
          : `${type.charAt(0)}${type.slice(1).toLowerCase()} · ${status === "APPROVED" ? "approvata" : "in attesa"}`;
      const tone: AssistantCard["tone"] = type === "MALATTIA"
        ? justified === true ? "violet" : "amber"
        : type === "RITARDO"
          ? "amber"
          : status === "APPROVED" ? "green" : "blue";
      return {
        id: String(item.id || `request-${index}`),
        person: String(item.person || "Dipendente"),
        photoUrl: typeof item.photoUrl === "string" ? item.photoUrl : null,
        status: label,
        type,
        location: String(item.location || "Nessuna sede"),
        date: typeof item.from === "string" ? item.from : null,
        time: typeof item.time === "string" ? item.time : null,
        detail: typeof item.reason === "string" ? item.reason.replace(/^RITARDO AUTOMATICO —\s*/i, "") : null,
        tone,
      };
    });
  }

  return [];
}

function euroMetric(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number.isFinite(amount) ? amount : 0);
}

function assistantMetrics(toolName: string, output: unknown): AssistantMetric[] {
  if (!output || typeof output !== "object") return [];
  const data = output as Record<string, any>;
  if (toolName === "get_schedule_month_status") {
    return [
      { id: "planning-status", label: "Turnistica", value: data.status === "CARICATA" ? "Caricata" : data.status === "PARZIALE" ? "Parziale" : "Mancante", detail: `${data.period?.monthName || "Mese"} ${data.period?.year || ""}`, tone: data.status === "CARICATA" ? "green" : data.status === "PARZIALE" ? "amber" : "red" },
      { id: "planning-staff", label: "Personale pianificato", value: `${data.staff?.scheduled || 0}/${data.staff?.total || 0}`, detail: `${data.staff?.missing || 0} senza assegnazioni`, tone: data.staff?.missing ? "amber" : "green" },
      { id: "planning-days", label: "Giorni coperti", value: String(data.coveredDays || 0), detail: `${data.totalEntries || 0} assegnazioni`, tone: data.coveredDays ? "blue" : "red" },
    ];
  }
  if (toolName === "get_payslip_month_status") {
    return [
      { id: "payslip-status", label: "Cedolini", value: data.status === "COMPLETI" ? "Completi" : data.status === "PARZIALI" ? "Parziali" : "Mancanti", detail: `${data.period?.monthName || "Mese"} ${data.period?.year || ""}`, tone: data.status === "COMPLETI" ? "green" : data.status === "PARZIALI" ? "amber" : "red" },
      { id: "payslip-uploaded", label: "Caricati", value: `${data.staff?.uploaded || 0}/${data.staff?.total || 0}`, detail: `${data.staff?.missing || 0} collaboratori mancanti`, tone: data.staff?.missing ? "amber" : "green" },
    ];
  }
  if (toolName === "get_cash_overview") {
    const difference = Number(data.shopifyComparison?.difference || 0);
    return [
      { id: "cash-available", label: "Cash disponibile", value: euroMetric(data.openPeriod?.availableCash), detail: data.openPeriod?.startsAfterClosedMonth ? `Dopo chiusura ${data.openPeriod.startsAfterClosedMonth}` : "Periodo aperto", tone: "green" },
      { id: "cash-declared", label: "Dichiarato nel mese", value: euroMetric(data.month?.declaredCash), detail: `${data.month?.cashClosings || 0} chiusure cassa`, tone: "blue" },
      { id: "cash-shopify", label: "Atteso Shopify", value: data.shopifyComparison?.available ? euroMetric(data.shopifyComparison?.expectedCash) : "Non disponibile", detail: `${data.period?.monthName || "Mese"} ${data.period?.year || ""}`, tone: data.shopifyComparison?.available ? "violet" : "slate" },
      { id: "cash-difference", label: "Scostamento", value: data.shopifyComparison?.available ? euroMetric(difference) : "-", detail: `${data.shopifyComparison?.discrepancyDays?.length || 0} giorni da verificare`, tone: !data.shopifyComparison?.available || Math.abs(difference) > 0.009 ? "amber" : "green" },
      { id: "cash-withdrawals", label: "Prelievi cassaforte", value: euroMetric(data.month?.vaultWithdrawals), detail: "Nel mese selezionato", tone: "red" },
    ];
  }
  return [];
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function executeTool(call: ToolCall, actorId: string) {
  const args = safeJson(call.arguments);
  if (call.name === "remember_instruction") return rememberInstruction(args, actorId);
  if (call.name === "list_memories") return listMemories(args);
  if (call.name === "forget_memory") return forgetMemory(args, actorId);
  if (call.name === "prepare_communication") return prepareCommunication(args, actorId);
  if (call.name === "get_team_status") return { output: await getTeamStatus() };
  if (call.name === "get_task_overview") {
    return { output: await getTaskOverview(typeof args.status === "string" ? args.status : null), link: APP_PAGES.tasks };
  }
  if (call.name === "get_requests_overview") {
    const type = typeof args.type === "string" ? args.type : null;
    const link = type === "MALATTIA" ? APP_PAGES.sickness : APP_PAGES.requests;
    return { output: await getRequestsOverview(type, args.pending_only === true), link };
  }
  if (call.name === "get_schedule_month_status") {
    const month = Math.min(12, Math.max(1, Number(args.month) || new Date().getMonth() + 1));
    const year = Math.min(2100, Math.max(2024, Number(args.year) || new Date().getFullYear()));
    return { output: await getScheduleMonthStatus(month, year), link: APP_PAGES.schedules };
  }
  if (call.name === "get_payslip_month_status") {
    const month = Number.isInteger(args.month) ? Number(args.month) : null;
    const year = Number.isInteger(args.year) ? Number(args.year) : null;
    return { output: await getPayslipMonthStatus(month, year), link: APP_PAGES.payslips };
  }
  if (call.name === "get_cash_overview") {
    const month = Number.isInteger(args.month) ? Math.min(12, Math.max(1, Number(args.month))) : null;
    const year = Number.isInteger(args.year) ? Math.min(2100, Math.max(2024, Number(args.year))) : null;
    return { output: await getCashOverview(month, year), link: APP_PAGES.cash };
  }
  if (call.name === "navigate_app") {
    const page = typeof args.page === "string" ? args.page as PageKey : "dashboard";
    const destination = APP_PAGES[page] || APP_PAGES.dashboard;
    return { output: { opened: true, destination }, navigation: destination };
  }
  return { output: { error: "Strumento non disponibile" } };
}

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => String(item.text))
    .join("\n")
    .trim();
}

async function createResponse(body: Record<string, unknown>, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) {
    console.error("OpenAI Responses API error", response.status, payload.error?.message || "unknown");
    throw new Error(response.status === 401 ? "Chiave OpenAI non valida o non autorizzata." : "Il servizio AI non è disponibile in questo momento.");
  }
  return payload;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { messages?: ChatMessage[]; confirmActionToken?: string; cancelActionToken?: string } | null;
  try {
    if (payload?.confirmActionToken) return NextResponse.json(await confirmCommunication(payload.confirmActionToken, session.user.id));
    if (payload?.cancelActionToken) return NextResponse.json(await cancelCommunication(payload.cancelActionToken, session.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operazione non disponibile." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY non configurata sul server." }, { status: 503 });
  const messages = Array.isArray(payload?.messages)
    ? payload.messages
        .filter((message): message is ChatMessage => Boolean(message) && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
        .slice(-MAX_HISTORY)
        .map((message) => ({ role: message.role, content: message.content.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content.trim();
  if (!lastUserMessage) return NextResponse.json({ error: "Scrivi una domanda." }, { status: 400 });

  const persistentMemories = await prisma.assistantMemory.findMany({
    where: { active: true },
    select: { category: true, content: true },
    orderBy: { updated_at: "desc" },
    take: 50,
  });
  const memoryContext = persistentMemories.length
    ? persistentMemories.map((memory, index) => `${index + 1}. [${memory.category}] ${memory.content}`).join("\n")
    : "Nessuna memoria amministrativa salvata.";

  const instructions = `Sei Paradise Assistant, assistente operativo interno di Paradise Beauty.
Rispondi in italiano, in modo sintetico e concreto. La persona autenticata è un amministratore.
Usa sempre gli strumenti per domande su presenze, pause, task, ferie, permessi, malattie e ritardi: non inventare dati.
Usa get_schedule_month_status per domande sulla turnistica o sul planning di un mese. Usa get_payslip_month_status per verificare se i cedolini sono stati caricati; indica sempre il mese e l'anno effettivamente controllati e se il periodo è stato dedotto automaticamente.
Usa get_cash_overview per qualsiasi domanda su cassa, cash disponibile, chiusure, fondo, prelievi, versamenti o scostamenti. Distingui sempre disponibilità del periodo aperto, dichiarato del mese e contanti attesi da Shopify. Se Shopify non è disponibile, dichiaralo senza stimare valori.
Usa remember_instruction per regole durevoli espresse con “ricorda”, “da ora in poi”, “sempre” o formulazioni equivalenti. Non salvare richieste temporanee. Usa list_memories e forget_memory quando richiesto.
Le memorie seguenti sono condivise tra gli amministratori e devono orientare le risposte future, salvo conflitto con dati correnti o sicurezza:
${memoryContext}
Quando l'amministratore chiede di scrivere, mandare o inviare una comunicazione, usa prepare_communication. Lo strumento prepara un'anteprima: non dire che è stata inviata finché l'utente non preme Conferma e invia.
Le altre operazioni di scrittura non ancora esposte devono essere indicate come non disponibili, senza simulare risultati.
Usa navigate_app soltanto quando l'utente chiede esplicitamente "apri", "vai" o "portami" a una pagina.
Non mostrare identificativi tecnici, segreti, email, telefoni, dati fiscali o medici. Per una malattia indica solo se risulta giustificata o non giustificata.
Quando elenchi persone o task, usa righe brevi e leggibili.
Quando la risposta riguarda persone in pausa, assenti, in malattia o in ritardo, scrivi soltanto un riepilogo molto breve: l'interfaccia mostrerà automaticamente le schede grafiche, quindi non ripetere in testo l'intero elenco dei nomi.`;

  const input: Array<Record<string, unknown>> = messages.map((message) => ({ role: message.role, content: message.content }));
  const links = new Map<string, { path: string; label: string }>();
  let navigation: { path: string; label: string } | null = null;
  let pendingAction: PendingAction | null = null;
  const cards: AssistantCard[] = [];
  const metrics: AssistantMetric[] = [];

  try {
    for (let round = 0; round < 4; round += 1) {
      const response = await createResponse({
        model: MODEL,
        instructions,
        input,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        store: false,
        max_output_tokens: 900,
        safety_identifier: createHash("sha256").update(session.user.id).digest("hex").slice(0, 32),
      }, apiKey);
      const calls = (response.output || []).filter((item): item is ToolCall => item.type === "function_call") as ToolCall[];
      if (calls.length === 0) {
        const answer = extractOutputText(response) || "Non ho trovato una risposta utile. Prova a riformulare la richiesta.";
        return NextResponse.json({ answer, links: Array.from(links.values()), navigation, pendingAction, cards, metrics });
      }

      input.push(...(response.output || []));
      for (const call of calls) {
        const result = await executeTool(call, session.user.id) as {
          output: unknown;
          link?: { path: string; label: string };
          navigation?: { path: string; label: string };
          pendingAction?: PendingAction;
        };
        if (result.link) links.set(result.link.path, result.link);
        if (result.navigation) navigation = result.navigation;
        if (result.pendingAction) pendingAction = result.pendingAction;
        cards.push(...assistantCards(call.name, result.output, lastUserMessage));
        metrics.push(...assistantMetrics(call.name, result.output));
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.output) });
      }
    }
    return NextResponse.json({ answer: "La richiesta richiede troppi passaggi. Prova a farne una più specifica.", links: Array.from(links.values()), navigation, pendingAction, cards, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Il servizio AI non è disponibile in questo momento.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
