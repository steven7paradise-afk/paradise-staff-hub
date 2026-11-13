import { NextRequest } from "next/server";
import { Client } from "pg";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";
import { archiveMonths } from "@/lib/appointment-archive-range";
import { addAppointmentDays, appointmentDateKey, appointmentMonthRange } from "@/lib/appointment-date";
import { scheduleAppointmentArchive } from "@/lib/appointment-archive";
import { hasCowlendarToken } from "@/lib/cowlendar";
import { getOperationalUser } from "@/lib/operational-session";
import { PAYMENT_EVENTS_CHANNEL, PAYMENT_REVISION_KEY } from "@/lib/shopify-payment-webhook";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "@/lib/cowlendar-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const reconciliationInterval = 10 * 60_000;
const nextArchiveCheck = new Map<string, number>();

function reconcileVisibleMonths(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || !hasCowlendarToken()) return;

  let months: string[];
  try { months = archiveMonths(from, to); } catch { return; }

  const today = appointmentDateKey();
  const thisMonth = today.slice(0, 7);
  const nextMonth = addAppointmentDays(appointmentMonthRange(today).end, 1).slice(0, 7);
  for (const month of nextArchiveCheck.keys()) {
    if (month !== thisMonth && month !== nextMonth) nextArchiveCheck.delete(month);
  }
  const now = Date.now();
  for (const month of months) {
    if (month !== thisMonth && month !== nextMonth) continue;
    const nextCheck = nextArchiveCheck.get(month);
    if (nextCheck !== undefined && nextCheck > now) continue;
    nextArchiveCheck.set(month, now + reconciliationInterval);
    // Opening the agenda already schedules the first import. Share subsequent
    // checks between streams; a matching archive does not notify the browser.
    if (nextCheck === undefined) continue;
    void scheduleAppointmentArchive(month).catch(() => {});
  }
}

export async function GET(request: NextRequest) {
  if (process.env.APPOINTMENTS_REALTIME_ENABLED !== "true" || !process.env.APPOINTMENTS_REALTIME_DATABASE_URL) {
    return new Response(null, { status: 503 });
  }
  const token = request.cookies.get(appointmentsPcCookieName)?.value;
  const authorized = async () => Boolean(await checkPCAuthorization(token) || await getOperationalUser(request));
  if (!await authorized()) return new Response(null, { status: 401 });
  // LISTEN needs a direct or session-pooled connection, never transaction pooling.
  const client = new Client({ connectionString: process.env.APPOINTMENTS_REALTIME_DATABASE_URL, connectionTimeoutMillis: 5000 });
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat); clearTimeout(expiry);
    request.signal.removeEventListener("abort", close);
    void client.end().catch(() => {});
    try { streamController?.close(); } catch { /* client already disconnected */ }
  };
  client.on("error", close);
  try {
    await client.connect();
    await client.query(`LISTEN ${APPOINTMENT_EVENTS_CHANNEL}`);
    await client.query(`LISTEN ${PAYMENT_EVENTS_CHANNEL}`);
  } catch { close(); return new Response(null, { status: 503 }); }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      if (closed || request.signal.aborted) { close(); if (closed) { try { controller.close(); } catch {} } return; }
      request.signal.addEventListener("abort", close, { once: true });
      const send = (revision: string, event = "appointments.changed") => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${revision}\n\n`));
      };
      let initializing = true;
      let revisionChanged = false;
      client.on("notification", (message) => {
        const event = message.channel === APPOINTMENT_EVENTS_CHANNEL ? "appointments.changed"
          : message.channel === PAYMENT_EVENTS_CHANNEL ? "payments.changed" : null;
        if (!event || !/^[a-f0-9-]{36}$/.test(message.payload || "")) return;
        if (initializing) revisionChanged = true;
        else send(message.payload!, event);
      });
      try {
        // Read after LISTEN and repeat if a notification raced the read.
        do {
          revisionChanged = false;
          const [latest, payment] = await Promise.all([
            prisma.setting.findUnique({ where: { key: APPOINTMENT_REVISION_KEY } }),
            prisma.setting.findUnique({ where: { key: PAYMENT_REVISION_KEY } }),
          ]);
          if (closed) return;
          if (revisionChanged) continue;
          initializing = false;
          send(typeof latest?.value === "string" ? latest.value : "initial");
          send(typeof payment?.value === "string" ? payment.value : "initial", "payments.changed");
        } while (revisionChanged);
      } catch { close(); return; }
      if (closed) return;
      reconcileVisibleMonths(request);
      // Keepalive does not send a new agenda revision.
      let checking = false;
      heartbeat = setInterval(async () => {
        if (closed || checking) return;
        checking = true;
        try {
          if (!await authorized()) { close(); return; }
          if (!closed) {
            reconcileVisibleMonths(request);
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch { close(); } finally { checking = false; }
      }, 20000);
      expiry = setTimeout(close, 240000);
    }, cancel() { close(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store, no-transform",
    "X-Accel-Buffering": "no", Connection: "keep-alive",
  } });
}
