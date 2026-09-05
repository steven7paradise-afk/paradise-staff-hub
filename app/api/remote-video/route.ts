import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SESSIONS_KEY = "appointments_remote_sessions";
const VIDEO_KEY_PREFIX = "appointments_remote_video:";
const ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

type SessionRecord = {
  active?: boolean;
  mode?: string;
  controllerId?: string;
  expiresAt?: string;
};

type VideoSignal = {
  requestId: string;
  targetCode: string;
  controllerId: string;
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  status: "requested" | "connecting" | "live" | "denied" | "ended";
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

function sessionsFrom(value: unknown): Record<string, SessionRecord> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, SessionRecord>
    : {};
}

function isActiveObservation(session?: SessionRecord | null) {
  return Boolean(
    session?.active &&
    session.mode === "observe" &&
    session.expiresAt &&
    Date.parse(session.expiresAt) > Date.now(),
  );
}

function cleanDescription(value: unknown, expectedType: "offer" | "answer"): RTCSessionDescriptionInit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { type?: unknown; sdp?: unknown };
  if (candidate.type !== expectedType || typeof candidate.sdp !== "string") return null;
  const sdp = candidate.sdp.trim();
  if (!sdp || sdp.length > 120_000) return null;
  return { type: expectedType, sdp };
}

async function readSignal(targetCode: string) {
  const row = await prisma.setting.findUnique({ where: { key: `${VIDEO_KEY_PREFIX}${targetCode}` } });
  return row?.value && typeof row.value === "object" && !Array.isArray(row.value)
    ? row.value as unknown as VideoSignal
    : null;
}

async function saveSignal(targetCode: string, signal: VideoSignal) {
  await prisma.setting.upsert({
    where: { key: `${VIDEO_KEY_PREFIX}${targetCode}` },
    create: { key: `${VIDEO_KEY_PREFIX}${targetCode}`, value: signal as any },
    update: { value: signal as any },
  });
}

async function resolveAccess(requestedTarget: string, expectedKind: "admin" | "pc") {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
  const isAdmin = Boolean(session?.user?.id && ADMIN_ROLES.has(session.user.role));
  const targetCode = expectedKind === "pc" ? pcAuth?.code || "" : requestedTarget;

  if (!targetCode || (expectedKind === "pc" ? !pcAuth : !isAdmin)) return null;
  const row = await prisma.setting.findUnique({ where: { key: SESSIONS_KEY } });
  const remoteSession = sessionsFrom(row?.value)[targetCode];
  if (!isActiveObservation(remoteSession)) return null;

  if (expectedKind === "pc" && pcAuth) return { kind: "pc" as const, targetCode, userId: pcAuth.code, remoteSession };
  if (remoteSession.controllerId !== session!.user!.id && session!.user!.role !== "ZERO") return null;
  return { kind: "admin" as const, targetCode, userId: session!.user!.id!, remoteSession };
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "pc" ? "pc" : "admin";
  if (mode === "pc") {
    const cookieStore = await cookies();
    const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
    if (!pcAuth) return NextResponse.json({ error: "Dispositivo non autorizzato." }, { status: 403 });
  }
  const requestedTarget = request.nextUrl.searchParams.get("targetCode")?.trim() || "";
  const access = await resolveAccess(requestedTarget, mode);
  if (!access) return NextResponse.json({ signal: null }, { status: 200 });
  const signal = await readSignal(access.targetCode);
  if (!signal || signal.controllerId !== access.remoteSession.controllerId) {
    return NextResponse.json({ signal: null, targetCode: access.targetCode });
  }
  return NextResponse.json({ signal, targetCode: access.targetCode });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const requestedTarget = typeof body?.targetCode === "string" ? body.targetCode.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const accessKind = action === "offer" ? "admin" : "pc";
  const access = await resolveAccess(requestedTarget, accessKind);
  if (!access) return NextResponse.json({ error: "Sessione video non disponibile." }, { status: 403 });

  const now = new Date().toISOString();
  if (action === "offer" && access.kind === "admin") {
    const offer = cleanDescription(body?.offer, "offer");
    if (!offer) return NextResponse.json({ error: "Connessione video non valida." }, { status: 400 });
    const signal: VideoSignal = {
      requestId: typeof body?.requestId === "string" && body.requestId.length <= 100 ? body.requestId : randomUUID(),
      targetCode: access.targetCode,
      controllerId: access.userId,
      offer,
      answer: null,
      status: "requested",
      message: null,
      createdAt: now,
      updatedAt: now,
    };
    await saveSignal(access.targetCode, signal);
    return NextResponse.json({ success: true, signal });
  }

  const signal = await readSignal(access.targetCode);
  if (!signal || signal.controllerId !== access.remoteSession.controllerId) {
    return NextResponse.json({ error: "Richiesta video scaduta." }, { status: 409 });
  }
  if (typeof body?.requestId !== "string" || body.requestId !== signal.requestId) {
    return NextResponse.json({ error: "Richiesta video sostituita." }, { status: 409 });
  }

  if (action === "answer" && access.kind === "pc") {
    const answer = cleanDescription(body?.answer, "answer");
    if (!answer) return NextResponse.json({ error: "Risposta video non valida." }, { status: 400 });
    signal.answer = answer;
    signal.status = "connecting";
  } else if (action === "status" && access.kind === "pc") {
    const status = ["live", "denied", "ended"].includes(body?.status) ? body.status as VideoSignal["status"] : null;
    if (!status) return NextResponse.json({ error: "Stato video non valido." }, { status: 400 });
    signal.status = status;
    signal.message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim().slice(0, 160) || null : null;
  } else {
    return NextResponse.json({ error: "Azione video non consentita." }, { status: 403 });
  }

  signal.updatedAt = now;
  await saveSignal(access.targetCode, signal);
  return NextResponse.json({ success: true, signal });
}
