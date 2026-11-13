import { NextRequest } from "next/server";
import { Client } from "pg";
import { appointmentSalonForPC, appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization, findAppointmentPcWorker } from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";
import { archiveMonths } from "@/lib/appointment-archive-range";
import { addAppointmentDays, appointmentDateKey, appointmentMonthRange } from "@/lib/appointment-date";
import { scheduleAppointmentArchive } from "@/lib/appointment-archive";
import { readAppointmentRangeRevision } from "@/lib/appointment-range-revision";
import { APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL, appointmentsRealtimeEnabled } from "@/lib/appointment-realtime";
import { APPOINTMENT_ROSTER_EVENTS_CHANNEL, APPOINTMENT_ROSTER_REVISION_KEY } from "@/lib/salon-live";
import { hasCowlendarToken } from "@/lib/cowlendar";
import { getOperationalUser } from "@/lib/operational-session";
import { canAccessForUser } from "@/lib/roles";
import { PAYMENT_EVENTS_CHANNEL, PAYMENT_REVISION_KEY } from "@/lib/shopify-payment-webhook";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "@/lib/cowlendar-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const reconciliationInterval = 10 * 60_000;
const nextArchiveCheck = new Map<string, number>();

function reconcileVisibleMonths(months: string[]) {
  if (!months.length || !hasCowlendarToken()) return;
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

function scheduleInvalidatedMonths(months: string[]) {
  if (!months.length || !hasCowlendarToken()) return;
  void prisma.appointmentArchiveSync.findMany({
    where: { month: { in: months }, lease_until: new Date(0) },
    select: { month: true },
  }).then((pending) => Promise.all(pending.map(({ month }) => scheduleAppointmentArchive(month)))).catch(() => {});
}

export async function GET(request: NextRequest) {
  if (!appointmentsRealtimeEnabled()) return new Response(null, { status: 503 });
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  let months: string[] = [];
  if (from !== null || to !== null) {
    if (!from || !to) return new Response(null, { status: 400 });
    try { months = archiveMonths(from, to); } catch { return new Response(null, { status: 400 }); }
  }
  const range = from && to ? { from, to } : null;
  const token = request.cookies.get(appointmentsPcCookieName)?.value;
  const workerCookie = request.cookies.get(appointmentsPcWorkerCookieName)?.value;
  const cashierScope = request.nextUrl.searchParams.get("scope") === "cashier";
  if (cashierScope && !range) return new Response(null, { status: 400 });
  const authorized = async () => {
    if (!range) return Boolean(await checkPCAuthorization(token) || await getOperationalUser(request));
    if (cashierScope) {
      if (!workerCookie) return false;
      const pc = await checkPCAuthorization(token);
      if (!pc) return false;
      const salon = await appointmentSalonForPC(pc.locationId);
      return salon === "repubblica" && Boolean(await findAppointmentPcWorker(pc.locationId, salon, workerCookie));
    }
    const user = await getOperationalUser(request, { preferAuthenticatedAdmin: true });
    if (!user || user.isPC) return false;
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, mansione: true, access_list: true },
    });
    return Boolean(profile && (
      (profile.role === "DIPENDENTE" && profile.mansione?.toLowerCase().includes("assistenza")) ||
      await canAccessForUser(prisma, "/appointments", profile)
    ));
  };
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
    if (range) {
      await client.query(`LISTEN ${APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL}`);
      await client.query(`LISTEN ${APPOINTMENT_ROSTER_EVENTS_CHANNEL}`);
    }
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
      let pending = true;
      let checkingRevisions = false;
      let appointmentRevision: string | undefined;
      let paymentRevision: string | undefined;
      let rosterRevision: string | undefined;

      async function sendCurrentRevisions() {
        pending = true;
        if (closed || checkingRevisions) return;
        checkingRevisions = true;
        try {
          while (pending && !closed) {
            pending = false;
            const readSetting = (key: string) => prisma.setting.findUnique({
              where: { key },
              select: { value: true },
            }).then((setting) => typeof setting?.value === "string" ? setting.value : "initial");
            const replaying = appointmentRevision === undefined;
            const [appointment, payment, roster] = await Promise.all([
              range ? readAppointmentRangeRevision(range.from, range.to) : readSetting(APPOINTMENT_REVISION_KEY),
              replaying ? readSetting(PAYMENT_REVISION_KEY) : undefined,
              range && replaying ? readSetting(APPOINTMENT_ROSTER_REVISION_KEY) : undefined,
            ]);
            if (closed) return;
            // If another commit arrived during the reads, compare against the latest snapshot.
            if (pending) continue;
            if (appointmentRevision !== appointment) {
              appointmentRevision = appointment;
              send(appointment);
            }
            if (payment && paymentRevision !== payment) {
              paymentRevision = payment;
              send(payment, "payments.changed");
            }
            if (roster && rosterRevision !== roster) {
              rosterRevision = roster;
              send(roster, "roster.changed");
            }
          }
        } catch { close(); } finally { checkingRevisions = false; }
      }

      client.on("notification", (message) => {
        if (!/^[a-f0-9-]{36}$/.test(message.payload || "")) return;
        if (message.channel === APPOINTMENT_ARCHIVE_INVALIDATION_CHANNEL) {
          scheduleInvalidatedMonths(months);
          return;
        }
        if (appointmentRevision === undefined) {
          pending = true;
          return;
        }
        if (message.channel === PAYMENT_EVENTS_CHANNEL) {
          paymentRevision = message.payload!;
          send(paymentRevision, "payments.changed");
        } else if (message.channel === APPOINTMENT_ROSTER_EVENTS_CHANNEL) {
          if (rosterRevision !== message.payload) {
            rosterRevision = message.payload!;
            send(rosterRevision, "roster.changed");
          }
        } else if (message.channel === APPOINTMENT_EVENTS_CHANNEL) {
          if (range) void sendCurrentRevisions();
          else {
            appointmentRevision = message.payload!;
            send(appointmentRevision);
          }
        }
      });

      // Recheck invalidated months on reconnect in case a webhook arrived while offline.
      scheduleInvalidatedMonths(months);
      await sendCurrentRevisions();
      if (closed) return;
      reconcileVisibleMonths(months);
      // Keepalive does not send a new agenda revision.
      let checking = false;
      heartbeat = setInterval(async () => {
        if (closed || checking) return;
        checking = true;
        try {
          if (!await authorized()) { close(); return; }
          if (!closed) {
            reconcileVisibleMonths(months);
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
