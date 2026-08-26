import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { buildAssistantDateContext, requestedDayPeriod, requestedMonthPeriod } from "@/lib/admin-assistant-date";
import { requiredAssistantTool, requestedTaskStatus, requestedTeamStatus, type TeamStatusScope } from "@/lib/admin-assistant-intent";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
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
  invoices: { path: "/invoices", label: "Fatture" },
  client_control: { path: "/client-control", label: "Controllo Cliente" },
  appointments: { path: "/appointments", label: "Appuntamenti" },
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
    description: "Legge lo stato attuale odierno del personale. Se viene chiesto chi è in pausa, assente, in turno o uscito, imposta il filtro corrispondente e non richiedere l'elenco completo.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["IN_TURNO", "IN_PAUSA", "USCITO", "NON_ENTRATO", null],
          description: "Stato preciso richiesto; null soltanto quando serve davvero il riepilogo completo del personale.",
        },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_task_overview",
    description: "Legge task con filtri precisi per stato, assegnatario e intervallo. Per 'Steven ha completato task oggi?' usa status COMPLETED, employee_name Steven e l'intervallo di oggi.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["NEW", "ACTIVE", "WAITING", "COMPLETED", "OVERDUE", null],
          description: "Filtro opzionale per stato; OVERDUE indica task scadute non completate.",
        },
        employee_name: { type: ["string", "null"], description: "Nome dell'assegnatario; null soltanto per domande collettive." },
        date_from: { type: ["string", "null"], description: "Inizio intervallo ISO incluso; null se non richiesto." },
        date_to: { type: ["string", "null"], description: "Fine intervallo ISO esclusa; null se non richiesto." },
      },
      required: ["status", "employee_name", "date_from", "date_to"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_requests_overview",
    description: "Legge ferie, permessi, riposi, malattie e ritardi in un periodo preciso. Per domande su una persona passa sempre employee_name: in caso di nome ambiguo lo strumento non restituisce dati di altre persone.",
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
        employee_name: { type: ["string", "null"], description: "Nome o parte del nome della persona; null solo per una domanda realmente collettiva." },
        month: { type: ["integer", "null"], minimum: 1, maximum: 12, description: "Mese richiesto; null se non specificato." },
        year: { type: ["integer", "null"], minimum: 2024, maximum: 2100, description: "Anno richiesto; null se non specificato." },
      },
      required: ["type", "pending_only", "employee_name", "month", "year"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_employee_month_overview",
    description: "Controlla come sta andando una persona in un mese: turni pianificati, giornate timbrate, pause, ritardi automatici, ferie, malattie, permessi, task assegnate, documenti caricati e situazione contratto. Usalo per domande come 'come va Aurora questo mese?' o domande mensili su una persona.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        employee_name: { type: "string", description: "Nome o parte del nome della persona." },
        month: { type: "integer", minimum: 1, maximum: 12 },
        year: { type: "integer", minimum: 2024, maximum: 2100 },
      },
      required: ["employee_name", "month", "year"],
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
    name: "get_document_status",
    description: "Verifica documenti del personale realmente caricati: contratti, proroghe/rinnovi, cedolini/buste paga, CUD o altri documenti. Può cercare una persona precisa oppure fare un riepilogo collettivo.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        document_type: { type: "string", enum: ["CONTRATTO", "PROROGA", "BUSTA_PAGA", "CUD", "DOCUMENTO", "ALL"] },
        employee_name: { type: ["string", "null"], description: "Persona da verificare; null per riepilogo collettivo." },
        month: { type: ["integer", "null"], minimum: 1, maximum: 12 },
        year: { type: ["integer", "null"], minimum: 2024, maximum: 2100 },
      },
      required: ["document_type", "employee_name", "month", "year"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_invoice_status",
    description: "Verifica le richieste di fattura di un mese: quante sono da fare, emesse o annullate e il totale degli importi. Usalo per domande sulle fatture, non usare i documenti HR.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        month: { type: "integer", minimum: 1, maximum: 12 },
        year: { type: "integer", minimum: 2024, maximum: 2100 },
        status: { type: ["string", "null"], enum: ["NEW", "EMESSA", "ANNULLATA", null] },
      },
      required: ["month", "year", "status"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_client_controls",
    description: "Cerca e conta le schede Controllo Cliente per cliente, lavoratore e periodo. Restituisce clienti uniche, schede, chi ha lavorato, servizi/prodotti, importi, pagamento, ordine, note, sede e data. Usalo anche per domande come 'quante clienti ha fatto Angelica oggi?', 'quali clienti ha seguito Angelica?' o 'cosa è stato fatto a Maria Rossi?'.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        client_name: { type: ["string", "null"], description: "Nome completo o parte del nome della cliente; null se la domanda riguarda tutte le clienti di un lavoratore." },
        employee_name: { type: ["string", "null"], description: "Lavoratore che ha eseguito il servizio; null se la domanda riguarda soltanto una cliente." },
        month: { type: ["integer", "null"], minimum: 1, maximum: 12 },
        year: { type: ["integer", "null"], minimum: 2024, maximum: 2100 },
        date_from: { type: ["string", "null"], description: "Inizio ISO del periodo preciso, incluso." },
        date_to: { type: ["string", "null"], description: "Fine ISO del periodo preciso, escluso." },
      },
      required: ["client_name", "employee_name", "month", "year", "date_from", "date_to"],
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

async function getTeamStatus(scope: TeamStatusScope | null) {
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

  const filteredPeople = scope ? people.filter((person) => person.status === scope) : people;
  return {
    date: key,
    scope: scope || "ALL",
    count: filteredPeople.length,
    totals: {
      inShift: people.filter((person) => person.status === "IN_TURNO").length,
      onBreak: people.filter((person) => person.status === "IN_PAUSA").length,
      exited: people.filter((person) => person.status === "USCITO").length,
      notEntered: people.filter((person) => person.status === "NON_ENTRATO").length,
    },
    people: filteredPeople,
  };
}

