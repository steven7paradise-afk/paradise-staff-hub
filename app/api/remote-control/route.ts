import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieMaxAgeSeconds,
  appointmentsPcWorkerCookieName,
  appointmentsRemoteCookieMaxAgeSeconds,
  appointmentsRemoteTargetCookieName,
  appointmentsRemoteWorkerCookieName,
  checkPCAuthorization,
  reconnectPC,
  type AuthorizedPC,
} from "@/lib/appointments-pc-auth";
import { appointmentSalonSlugFromName } from "@/lib/appointment-salon-url";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PCS_KEY = "appointments_authorized_pcs";
const SESSIONS_KEY = "appointments_remote_sessions";
const PRESENCE_KEY = "appointments_remote_presence";
const RECONNECT_REQUESTS_KEY = "appointments_remote_reconnect_requests";
const ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const REMOTE_SESSION_TTL_MS = 45_000;

type PointerState = { x: number; y: number; revision: number };
type InputState = { selector: string; value: string; revision: number };
type ClickState = { x: number; y: number; selector?: string; label?: string; tag?: string; revision: number };
type ScrollState = { x: number; y: number; revision: number };
type ObservationEvent = {
  kind: "navigation" | "click" | "field" | "scroll";
  label: string;
  at: string;
};
type ObservationState = {
  pathname: string;
  search: string;
  pointer: { x: number; y: number } | null;
  scroll: { x: number; y: number } | null;
  workerId: string | null;
  lastAction: string | null;
  events: ObservationEvent[];
  snapshot: string | null;
  htmlSnapshot: string | null;
  viewport: { width: number; height: number } | null;
  updatedAt: string;
};
type RemoteEvent =
  | ({ kind: "click" } & ClickState)
  | ({ kind: "input"; selector: string; value: string; checked?: boolean; fieldTag?: string; fieldType?: string } & { revision: number })
  | ({ kind: "key"; selector: string; key: string; code?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } & { revision: number })
  | ({ kind: "scroll" } & ScrollState);
type RemoteSession = {
  sessionId?: string;
  targetCode: string;
  active: boolean;
  mode?: "control" | "observe";
  controllerId: string;
  controllerName: string;
  workerId: string | null;
  pathname: string;
  search: string;
  pointer: PointerState | null;
  input: InputState | null;
  click: ClickState | null;
  scroll: ScrollState | null;
  events?: RemoteEvent[];
  eventRevision?: number;
  observation?: ObservationState | null;
  revision: number;
  updatedAt: string;
  expiresAt: string;
};

type PresenceMap = Record<string, string>;
type ReconnectRequest = { requestedAt: string; requestedBy: string; expiresAt: string };

function sessionsFrom(value: unknown): Record<string, RemoteSession> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, RemoteSession>)
    : {};
}

function pcsFrom(value: unknown): AuthorizedPC[] {
  return Array.isArray(value) ? (value as unknown as AuthorizedPC[]) : [];
}

function reconnectRequestsFrom(value: unknown): Record<string, ReconnectRequest> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, ReconnectRequest>
    : {};
}

function cleanPath(value: unknown) {
  const pathname = typeof value === "string" ? value.trim() : "";
  const allowed = [
    "/appointments", "/service-forms", "/orders", "/shopify-orders", "/client-control",
    "/cassa-live", "/cash", "/invoices", "/refunds", "/recruitment", "/shipping",
    "/service-notes", "/tasks", "/requests", "/notifications", "/profile",
  ];
  return allowed.some((item) => pathname === item || pathname.startsWith(`${item}/`)) ? pathname : "/appointments";
}

function activeSession(session?: RemoteSession | null) {
  return Boolean(session?.active && Date.parse(session.expiresAt) > Date.now());
}

