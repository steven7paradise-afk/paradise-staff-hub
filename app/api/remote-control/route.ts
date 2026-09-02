import { NextRequest, NextResponse } from "next/server";
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
const ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

type PointerState = { x: number; y: number; revision: number };
type InputState = { selector: string; value: string; revision: number };
type ClickState = { x: number; y: number; selector?: string; label?: string; tag?: string; revision: number };
type ScrollState = { x: number; y: number; revision: number };
type RemoteSession = {
  targetCode: string;
  active: boolean;
  controllerId: string;
  controllerName: string;
  workerId: string | null;
  pathname: string;
  search: string;
  pointer: PointerState | null;
  input: InputState | null;
  click: ClickState | null;
  scroll: ScrollState | null;
  revision: number;
  updatedAt: string;
  expiresAt: string;
};

type PresenceMap = Record<string, string>;

function sessionsFrom(value: unknown): Record<string, RemoteSession> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, RemoteSession>)
    : {};
}

function pcsFrom(value: unknown): AuthorizedPC[] {
  return Array.isArray(value) ? (value as unknown as AuthorizedPC[]) : [];
}

function cleanPath(value: unknown) {
  const pathname = typeof value === "string" ? value.trim() : "";
  const allowed = ["/appointments", "/service-forms", "/orders", "/client-control"];
  return allowed.some((item) => pathname === item || pathname.startsWith(`${item}/`)) ? pathname : "/appointments";
}

function activeSession(session?: RemoteSession | null) {
  return Boolean(session?.active && Date.parse(session.expiresAt) > Date.now());
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const isAdmin = Boolean(session?.user?.id && ADMIN_ROLES.has(session.user.role));
  const pcModeRequested = request.nextUrl.searchParams.get("mode") === "pc";
  const cookieStore = await cookies();
  const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);

  if (!isAdmin && !pcAuth) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
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
            online,
            controllerName: activeSession(sessions[pc.code]) ? sessions[pc.code].controllerName : null,
          };
        }),
    });
  }

  // The cashier polls frequently during remote control. It only needs the
  // current session and presence, not the complete device registry.
  const [sessionsSetting, presenceSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SESSIONS_KEY } }),
    prisma.setting.findUnique({ where: { key: PRESENCE_KEY } }),
  ]);
  const sessions = sessionsFrom(sessionsSetting?.value);
  const presence = presenceSetting?.value && typeof presenceSetting.value === "object" && !Array.isArray(presenceSetting.value)
    ? presenceSetting.value as PresenceMap
    : {};
  const remote = sessions[pcAuth!.code];
  const lastSeen = Date.parse(presence[pcAuth!.code] || "");
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > 10_000) {
    presence[pcAuth!.code] = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: PRESENCE_KEY },
      update: { value: presence as any },
      create: { key: PRESENCE_KEY, value: presence as any },
    }).catch(() => null);
  }
  const response = NextResponse.json({
    session: activeSession(remote) ? remote : null,
    target: { name: pcAuth!.name, locationId: pcAuth!.locationId },
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
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Solo gli amministratori possono usare il controllo remoto." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const targetCode = typeof body?.targetCode === "string" ? body.targetCode.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "update";
  if (!targetCode) return NextResponse.json({ error: "PC non selezionato." }, { status: 400 });

  const [pcsSetting, sessionsSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: PCS_KEY } }),
    prisma.setting.findUnique({ where: { key: SESSIONS_KEY } }),
  ]);
  const pc = pcsFrom(pcsSetting?.value).find((item) => item.code === targetCode && item.activatedAt && !item.archivedAt);
  if (!pc) return NextResponse.json({ error: "PC non disponibile o non autorizzato." }, { status: 404 });

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
    const workerId = typeof body?.workerId === "string"
      ? body.workerId.trim()
      : action === "start"
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

    if (action === "start") {
      for (const [code, item] of Object.entries(sessions)) {
        const otherPc = pcsFrom(pcsSetting?.value).find((candidate) => candidate.code === code);
        if (code !== targetCode && otherPc?.locationId === pc.locationId && item.controllerId === session.user.id) {
          sessions[code] = { ...item, active: false, updatedAt: now.toISOString(), expiresAt: now.toISOString() };
        }
      }
    }
    sessions[targetCode] = {
      targetCode,
      active: true,
      controllerId: session.user.id,
      controllerName: session.user.name || "Amministratore",
      workerId,
      pathname: cleanPath(body?.pathname ?? previous?.pathname),
      search: typeof body?.search === "string" ? body.search.slice(0, 1000) : previous?.search || "",
      pointer: action === "start" ? null : pointer,
      input: action === "start" ? null : input,
      click: action === "start" ? null : click,
      scroll: action === "start" ? null : scroll,
      revision: (previous?.revision || 0) + 1,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
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
