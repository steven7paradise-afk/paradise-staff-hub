import { NextRequest } from "next/server";
import { Client } from "pg";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "@/lib/cowlendar-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (process.env.APPOINTMENTS_REALTIME_ENABLED !== "true" || !process.env.APPOINTMENTS_REALTIME_DATABASE_URL) {
    return new Response(null, { status: 503 });
  }
  const token = request.cookies.get(appointmentsPcCookieName)?.value;
  if (!await checkPCAuthorization(token)) return new Response(null, { status: 401 });
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
  } catch { close(); return new Response(null, { status: 503 }); }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      if (closed || request.signal.aborted) { close(); if (closed) { try { controller.close(); } catch {} } return; }
      request.signal.addEventListener("abort", close, { once: true });
      const send = (revision: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: appointments.changed\ndata: ${revision}\n\n`));
      };
      client.on("notification", (message) => {
        if (message.channel === APPOINTMENT_EVENTS_CHANNEL && /^[a-f0-9-]{36}$/.test(message.payload || "")) send(message.payload!);
      });
      try {
        const latest = await prisma.setting.findUnique({ where: { key: APPOINTMENT_REVISION_KEY } });
        send(typeof latest?.value === "string" ? latest.value : "initial");
      } catch { close(); return; }
      if (closed) return;
      // Keepalive/auth checks are not agenda polling and fetch no appointments.
      let checking = false;
      heartbeat = setInterval(async () => {
        if (closed || checking) return;
        checking = true;
        try {
          if (!await checkPCAuthorization(token)) { close(); return; }
          if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
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