function cleanObservationLabel(value: unknown) {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!label || /password|parola chiave|\bpin\b|codice di accesso|file|allegat/i.test(label)) return "";
  return label;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const isAdmin = Boolean(session?.user?.id && ADMIN_ROLES.has(session.user.role));
  const requestedMode = request.nextUrl.searchParams.get("mode");
  const pcModeRequested = requestedMode === "pc";
  const cookieStore = await cookies();
  const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);

  if (!isAdmin && !pcAuth) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  if (isAdmin && requestedMode === "observe") {
    const targetCode = request.nextUrl.searchParams.get("targetCode")?.trim() || "";
    const sessionsSetting = await prisma.setting.findUnique({ where: { key: SESSIONS_KEY } });
    const remote = sessionsFrom(sessionsSetting?.value)[targetCode];
    if (!remote || !activeSession(remote) || remote.mode !== "observe") {
      return NextResponse.json({ session: null });
    }
    if (remote.controllerId !== session!.user!.id && session!.user!.role !== "ZERO") {
      return NextResponse.json({ error: "La sessione appartiene a un altro amministratore." }, { status: 409 });
    }
    const worker = remote.observation?.workerId
      ? await prisma.user.findUnique({ where: { id: remote.observation.workerId }, select: { id: true, name: true, photo_url: true } })
      : null;
    return NextResponse.json({ session: remote, worker });
  }

  if (isAdmin && !(pcModeRequested && pcAuth)) {
    const [pcsSetting, sessionsSetting, presenceSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: PCS_KEY } }),
      prisma.setting.findUnique({ where: { key: SESSIONS_KEY } }),
      prisma.setting.findUnique({ where: { key: PRESENCE_KEY } }),
    ]);
    const pcs = pcsFrom(pcsSetting?.value);
    const sessions = sessionsFrom(sessionsSetting?.value);
    const presence = presenceSetting?.value && typeof presenceSetting.value === "object" && !Array.isArray(presenceSetting.value)
      ? presenceSetting.value as PresenceMap
      : {};
    const locations = await prisma.location.findMany({ select: { id: true, name: true } });
    const locationNames = new Map(locations.map((item) => [item.id, item.name]));
    const candidates = pcs.filter((pc) => pc.activatedAt && !pc.archivedAt && pc.accessTokenHash && !/test/i.test(pc.name));
    const selectedByDeviceName = new Map<string, AuthorizedPC>();
    for (const pc of candidates) {
      const deviceKey = `${pc.locationId}:${pc.name.trim().toLocaleLowerCase("it")}`;
      const current = selectedByDeviceName.get(deviceKey);
      const pcOnline = Date.now() - Date.parse(presence[pc.code] || "") < 35_000;
      const currentOnline = current ? Date.now() - Date.parse(presence[current.code] || "") < 35_000 : false;
      const pcTime = Date.parse(pc.activatedAt || pc.createdAt);
      const currentTime = current ? Date.parse(current.activatedAt || current.createdAt) : 0;
      if (!current || (pcOnline && !currentOnline) || (pcOnline === currentOnline && pcTime > currentTime)) {
        selectedByDeviceName.set(deviceKey, pc);
      }
    }
    return NextResponse.json({
      currentDeviceId: pcAuth?.code || null,
      targets: Array.from(selectedByDeviceName.values())
        .map((pc) => {
          const locationName = locationNames.get(pc.locationId) || pc.name;
          const online = Date.now() - Date.parse(presence[pc.code] || "") < 35_000;
          return {
            id: pc.code,
            name: pc.name,
            locationId: pc.locationId,
            locationName,
            salone: appointmentSalonSlugFromName(locationName) || "buenos-aires",
            active: activeSession(sessions[pc.code]),
            mode: activeSession(sessions[pc.code]) ? sessions[pc.code].mode || "control" : null,
            online,
            controllerName: activeSession(sessions[pc.code]) ? sessions[pc.code].controllerName : null,
          };
        }),
    });
  }

  // The cashier polls frequently during remote control. It only needs the
  // current session and presence, not the complete device registry.
  const [sessionsSetting, presenceSetting, reconnectSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SESSIONS_KEY } }),
    prisma.setting.findUnique({ where: { key: PRESENCE_KEY } }),
    prisma.setting.findUnique({ where: { key: RECONNECT_REQUESTS_KEY } }),
  ]);
  const sessions = sessionsFrom(sessionsSetting?.value);
  const presence = presenceSetting?.value && typeof presenceSetting.value === "object" && !Array.isArray(presenceSetting.value)
    ? presenceSetting.value as PresenceMap
    : {};
  const remote = sessions[pcAuth!.code];
  const reconnectRequest = reconnectRequestsFrom(reconnectSetting?.value)[pcAuth!.code];
  const lastSeen = Date.parse(presence[pcAuth!.code] || "");
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > 10_000) {
    presence[pcAuth!.code] = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: PRESENCE_KEY },
      update: { value: presence as any },
      create: { key: PRESENCE_KEY, value: presence as any },
    }).catch(() => null);
  }
  const activeRemote = activeSession(remote) ? remote : null;
  const pcRemote = activeRemote?.mode === "observe" && activeRemote.observation
    ? { ...activeRemote, observation: { ...activeRemote.observation, snapshot: null, htmlSnapshot: null } }
    : activeRemote;
  const response = NextResponse.json({
    session: pcRemote,
    target: { code: pcAuth!.code, name: pcAuth!.name, locationId: pcAuth!.locationId },
    reconnectRequest: reconnectRequest && Date.parse(reconnectRequest.expiresAt) > Date.now() ? reconnectRequest : null,
  });

  if (activeSession(remote) && remote.workerId) {
    const worker = await prisma.user.findFirst({
      where: { id: remote.workerId, active: true, OR: [{ sede_id: pcAuth!.locationId }, { sede_id: null }] },
      select: { id: true },
    });
    if (worker && cookieStore.get(appointmentsPcWorkerCookieName)?.value !== worker.id) {
      response.cookies.set({
        name: appointmentsPcWorkerCookieName,
        value: worker.id,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: appointmentsPcWorkerCookieMaxAgeSeconds,
      });
    }
  }
  return response;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const body = await request.json().catch(() => null);
  const targetCode = typeof body?.targetCode === "string" ? body.targetCode.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "update";
  if (!targetCode) return NextResponse.json({ error: "PC non selezionato." }, { status: 400 });

  if (action === "ack_reconnect") {
    const cookieStore = await cookies();
    const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
    if (!pcAuth || pcAuth.code !== targetCode) return NextResponse.json({ error: "Dispositivo non autorizzato." }, { status: 403 });
    const reconnectSetting = await prisma.setting.findUnique({ where: { key: RECONNECT_REQUESTS_KEY } });
    const reconnectRequests = reconnectRequestsFrom(reconnectSetting?.value);
    delete reconnectRequests[targetCode];
    await prisma.setting.upsert({
      where: { key: RECONNECT_REQUESTS_KEY },
      update: { value: reconnectRequests as any },
      create: { key: RECONNECT_REQUESTS_KEY, value: reconnectRequests as any },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "observe_update") {
    const cookieStore = await cookies();
    const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
    if (!pcAuth || pcAuth.code !== targetCode) return NextResponse.json({ error: "Dispositivo non autorizzato." }, { status: 403 });
    const sessionsSetting = await prisma.setting.findUnique({ where: { key: SESSIONS_KEY } });
    const sessions = sessionsFrom(sessionsSetting?.value);
    const previous = sessions[targetCode];
    if (!previous || !activeSession(previous) || previous.mode !== "observe") {
      return NextResponse.json({ success: false, session: null });
    }
    const now = new Date().toISOString();
    const previousObservation = previous.observation;
    const candidateKind = ["navigation", "click", "field", "scroll"].includes(body?.event?.kind)
      ? body.event.kind as ObservationEvent["kind"]
      : null;
    const candidateLabel = cleanObservationLabel(body?.event?.label);
    const newEvent = candidateKind && candidateLabel
      ? { kind: candidateKind, label: candidateLabel, at: now }
      : null;
    const workerId = cookieStore.get(appointmentsPcWorkerCookieName)?.value?.trim() || null;
    const snapshot = typeof body?.snapshot === "string"
      && body.snapshot.startsWith("data:image/jpeg;base64,")
      && body.snapshot.length <= 900_000
      ? body.snapshot
      : previousObservation?.snapshot || null;
    const htmlSnapshot = typeof body?.htmlSnapshot === "string" && body.htmlSnapshot.length <= 1_500_000
      ? body.htmlSnapshot
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
      : previousObservation?.htmlSnapshot || null;
    previous.observation = {
      pathname: cleanPath(body?.pathname ?? previousObservation?.pathname),
      search: typeof body?.search === "string" ? body.search.slice(0, 1000) : previousObservation?.search || "",
      pointer: body?.pointer && Number.isFinite(body.pointer.x) && Number.isFinite(body.pointer.y)
        ? { x: Math.max(0, Math.min(1, Number(body.pointer.x))), y: Math.max(0, Math.min(1, Number(body.pointer.y))) }
        : previousObservation?.pointer || null,
      scroll: body?.scroll && Number.isFinite(body.scroll.x) && Number.isFinite(body.scroll.y)
        ? { x: Math.max(0, Math.min(1, Number(body.scroll.x))), y: Math.max(0, Math.min(1, Number(body.scroll.y))) }
        : previousObservation?.scroll || null,
      workerId,
      lastAction: newEvent?.label || previousObservation?.lastAction || null,
      events: [...(previousObservation?.events || []), ...(newEvent ? [newEvent] : [])].slice(-20),
      snapshot,
      htmlSnapshot,
      viewport: body?.viewport && Number.isFinite(body.viewport.width) && Number.isFinite(body.viewport.height)
        ? {
            width: Math.max(320, Math.min(5000, Number(body.viewport.width))),
            height: Math.max(320, Math.min(5000, Number(body.viewport.height))),
          }
        : previousObservation?.viewport || null,
      updatedAt: now,
    };
    previous.updatedAt = now;
    previous.revision += 1;
    sessions[targetCode] = previous;
    await prisma.setting.upsert({
      where: { key: SESSIONS_KEY },
      update: { value: sessions as any },
      create: { key: SESSIONS_KEY, value: sessions as any },
    });
    return NextResponse.json({ success: true });
  }

  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Solo gli amministratori possono usare il controllo remoto." }, { status: 403 });
  }

  const [pcsSetting, sessionsSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: PCS_KEY } }),
    prisma.setting.findUnique({ where: { key: SESSIONS_KEY } }),
  ]);
  const pc = pcsFrom(pcsSetting?.value).find((item) => item.code === targetCode && item.activatedAt && !item.archivedAt);
  if (!pc) return NextResponse.json({ error: "PC non disponibile o non autorizzato." }, { status: 404 });

  if (action === "request_reconnect") {
    const reconnectSetting = await prisma.setting.findUnique({ where: { key: RECONNECT_REQUESTS_KEY } });
    const reconnectRequests = reconnectRequestsFrom(reconnectSetting?.value);
    const now = new Date();
    reconnectRequests[targetCode] = {
      requestedAt: now.toISOString(),
      requestedBy: session.user.name || "Amministratore",
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
    await prisma.setting.upsert({
      where: { key: RECONNECT_REQUESTS_KEY },
      update: { value: reconnectRequests as any },
      create: { key: RECONNECT_REQUESTS_KEY, value: reconnectRequests as any },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "claim") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const result = await reconnectPC(targetCode, ip);
    const salonSlug = appointmentSalonSlugFromName((await prisma.location.findUnique({ where: { id: result.locationId }, select: { name: true } }))?.name) || "buenos-aires";
    const response = NextResponse.json({ success: true, appointmentUrl: `/appointments/${salonSlug}?choose=1` });
    response.cookies.set({
      name: appointmentsPcCookieName,
      value: result.accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10,
    });
    response.cookies.set({ name: appointmentsPcWorkerCookieName, value: "", path: "/", maxAge: 0 });
    return response;
  }

  const sessions = sessionsFrom(sessionsSetting?.value);
  const previous = sessions[targetCode];
  const now = new Date();

  if (action === "stop") {
    if (previous && previous.controllerId !== session.user.id && session.user.role !== "ZERO") {
      return NextResponse.json({ error: "La sessione appartiene a un altro amministratore." }, { status: 409 });
    }
    sessions[targetCode] = { ...previous, active: false, updatedAt: now.toISOString(), expiresAt: now.toISOString() } as RemoteSession;
  } else {
    const starting = action === "start" || action === "observe_start";
    const workerId = typeof body?.workerId === "string"
      ? body.workerId.trim()
      : starting
        ? null
        : previous?.workerId || null;
    if (workerId) {
      const worker = await prisma.user.findFirst({
        where: { id: workerId, active: true, OR: [{ sede_id: pc.locationId }, { sede_id: null }] },
        select: { id: true },
      });
      if (!worker) return NextResponse.json({ error: "Profilo non disponibile per questo PC." }, { status: 400 });
    }

    const pointer = body?.pointer && Number.isFinite(body.pointer.x) && Number.isFinite(body.pointer.y)
      ? {
          x: Math.max(0, Math.min(1, Number(body.pointer.x))),
          y: Math.max(0, Math.min(1, Number(body.pointer.y))),
          revision: (previous?.pointer?.revision || 0) + 1,
        }
      : previous?.pointer || null;
    const input = body?.input && typeof body.input.selector === "string" && typeof body.input.value === "string"
      ? {
          selector: body.input.selector.slice(0, 500),
          value: body.input.value.slice(0, 5000),
          revision: (previous?.input?.revision || 0) + 1,
        }
      : previous?.input || null;
    const click = body?.click && Number.isFinite(body.click.x) && Number.isFinite(body.click.y)
      ? {
          x: Math.max(0, Math.min(1, Number(body.click.x))),
          y: Math.max(0, Math.min(1, Number(body.click.y))),
          selector: typeof body.click.selector === "string" ? body.click.selector.slice(0, 500) : undefined,
          label: typeof body.click.label === "string" ? body.click.label.slice(0, 160) : undefined,
          tag: typeof body.click.tag === "string" ? body.click.tag.slice(0, 30) : undefined,
          revision: ((previous as RemoteSession & { click?: ClickState | null })?.click?.revision || 0) + 1,
        }
      : (previous as RemoteSession & { click?: ClickState | null })?.click || null;
    const scroll = body?.scroll && Number.isFinite(body.scroll.x) && Number.isFinite(body.scroll.y)
      ? {
          x: Math.max(0, Math.min(1, Number(body.scroll.x))),
          y: Math.max(0, Math.min(1, Number(body.scroll.y))),
          revision: ((previous as RemoteSession & { scroll?: ScrollState | null })?.scroll?.revision || 0) + 1,
        }
      : (previous as RemoteSession & { scroll?: ScrollState | null })?.scroll || null;

    let eventRevision = starting ? 0 : previous?.eventRevision || 0;
    const events = starting ? [] : [...(previous?.events || [])];
    const incomingEvents = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
    for (const candidate of incomingEvents) {
      if (!candidate || typeof candidate !== "object") continue;
      const kind = typeof candidate.kind === "string" ? candidate.kind : "";
      eventRevision += 1;
      if (kind === "click" && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
        events.push({
          kind: "click",
          x: Math.max(0, Math.min(1, Number(candidate.x))),
          y: Math.max(0, Math.min(1, Number(candidate.y))),
          selector: typeof candidate.selector === "string" ? candidate.selector.slice(0, 500) : undefined,
          label: typeof candidate.label === "string" ? candidate.label.slice(0, 160) : undefined,
          tag: typeof candidate.tag === "string" ? candidate.tag.slice(0, 30) : undefined,
          revision: eventRevision,
        });
      } else if (kind === "input" && typeof candidate.selector === "string" && typeof candidate.value === "string") {
        events.push({
          kind: "input",
          selector: candidate.selector.slice(0, 500),
          value: candidate.value.slice(0, 5000),
          checked: typeof candidate.checked === "boolean" ? candidate.checked : undefined,
          fieldTag: typeof candidate.fieldTag === "string" ? candidate.fieldTag.slice(0, 20) : undefined,
          fieldType: typeof candidate.fieldType === "string" ? candidate.fieldType.slice(0, 30) : undefined,
          revision: eventRevision,
        });
      } else if (kind === "key" && typeof candidate.selector === "string" && typeof candidate.key === "string") {
        events.push({
          kind: "key",
          selector: candidate.selector.slice(0, 500),
          key: candidate.key.slice(0, 50),
          code: typeof candidate.code === "string" ? candidate.code.slice(0, 50) : undefined,
          altKey: Boolean(candidate.altKey),
          ctrlKey: Boolean(candidate.ctrlKey),
          metaKey: Boolean(candidate.metaKey),
          shiftKey: Boolean(candidate.shiftKey),
          revision: eventRevision,
        });
      } else if (kind === "scroll" && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
        events.push({
          kind: "scroll",
          x: Math.max(0, Math.min(1, Number(candidate.x))),
          y: Math.max(0, Math.min(1, Number(candidate.y))),
          revision: eventRevision,
        });
      } else {
        eventRevision -= 1;
      }
    }

    if (starting) {
      for (const [code, item] of Object.entries(sessions)) {
        const otherPc = pcsFrom(pcsSetting?.value).find((candidate) => candidate.code === code);
        if (code !== targetCode && otherPc?.locationId === pc.locationId && item.controllerId === session.user.id) {
          sessions[code] = { ...item, active: false, updatedAt: now.toISOString(), expiresAt: now.toISOString() };
        }
      }
    }
    sessions[targetCode] = {
      sessionId: starting ? randomUUID() : previous?.sessionId || randomUUID(),
      targetCode,
      active: true,
      mode: action === "observe_start" ? "observe" : action === "start" ? "control" : previous?.mode || "control",
      controllerId: session.user.id,
      controllerName: session.user.name || "Amministratore",
      workerId,
      pathname: cleanPath(body?.pathname ?? previous?.pathname),
      search: typeof body?.search === "string" ? body.search.slice(0, 1000) : previous?.search || "",
      pointer: starting ? null : pointer,
      input: starting ? null : input,
      click: starting ? null : click,
      scroll: starting ? null : scroll,
      // Keep an ordered, bounded event queue. Previously only the latest click
      // or keystroke survived, so quick actions and modal openings were lost.
      events: events.slice(-120),
      eventRevision,
      observation: action === "observe_start" ? null : previous?.observation || null,
      revision: (previous?.revision || 0) + 1,
      updatedAt: now.toISOString(),
      // The controller sends a heartbeat while the remote view is open. A
      // short lease prevents a closed tab or an interrupted logout from
      // leaving the cashier PC marked as controlled for hours.
      expiresAt: new Date(now.getTime() + REMOTE_SESSION_TTL_MS).toISOString(),
    };
  }

  await prisma.setting.upsert({
    where: { key: SESSIONS_KEY },
    update: { value: sessions as any },
    create: { key: SESSIONS_KEY, value: sessions as any },
  });
  const response = NextResponse.json({ success: true, session: sessions[targetCode] });
  if (action === "stop") {
    response.cookies.set({ name: appointmentsRemoteTargetCookieName, value: "", path: "/", maxAge: 0 });
    response.cookies.set({ name: appointmentsRemoteWorkerCookieName, value: "", path: "/", maxAge: 0 });
  } else if (sessions[targetCode]?.workerId) {
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: appointmentsRemoteCookieMaxAgeSeconds,
    };
    response.cookies.set({ name: appointmentsRemoteTargetCookieName, value: targetCode, ...cookieOptions });
    response.cookies.set({ name: appointmentsRemoteWorkerCookieName, value: sessions[targetCode].workerId!, ...cookieOptions });
  }
  return response;
}