async function getTaskOverview(status: string | null, employeeName: string | null, dateFrom: string | null, dateTo: string | null) {
  const now = new Date();
  const resolved = employeeName ? await resolveEmployee(employeeName) : null;
  if (resolved && !resolved.employee) {
    return { count: 0, tasks: [], error: resolved.error, candidates: resolved.candidates, requestedEmployee: employeeName };
  }
  const start = dateFrom ? new Date(dateFrom) : null;
  const end = dateTo ? new Date(dateTo) : null;
  const validPeriod = start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end
    ? { start, end }
    : null;
  const baseWhere: Prisma.StaffTaskWhereInput = resolved?.employee ? { assignees: { some: { id: resolved.employee.id } } } : {};
  const statusWhere: Prisma.StaffTaskWhereInput = status === "OVERDUE"
    ? { status: { not: "COMPLETED" }, due_date: { lt: now } }
    : status
      ? { status }
      : {};
  const periodWhere: Prisma.StaffTaskWhereInput = validPeriod
    ? status === "COMPLETED"
      ? { completed_at: { gte: validPeriod.start, lt: validPeriod.end } }
      : { updated_at: { gte: validPeriod.start, lt: validPeriod.end } }
    : {};
  const where: Prisma.StaffTaskWhereInput = { ...baseWhere, ...statusWhere, ...periodWhere };
  const [groups, recent] = await Promise.all([
    prisma.staffTask.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    prisma.staffTask.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
        completed_at: true,
        updated_at: true,
        location: { select: { name: true } },
        assignees: { select: { name: true } },
      },
      orderBy: [{ due_date: "asc" }, { updated_at: "desc" }],
      take: 20,
    }),
  ]);

  return {
    count: recent.length,
    requestedEmployee: resolved?.employee?.name || null,
    period: validPeriod ? { from: validPeriod.start.toISOString(), to: validPeriod.end.toISOString() } : null,
    totals: Object.fromEntries(groups.map((group) => [group.status, group._count._all])),
    overdue: await prisma.staffTask.count({ where: { ...baseWhere, status: { not: "COMPLETED" }, due_date: { lt: now } } }),
    tasks: recent.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date?.toISOString() || null,
      completedAt: task.completed_at?.toISOString() || null,
      location: task.location.name,
      assignees: task.assignees.map((person) => person.name),
    })),
  };
}

async function resolveEmployee(employeeName: string) {
  const query = employeeName.trim().slice(0, 100);
  if (query.length < 2) return { employee: null, error: "Indica almeno due lettere del nome.", candidates: [] as string[] };
  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      employee_status: { not: "Ex dipendente", mode: "insensitive" },
      name: { contains: query, mode: "insensitive" },
    },
    select: { id: true, name: true, photo_url: true, contract_start: true, contract_end: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 8,
  });
  const normalized = query.toLocaleLowerCase("it");
  const exact = candidates.find((candidate) => candidate.name.trim().toLocaleLowerCase("it") === normalized);
  const employee = exact || (candidates.length === 1 ? candidates[0] : null);
  if (employee) return { employee, error: null, candidates: [] as string[] };
  return {
    employee: null,
    error: candidates.length ? "Nome ambiguo: specifica il nome completo." : `Nessun lavoratore attivo trovato per “${query}”.`,
    candidates: candidates.map((candidate) => candidate.name),
  };
}

