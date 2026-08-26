import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { prisma } from "@/lib/prisma";

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

const tools = [
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
      user: { select: { name: true, location: { select: { name: true } } } },
    },
    orderBy: [{ status: "asc" }, { start_date: "desc" }],
    take: 30,
  });

  return {
    count: requests.length,
    requests: requests.map((request) => ({
      id: request.id,
      person: request.user.name,
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

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function executeTool(call: ToolCall) {
  const args = safeJson(call.arguments);
  if (call.name === "get_team_status") return { output: await getTeamStatus() };
  if (call.name === "get_task_overview") {
    return { output: await getTaskOverview(typeof args.status === "string" ? args.status : null), link: APP_PAGES.tasks };
  }
  if (call.name === "get_requests_overview") {
    const type = typeof args.type === "string" ? args.type : null;
    const link = type === "MALATTIA" ? APP_PAGES.sickness : APP_PAGES.requests;
    return { output: await getRequestsOverview(type, args.pending_only === true), link };
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

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY non configurata sul server." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as { messages?: ChatMessage[] } | null;
  const messages = Array.isArray(payload?.messages)
    ? payload.messages
        .filter((message): message is ChatMessage => Boolean(message) && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
        .slice(-MAX_HISTORY)
        .map((message) => ({ role: message.role, content: message.content.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content.trim();
  if (!lastUserMessage) return NextResponse.json({ error: "Scrivi una domanda." }, { status: 400 });

  const instructions = `Sei Paradise Assistant, assistente operativo interno di Paradise Beauty.
Rispondi in italiano, in modo sintetico e concreto. La persona autenticata è un amministratore.
Usa sempre gli strumenti per domande su presenze, pause, task, ferie, permessi, malattie e ritardi: non inventare dati.
Puoi consultare dati ma non modificarli. Non inviare comunicazioni e non approvare richieste. Se l'utente chiede una comunicazione, prepara soltanto una bozza chiaramente indicata come bozza.
Usa navigate_app soltanto quando l'utente chiede esplicitamente "apri", "vai" o "portami" a una pagina.
Non mostrare identificativi tecnici, segreti, email, telefoni, dati fiscali o medici. Per una malattia indica solo se risulta giustificata o non giustificata.
Quando elenchi persone o task, usa righe brevi e leggibili.`;

  const input: Array<Record<string, unknown>> = messages.map((message) => ({ role: message.role, content: message.content }));
  const links = new Map<string, { path: string; label: string }>();
  let navigation: { path: string; label: string } | null = null;

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
        return NextResponse.json({ answer, links: Array.from(links.values()), navigation });
      }

      input.push(...(response.output || []));
      for (const call of calls) {
        const result = await executeTool(call);
        if (result.link) links.set(result.link.path, result.link);
        if (result.navigation) navigation = result.navigation;
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.output) });
      }
    }
    return NextResponse.json({ answer: "La richiesta richiede troppi passaggi. Prova a farne una più specifica.", links: Array.from(links.values()), navigation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Il servizio AI non è disponibile in questo momento.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