async function mentionedEmployeeName(text: string) {
  const normalizedText = text.toLocaleLowerCase("it");
  const workers = await prisma.user.findMany({
    where: activeStaffWhere(),
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const fullMatches = workers.filter((worker) => normalizedText.includes(worker.name.toLocaleLowerCase("it")));
  if (fullMatches.length === 1) return fullMatches[0].name;
  const firstNameMatches = workers.filter((worker) => {
    const firstName = worker.name.trim().split(/\s+/)[0]?.toLocaleLowerCase("it");
    return firstName && new RegExp(`(^|[^a-zà-öø-ÿ])${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-öø-ÿ]|$)`, "i").test(normalizedText);
  });
  return firstNameMatches.length === 1 ? firstNameMatches[0].name : null;
}

function monthBounds(month: number, year: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

async function getRequestsOverview(type: string | null, pendingOnly: boolean, employeeName: string | null, month: number | null, year: number | null) {
  const resolved = employeeName ? await resolveEmployee(employeeName) : null;
  if (resolved && !resolved.employee) {
    return { count: 0, requests: [], error: resolved.error, candidates: resolved.candidates, requestedEmployee: employeeName };
  }
  const since = new Date();
  since.setDate(since.getDate() - 45);
  const period = month && year ? monthBounds(month, year) : null;
  const where: Prisma.LeaveRequestWhereInput = {
    ...(pendingOnly
      ? { status: "PENDING" }
      : period
        ? { start_date: { lt: period.end }, end_date: { gte: period.start } }
        : { OR: [{ status: "PENDING" }, { end_date: { gte: since } }] }),
    ...(resolved?.employee ? { user_id: resolved.employee.id } : {}),
    ...(type === "RITARDO"
      ? { type: "PERMESSO", reason: { startsWith: "RITARDO AUTOMATICO — " } }
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
    requestedEmployee: resolved?.employee?.name || null,
    period: period ? { month, monthName: monthName(month!), year } : null,
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

async function getEmployeeMonthOverview(employeeName: string, month: number, year: number) {
  const resolved = await resolveEmployee(employeeName);
  if (!resolved.employee) return { found: false, error: resolved.error, candidates: resolved.candidates, requestedEmployee: employeeName };
  const employee = resolved.employee;
  const { start, end } = monthBounds(month, year);
  const [schedule, attendance, requests, tasks, documents] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { user_id: employee.id, date: { gte: start, lt: end } },
      select: { date: true, start_time: true, end_time: true, category: { select: { name: true, code: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.attendanceLog.findMany({
      where: { user_id: employee.id, date: { gte: start, lt: end } },
      select: { date: true, type: true, time: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { user_id: employee.id, start_date: { lt: end }, end_date: { gte: start } },
      select: { id: true, type: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true, reason: true, medical_code: true, sickness_unjustified: true },
      orderBy: { start_date: "desc" },
    }),
    prisma.staffTask.findMany({
      where: {
        assignees: { some: { id: employee.id } },
        OR: [{ status: { not: "COMPLETED" } }, { completed_at: { gte: start, lt: end } }, { updated_at: { gte: start, lt: end } }],
      },
      select: { id: true, title: true, status: true, due_date: true, completed_at: true },
      orderBy: { updated_at: "desc" },
      take: 20,
    }),
    prisma.document.findMany({
      where: {
        user_id: employee.id,
        OR: [
          { created_at: { gte: start, lt: end } },
          { month, year },
        ],
      },
      select: { id: true, title: true, type: true, month: true, year: true, document_date: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
  ]);
  const entryDays = new Set(attendance.filter((log) => log.type === "ENTRATA").map((log) => log.date.toISOString().slice(0, 10)));
  const lateRequests = requests.filter((request) => request.reason?.startsWith("RITARDO AUTOMATICO — "));
  const requestSummary = requests.reduce<Record<string, number>>((summary, request) => {
    const key = request.reason?.startsWith("RITARDO AUTOMATICO — ") ? "RITARDO" : request.type;
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
  const taskSummary = tasks.reduce<Record<string, number>>((summary, task) => {
    summary[task.status] = (summary[task.status] || 0) + 1;
    return summary;
  }, {});

  return {
    found: true,
    employee: { name: employee.name, photoUrl: employee.photo_url, location: employee.location?.name || "Nessuna sede" },
    period: { month, monthName: monthName(month), year },
    attendance: {
      plannedDays: schedule.length,
      clockedInDays: entryDays.size,
      breakStarts: attendance.filter((log) => log.type === "PAUSA").length,
      lateCount: lateRequests.length,
    },
    requestSummary,
    requests: requests.map((request) => ({
      id: request.id,
      person: employee.name,
      photoUrl: employee.photo_url,
      location: employee.location?.name || "Nessuna sede",
      type: request.reason?.startsWith("RITARDO AUTOMATICO — ") ? "RITARDO" : request.type,
      status: request.status,
      from: request.start_date.toISOString(),
      to: request.end_date.toISOString(),
      time: request.start_time || request.end_time ? `${request.start_time || ""}-${request.end_time || ""}` : null,
      reason: request.reason,
      justified: request.type === "MALATTIA" ? Boolean(request.medical_code) && !request.sickness_unjustified : null,
    })),
    tasks: { total: tasks.length, byStatus: taskSummary, items: tasks.map((task) => ({ title: task.title, status: task.status, dueDate: task.due_date?.toISOString() || null })) },
    documents: { count: documents.length, byType: documents.reduce<Record<string, number>>((summary, document) => ({ ...summary, [document.type]: (summary[document.type] || 0) + 1 }), {}) },
    contract: { start: employee.contract_start?.toISOString() || null, end: employee.contract_end?.toISOString() || null },
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

async function getDocumentStatus(documentType: string, employeeName: string | null, month: number | null, year: number | null) {
  const resolved = employeeName ? await resolveEmployee(employeeName) : null;
  if (resolved && !resolved.employee) {
    return { count: 0, documents: [], error: resolved.error, candidates: resolved.candidates, requestedEmployee: employeeName };
  }
  const normalizedTypes = documentType === "ALL"
    ? undefined
    : documentType === "PROROGA"
      ? ["PROROGA", "RINNOVO"]
      : [documentType];
  const period = month && year ? monthBounds(month, year) : null;
  const isPeriodDocument = documentType === "BUSTA_PAGA" || documentType === "CUD";
  const where: Prisma.DocumentWhereInput = {
    ...(resolved?.employee ? { user_id: resolved.employee.id } : {}),
    ...(normalizedTypes ? { type: { in: normalizedTypes } } : {}),
    ...(period
      ? isPeriodDocument
        ? { month, year }
        : { created_at: { gte: period.start, lt: period.end } }
      : year && documentType === "CUD"
        ? { year }
        : {}),
  };
  const documents = await prisma.document.findMany({
    where,
    select: { id: true, title: true, type: true, month: true, year: true, document_date: true, created_at: true, user_id: true, user: { select: { name: true, photo_url: true, location: { select: { name: true } } } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { created_at: "desc" }],
    take: 100,
  });
  const byType = documents.reduce<Record<string, number>>((summary, document) => {
    summary[document.type] = (summary[document.type] || 0) + 1;
    return summary;
  }, {});
  const peopleWithDocument = new Set(documents.map((document) => document.user_id));
  const shouldCalculateCoverage = !employeeName && ["BUSTA_PAGA", "CUD", "CONTRATTO"].includes(documentType);
  const workers = shouldCalculateCoverage
    ? await prisma.user.findMany({ where: activeStaffWhere(), select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const missingPeople = workers.filter((worker) => !peopleWithDocument.has(worker.id)).map((worker) => worker.name);
  return {
    requestedEmployee: resolved?.employee?.name || null,
    documentType,
    period: month && year ? { month, monthName: monthName(month), year } : year ? { year } : null,
    count: documents.length,
    byType,
    coverage: shouldCalculateCoverage ? { total: workers.length, withDocument: workers.length - missingPeople.length, missing: missingPeople.length } : null,
    missingPeople,
    documents: documents.slice(0, 30).map((document) => ({
      title: document.title,
      type: document.type,
      person: document.user.name,
      location: document.user.location?.name || "Nessuna sede",
      month: document.month,
      year: document.year,
      date: (document.document_date || document.created_at).toISOString(),
    })),
  };
}

async function getInvoiceStatus(month: number, year: number, status: string | null) {
  const { start, end } = monthBounds(month, year);
  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      created_at: { gte: start, lt: end },
      ...(status ? { status } : {}),
      form: { name: { contains: "fattura", mode: "insensitive" } },
    },
    select: { id: true, status: true, created_at: true, answers: true, user_location_name: true, user: { select: { name: true } } },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  const byStatus = responses.reduce<Record<string, number>>((summary, response) => {
    summary[response.status] = (summary[response.status] || 0) + 1;
    return summary;
  }, {});
  const amount = responses.reduce((sum, response) => {
    const answers = response.answers && typeof response.answers === "object" && !Array.isArray(response.answers) ? response.answers as Record<string, unknown> : {};
    const parsed = Number.parseFloat(String(answers.invoice_amount || "0").replace(",", "."));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return {
    period: { month, monthName: monthName(month), year },
    requestedStatus: status,
    count: responses.length,
    byStatus,
    totalAmount: amount,
    invoices: responses.slice(0, 20).map((response) => {
      const answers = response.answers && typeof response.answers === "object" && !Array.isArray(response.answers) ? response.answers as Record<string, unknown> : {};
      return {
        id: response.id,
        status: response.status,
        date: response.created_at.toISOString(),
        client: String(answers.invoice_client_name || "Cliente non indicato"),
        amount: Number.parseFloat(String(answers.invoice_amount || "0").replace(",", ".")) || 0,
        location: response.user_location_name || "Nessuna sede",
        operator: response.user.name,
      };
    }),
  };
}

function answerNames(value: unknown) {
  const values = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return values.map((item) => {
    if (typeof item === "string" || typeof item === "number") return String(item).trim();
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      return String(record.name || record.label || record.value || "").trim();
    }
    return "";
  }).filter(Boolean);
}

function answerMoney(value: unknown) {
  const raw = String(value ?? "0").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function searchClientControls(
  clientName: string,
  employeeName: string | null,
  month: number | null,
  year: number | null,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const query = clientName.trim().toLocaleLowerCase("it").slice(0, 120);
  if (query && query.length < 2) return { count: 0, uniqueClientCount: 0, controls: [], error: "Indica almeno due lettere del nome cliente." };
  const resolved = employeeName ? await resolveEmployee(employeeName) : null;
  if (resolved && !resolved.employee) {
    return { count: 0, uniqueClientCount: 0, controls: [], error: resolved.error, candidates: resolved.candidates, requestedEmployee: employeeName };
  }
  if (!query && !resolved?.employee) {
    return { count: 0, uniqueClientCount: 0, controls: [], error: "Indica il nome della cliente oppure della lavoratrice." };
  }
  const exactPeriod = dateFrom && dateTo ? { start: new Date(dateFrom), end: new Date(dateTo) } : null;
  const validExactPeriod = exactPeriod && Number.isFinite(exactPeriod.start.getTime()) && Number.isFinite(exactPeriod.end.getTime())
    ? exactPeriod
    : null;
  const monthPeriod = month && year ? monthBounds(month, year) : null;
  const period = validExactPeriod || monthPeriod;
  const now = new Date();
  const defaultAppointmentStart = new Date(now);
  defaultAppointmentStart.setUTCDate(defaultAppointmentStart.getUTCDate() - 90);
  const defaultAppointmentEnd = new Date(now);
  defaultAppointmentEnd.setUTCDate(defaultAppointmentEnd.getUTCDate() + 31);
  const appointmentPeriod = period || { start: defaultAppointmentStart, end: defaultAppointmentEnd };
  const [responses, appointmentSettings, rawBookings] = await Promise.all([
    prisma.serviceFormResponse.findMany({
      where: {
        ...(period ? { created_at: { gte: period.start, lt: period.end } } : {}),
        form: { name: { contains: "controllo cliente", mode: "insensitive" } },
      },
      select: { id: true, status: true, created_at: true, updated_at: true, answers: true, user_location_name: true, user: { select: { name: true } } },
      orderBy: { created_at: "desc" },
      take: 1000,
    }),
    prisma.setting.findMany({
      where: { key: { in: ["appointment_status_overrides", "appointment_team_overrides"] } },
      select: { key: true, value: true },
    }),
    hasCowlendarToken()
      ? getCowlendarBookingsForRange({
          startDate: appointmentPeriod.start.toISOString(),
          endDate: appointmentPeriod.end.toISOString(),
          limit: 5000,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const matches = responses.filter((response) => {
    const answers = response.answers && typeof response.answers === "object" && !Array.isArray(response.answers) ? response.answers as Record<string, unknown> : {};
    const matchesClient = !query || String(answers.client_control_client_name || "").trim().toLocaleLowerCase("it").includes(query);
    const workerName = resolved?.employee?.name.trim().toLocaleLowerCase("it") || "";
    const involvedStaff = [
      ...answerNames(answers.client_control_service_owner),
      ...answerNames(answers.client_control_service_staff),
    ].map((name) => name.toLocaleLowerCase("it"));
    const matchesEmployee = !workerName || involvedStaff.some((name) => name === workerName || name.includes(workerName) || workerName.includes(name));
    return matchesClient && matchesEmployee;
  });
  const uniqueClients = Array.from(new Set(matches
    .map((response) => {
      const answers = response.answers as Record<string, unknown>;
      return String(answers.client_control_client_name || "").trim().toLocaleLowerCase("it");
    })
    .filter(Boolean)));
  const settingValue = (key: string) => {
    const value = appointmentSettings.find((setting) => setting.key === key)?.value;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  };
  const statusOverrides = settingValue("appointment_status_overrides");
  const teamOverrides = settingValue("appointment_team_overrides");
  const linkedControlByBooking = new Map(matches.flatMap((response) => {
    const answers = response.answers as Record<string, unknown>;
    const bookingId = String(answers.booking_id || "").trim();
    return bookingId ? [[bookingId, response.id] as const] : [];
  }));
  const workerName = resolved?.employee?.name.trim().toLocaleLowerCase("it") || "";
  const appointments = (rawBookings || []).flatMap((booking) => {
    if (booking.is_canceled) return [];
    const bookingId = String(booking.id);
    const customerName = booking.customer?.name?.trim()
      || [booking.form_data?.firstname, booking.form_data?.lastname]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ")
      || "Cliente non indicato";
    const overriddenTeam = Array.isArray(teamOverrides[bookingId]?.teammates)
      ? teamOverrides[bookingId].teammates.map((mate: Record<string, unknown>) => String(mate.name || "").trim()).filter(Boolean)
      : [];
    const cowlendarTeam = (booking.teammates || [])
      .map((mate) => `${mate.firstname || ""} ${mate.lastname || ""}`.trim())
      .filter(Boolean);
    const teammates: string[] = overriddenTeam.length ? overriddenTeam : cowlendarTeam;
    const matchesClient = !query || customerName.toLocaleLowerCase("it").includes(query);
    const matchesEmployee = !workerName || teammates.some((name) => {
      const normalizedName = name.toLocaleLowerCase("it");
      return normalizedName === workerName || normalizedName.includes(workerName) || workerName.includes(normalizedName);
    });
    if (!matchesClient || !matchesEmployee) return [];
    const localStatus = String(statusOverrides[bookingId]?.status || "").toUpperCase();
    const linkedControlId = linkedControlByBooking.get(bookingId) || null;
    const completed = Boolean(linkedControlId) || ["COMPLETATO", "PAGATO"].includes(localStatus);
    return [{
      id: bookingId,
      client: customerName,
      date: booking.start_date,
      endDate: booking.end_date || null,
      service: booking.service?.title || "Servizio non specificato",
      teammates,
      status: localStatus || booking.attendance || booking.confirmation_status || "PRENOTATO",
      completed,
      linkedControlId,
      price: Number(booking.price?.amount || 0),
    }];
  });
  const completedAppointmentClients = appointments.filter((appointment) => appointment.completed).map((appointment) => appointment.client);
  const workedClientNames = Array.from(new Set([...uniqueClients, ...completedAppointmentClients.map((name) => name.trim().toLocaleLowerCase("it"))].filter(Boolean)));
  return {
    requestedClient: clientName.trim() || null,
    requestedEmployee: resolved?.employee?.name || null,
    period: validExactPeriod
      ? { from: validExactPeriod.start.toISOString(), to: validExactPeriod.end.toISOString() }
      : monthPeriod
        ? { month, monthName: monthName(month!), year }
        : null,
    count: matches.length,
    uniqueClientCount: uniqueClients.length,
    workedClientCount: workedClientNames.length,
    appointmentCount: appointments.length,
    completedAppointmentCount: appointments.filter((appointment) => appointment.completed).length,
    linkedAppointmentCount: appointments.filter((appointment) => appointment.linkedControlId).length,
    appointmentsAvailable: Array.isArray(rawBookings),
    totalPaid: matches.reduce((total, response) => {
      const answers = response.answers as Record<string, unknown>;
      return total + answerMoney(answers.client_control_paid || answers.client_control_declared_paid);
    }, 0),
    controls: matches.slice(0, 30).map((response) => {
      const answers = response.answers as Record<string, unknown>;
      return {
        id: response.id,
        client: String(answers.client_control_client_name || "Cliente non indicato"),
        date: response.created_at.toISOString(),
        updatedAt: response.updated_at.toISOString(),
        status: response.status,
        location: String(answers.client_control_location || response.user_location_name || "Nessuna sede"),
        serviceOwner: answerNames(answers.client_control_service_owner),
        serviceStaff: answerNames(answers.client_control_service_staff),
        productsOrServices: answerNames(answers.client_control_products_list || answers.client_control_service_title || answers.service_title),
        paid: answerMoney(answers.client_control_paid || answers.client_control_declared_paid),
        depositPaid: answerMoney(answers.client_control_deposit_paid),
        paymentMethod: String(answers.client_control_payment_method || answers.client_control_declared_payment_method || "Non indicato"),
        paymentVerified: Boolean(answers.client_control_payment_verified),
        shopifyOrder: String(answers.client_control_shopify_order || ""),
        notes: String(answers.client_control_notes_text || answers.client_control_shopify_order_note || ""),
        submittedBy: response.user.name,
      };
    }),
    appointments: appointments.slice(0, 30),
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

  if ((toolName === "get_requests_overview" || toolName === "get_employee_month_overview") && Array.isArray(data.requests)) {
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

  if (toolName === "get_task_overview" && Array.isArray(data.tasks)) {
    return (data.tasks as Array<Record<string, unknown>>).slice(0, 20).map((task, index) => ({
      id: String(task.id || `task-${index}`),
      person: String(data.requestedEmployee || (Array.isArray(task.assignees) ? task.assignees.join(", ") : "Team")),
      photoUrl: null,
      status: String(task.status || "Task"),
      type: "Task",
      location: String(task.location || "Nessuna sede"),
      date: typeof task.completedAt === "string" ? task.completedAt : typeof task.dueDate === "string" ? task.dueDate : null,
      time: null,
      detail: String(task.title || "Task senza titolo"),
      tone: task.status === "COMPLETED" ? "green" : task.status === "ACTIVE" ? "blue" : "amber",
    }));
  }

  if (toolName === "search_client_controls" && Array.isArray(data.controls)) {
    const controlCards = (data.controls as Array<Record<string, unknown>>).slice(0, 20).map<AssistantCard>((control, index) => {
      const staff = Array.isArray(control.serviceStaff) ? control.serviceStaff.join(", ") : "Personale non indicato";
      const services = Array.isArray(control.productsOrServices) ? control.productsOrServices.join(", ") : "Servizio non specificato";
      return {
        id: String(control.id || `client-control-${index}`),
        person: String(control.client || "Cliente"),
        photoUrl: null,
        status: "Controllo registrato",
        type: services,
        location: String(control.location || "Nessuna sede"),
        date: typeof control.date === "string" ? control.date : null,
        time: null,
        detail: `Personale: ${staff} · Pagato: ${euroMetric(control.paid)}`,
        tone: "violet",
      };
    });
    const appointmentCards = (Array.isArray(data.appointments) ? data.appointments as Array<Record<string, unknown>> : [])
      .filter((appointment) => !appointment.linkedControlId)
      .slice(0, Math.max(0, 20 - controlCards.length))
      .map((appointment, index) => ({
        id: String(appointment.id || `appointment-${index}`),
        person: String(appointment.client || "Cliente"),
        photoUrl: null,
        status: appointment.completed ? "Appuntamento completato" : String(appointment.status || "Appuntamento"),
        type: String(appointment.service || "Servizio non specificato"),
        location: "Appuntamenti",
        date: typeof appointment.date === "string" ? appointment.date : null,
        time: null,
        detail: `Personale: ${Array.isArray(appointment.teammates) ? appointment.teammates.join(", ") : "Non assegnato"}`,
        tone: appointment.completed ? "green" as const : "blue" as const,
      }));
    return [...controlCards, ...appointmentCards];
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
  if (toolName === "get_employee_month_overview" && data.found) {
    return [
      { id: "employee-planned", label: "Turni pianificati", value: String(data.attendance?.plannedDays || 0), detail: `${data.period?.monthName || "Mese"} ${data.period?.year || ""}`, tone: "blue" },
      { id: "employee-clocked", label: "Giorni timbrati", value: String(data.attendance?.clockedInDays || 0), detail: `${data.attendance?.breakStarts || 0} pause iniziate`, tone: "green" },
      { id: "employee-late", label: "Ritardi", value: String(data.attendance?.lateCount || 0), detail: "Rilevati nel periodo", tone: data.attendance?.lateCount ? "amber" : "green" },
      { id: "employee-tasks", label: "Task collegate", value: String(data.tasks?.total || 0), detail: `${data.tasks?.byStatus?.COMPLETED || 0} completate`, tone: "violet" },
    ];
  }
  if (toolName === "get_document_status") {
    return [
      { id: "documents-count", label: "Documenti trovati", value: String(data.count || 0), detail: data.requestedEmployee || data.documentType || "Archivio", tone: data.count ? "green" : "amber" },
      ...(data.coverage ? [{ id: "documents-coverage", label: "Copertura personale", value: `${data.coverage.withDocument || 0}/${data.coverage.total || 0}`, detail: `${data.coverage.missing || 0} mancanti`, tone: data.coverage.missing ? "amber" as const : "green" as const }] : []),
    ];
  }
  if (toolName === "get_invoice_status") {
    return [
      { id: "invoices-total", label: "Richieste fattura", value: String(data.count || 0), detail: `${data.period?.monthName || "Mese"} ${data.period?.year || ""}`, tone: "blue" },
      { id: "invoices-issued", label: "Fatture emesse", value: String(data.byStatus?.EMESSA || 0), detail: `${data.byStatus?.NEW || 0} da fare`, tone: data.byStatus?.NEW ? "amber" : "green" },
      { id: "invoices-amount", label: "Importo totale", value: euroMetric(data.totalAmount), detail: data.requestedStatus || "Tutti gli stati", tone: "violet" },
    ];
  }
  if (toolName === "search_client_controls") {
    return [
      { id: "client-controls-unique", label: "Clienti lavorate", value: String(data.workedClientCount || 0), detail: data.requestedEmployee || data.requestedClient || "Controllo Cliente + Appuntamenti", tone: "violet" },
      { id: "client-controls-records", label: "Schede registrate", value: String(data.count || 0), detail: "Nel periodo richiesto", tone: "blue" },
      { id: "client-controls-appointments", label: "Appuntamenti", value: data.appointmentsAvailable ? String(data.appointmentCount || 0) : "Non disponibili", detail: `${data.completedAppointmentCount || 0} completati`, tone: data.appointmentsAvailable ? "blue" : "amber" },
      { id: "client-controls-paid", label: "Totale registrato", value: euroMetric(data.totalPaid), detail: "Somma dei pagamenti nelle schede", tone: "green" },
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

async function executeTool(
  call: ToolCall,
  actorId: string,
  impliedTeamScope: TeamStatusScope | null,
  impliedMonthPeriod: { month: number; year: number } | null,
  impliedDayPeriod: { day: string; start: string; end: string } | null,
  impliedTaskStatus: string | null,
  impliedEmployeeName: string | null,
) {
  const args = safeJson(call.arguments);
  if (call.name === "remember_instruction") return rememberInstruction(args, actorId);
  if (call.name === "list_memories") return listMemories(args);
  if (call.name === "forget_memory") return forgetMemory(args, actorId);
  if (call.name === "prepare_communication") return prepareCommunication(args, actorId);
  if (call.name === "get_team_status") {
    const requestedScope = typeof args.status === "string" && ["IN_TURNO", "IN_PAUSA", "USCITO", "NON_ENTRATO"].includes(args.status)
      ? args.status as TeamStatusScope
      : null;
    return { output: await getTeamStatus(impliedTeamScope || requestedScope) };
  }
  if (call.name === "get_task_overview") {
    const status = impliedTaskStatus || (typeof args.status === "string" ? args.status : null);
    const employeeName = impliedEmployeeName || (typeof args.employee_name === "string" ? args.employee_name : null);
    const dateFrom = impliedDayPeriod?.start || (typeof args.date_from === "string" ? args.date_from : null);
    const dateTo = impliedDayPeriod?.end || (typeof args.date_to === "string" ? args.date_to : null);
    return { output: await getTaskOverview(status, employeeName, dateFrom, dateTo), link: APP_PAGES.tasks };
  }
  if (call.name === "get_requests_overview") {
    const type = typeof args.type === "string" ? args.type : null;
    const link = type === "MALATTIA" ? APP_PAGES.sickness : APP_PAGES.requests;
    const employeeName = impliedEmployeeName || (typeof args.employee_name === "string" ? args.employee_name : null);
    const month = impliedMonthPeriod?.month ?? (Number.isInteger(args.month) ? Number(args.month) : null);
    const year = impliedMonthPeriod?.year ?? (Number.isInteger(args.year) ? Number(args.year) : null);
    return { output: await getRequestsOverview(type, args.pending_only === true, employeeName, month, year), link };
  }
  if (call.name === "get_employee_month_overview") {
    const employeeName = impliedEmployeeName || String(args.employee_name || "").trim();
    const month = impliedMonthPeriod?.month ?? Math.min(12, Math.max(1, Number(args.month) || new Date().getMonth() + 1));
    const year = impliedMonthPeriod?.year ?? Math.min(2100, Math.max(2024, Number(args.year) || new Date().getFullYear()));
    return { output: await getEmployeeMonthOverview(employeeName, month, year), link: APP_PAGES.staff };
  }
  if (call.name === "get_schedule_month_status") {
    const month = impliedMonthPeriod?.month ?? Math.min(12, Math.max(1, Number(args.month) || new Date().getMonth() + 1));
    const year = impliedMonthPeriod?.year ?? Math.min(2100, Math.max(2024, Number(args.year) || new Date().getFullYear()));
    return { output: await getScheduleMonthStatus(month, year), link: APP_PAGES.schedules };
  }
  if (call.name === "get_payslip_month_status") {
    const month = impliedMonthPeriod?.month ?? (Number.isInteger(args.month) ? Number(args.month) : null);
    const year = impliedMonthPeriod?.year ?? (Number.isInteger(args.year) ? Number(args.year) : null);
    return { output: await getPayslipMonthStatus(month, year), link: APP_PAGES.payslips };
  }
  if (call.name === "get_document_status") {
    const documentType = typeof args.document_type === "string" ? args.document_type : "ALL";
    const employeeName = impliedEmployeeName || (typeof args.employee_name === "string" ? args.employee_name : null);
    const month = impliedMonthPeriod?.month ?? (Number.isInteger(args.month) ? Number(args.month) : null);
    const year = impliedMonthPeriod?.year ?? (Number.isInteger(args.year) ? Number(args.year) : null);
    return { output: await getDocumentStatus(documentType, employeeName, month, year), link: APP_PAGES.documents };
  }
  if (call.name === "get_invoice_status") {
    const month = impliedMonthPeriod?.month ?? Math.min(12, Math.max(1, Number(args.month) || new Date().getMonth() + 1));
    const year = impliedMonthPeriod?.year ?? Math.min(2100, Math.max(2024, Number(args.year) || new Date().getFullYear()));
    const status = typeof args.status === "string" ? args.status : null;
    return { output: await getInvoiceStatus(month, year, status), link: APP_PAGES.invoices };
  }
  if (call.name === "search_client_controls") {
    const employeeName = impliedEmployeeName || (typeof args.employee_name === "string" ? args.employee_name.trim() : null);
    const rawClientName = typeof args.client_name === "string" ? args.client_name.trim() : "";
    const clientName = employeeName && rawClientName.toLocaleLowerCase("it") === employeeName.toLocaleLowerCase("it") ? "" : rawClientName;
    const month = impliedMonthPeriod?.month ?? (Number.isInteger(args.month) ? Number(args.month) : null);
    const year = impliedMonthPeriod?.year ?? (Number.isInteger(args.year) ? Number(args.year) : null);
    const dateFrom = impliedDayPeriod?.start || (typeof args.date_from === "string" ? args.date_from : null);
    const dateTo = impliedDayPeriod?.end || (typeof args.date_to === "string" ? args.date_to : null);
    return { output: await searchClientControls(clientName, employeeName, month, year, dateFrom, dateTo), link: APP_PAGES.client_control };
  }
  if (call.name === "get_cash_overview") {
    const month = impliedMonthPeriod?.month ?? (Number.isInteger(args.month) ? Math.min(12, Math.max(1, Number(args.month))) : null);
    const year = impliedMonthPeriod?.year ?? (Number.isInteger(args.year) ? Math.min(2100, Math.max(2024, Number(args.year))) : null);
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

  const dateContext = buildAssistantDateContext();
  const impliedMonthPeriod = requestedMonthPeriod(lastUserMessage, dateContext);
  const impliedDayPeriod = requestedDayPeriod(lastUserMessage, dateContext);
  const impliedTaskStatus = requestedTaskStatus(lastUserMessage);
  const impliedEmployeeName = await mentionedEmployeeName(lastUserMessage);
  const requiredTool = requiredAssistantTool(lastUserMessage);
  const instructions = `Sei Paradise Assistant, assistente operativo interno di Paradise Beauty.
DATA AUTORITATIVA DEL SERVER (non usare la data interna del modello): oggi ${dateContext.todayLabel}, ISO ${dateContext.today}, fuso ${dateContext.timeZone}; ieri ${dateContext.yesterday}; domani ${dateContext.tomorrow}; settimana corrente ${dateContext.weekStart} - ${dateContext.weekEnd}; mese corrente ${dateContext.currentMonthName} ${dateContext.currentYear}; mese precedente ${dateContext.previousMonthName} ${dateContext.previousMonthYear}.
Rispondi in italiano, in modo sintetico e concreto. La persona autenticata è un amministratore.
Usa sempre gli strumenti per domande su presenze, pause, task, ferie, permessi, malattie e ritardi: non inventare dati.
PRECISIONE OBBLIGATORIA: se la domanda contiene il nome di una persona, usa uno strumento con employee_name e non presentare mai risultati di altre persone come risposta. Se lo strumento restituisce nome ambiguo, candidati o persona non trovata, fermati e chiedi di scegliere/specificare: non concludere che non esistono dati.
Per domande come “come va [persona] questo mese?”, “ha fatto ritardi?”, “quanti turni ha fatto?” o riepiloghi mensili individuali usa get_employee_month_overview. Per una singola categoria puoi usare get_requests_overview, sempre con employee_name e mese/anno quando citati.
Per le task cerca sempre nel database. Domande come “Steven ha completato task oggi?” richiedono get_task_overview con employee_name, status COMPLETED e intervallo di oggi; usa completedAt, non updatedAt, per stabilire se una task è stata completata nel giorno richiesto.
“In pausa” significa esclusivamente chi risulta in pausa in questo momento dall'ultima timbratura odierna: non comprende chi ha già concluso una pausa. Per queste domande usa get_team_status con status IN_PAUSA. Analogamente filtra IN_TURNO, NON_ENTRATO o USCITO quando richiesto e non elencare mai gli altri stati.
Una domanda breve di seguito come “chi sono?”, “quali?” o “dimmi i nomi” si riferisce alla categoria appena discussa, non a tutto il personale.
Usa get_schedule_month_status per domande sulla turnistica o sul planning di un mese. Usa get_payslip_month_status per verificare se i cedolini sono stati caricati; indica sempre il mese e l'anno effettivamente controllati e se il periodo è stato dedotto automaticamente.
Usa get_document_status per contratti, proroghe/rinnovi, cedolini/buste paga, CUD e documenti HR. “Cedolino” e “busta paga” corrispondono a BUSTA_PAGA; proroga e rinnovo corrispondono a PROROGA. Usa get_invoice_status per fatture emesse/da fare/annullate e non confondere le fatture con i documenti del personale.
Usa search_client_controls quando viene nominata una cliente o viene chiesto chi ha lavorato su una cliente, cosa è stato fatto, prodotti/servizi, pagamento, ordine o note. Lo strumento collega Controllo Cliente e Appuntamenti tramite booking_id e stato completato. Usalo anche per conteggi e riepiloghi del lavoro clienti di una dipendente, per esempio “quante clienti ha fatto Angelica oggi?”, “quali clienti ha seguito Angelica?” o “quanto ha incassato Angelica con le sue clienti?”. In questi casi employee_name è la lavoratrice e client_name deve essere null. Per “quante clienti ha fatto” usa workedClientCount; uniqueClientCount conta le clienti con scheda Controllo Cliente, appointmentCount conta tutti gli appuntamenti compatibili e completedAppointmentCount soltanto quelli completati. Non presentare una semplice prenotazione come lavoro svolto. Se appointmentsAvailable è false, dichiaralo. Non mostrare email o telefono della cliente.
Usa get_cash_overview per qualsiasi domanda su cassa, cash disponibile, chiusure, fondo, prelievi, versamenti o scostamenti. Distingui sempre disponibilità del periodo aperto, dichiarato del mese e contanti attesi da Shopify. Se Shopify non è disponibile, dichiaralo senza stimare valori.
Se l'amministratore chiede “cosa posso chiederti?”, “che domande posso farti?” o chiede esempi, presenta un elenco ordinato e realistico con queste categorie ed esempi:
- Presenze ora: chi è in pausa, in turno, uscito o non entrato.
- Persona e mese: come va Aurora questo mese; ha fatto ritardi; quanti turni e giornate timbrate; ferie, malattie e permessi.
- Planning: è stata caricata la turnistica di ottobre; chi manca dal planning.
- Task: come stanno andando; quali sono scadute, attive o completate.
- Documenti HR: è caricato il contratto di una persona; ci sono proroghe/rinnovi; sono caricati cedolini/buste paga del mese; chi manca; è presente il CUD.
- Fatture: quante richieste ci sono questo mese; quante fatture sono state emesse o sono ancora da fare; importo totale.
- Controllo Cliente: chi ha lavorato sulla cliente X; cosa è stato fatto; quali prodotti/servizi, pagamento, ordine e note risultano nella scheda.
- Cassa: cash disponibile; chiusure, prelievi, scostamenti e giorni da verificare.
- Comunicazioni: prepara una comunicazione professionale collegata a una persona o task, sempre con conferma prima dell'invio.
Non dichiarare capacità fuori da questo elenco senza uno strumento reale.
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
  const impliedTeamScope = requestedTeamStatus(messages);

  try {
    for (let round = 0; round < 4; round += 1) {
      const response = await createResponse({
        model: MODEL,
        instructions,
        input,
        tools,
        tool_choice: round === 0 && requiredTool ? { type: "function", name: requiredTool } : "auto",
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
        const result = await executeTool(call, session.user.id, impliedTeamScope, impliedMonthPeriod, impliedDayPeriod, impliedTaskStatus, impliedEmployeeName) as {
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
