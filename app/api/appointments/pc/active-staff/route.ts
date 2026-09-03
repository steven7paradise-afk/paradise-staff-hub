import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";

export const dynamic = "force-dynamic";

const STAFF_ALIAS_SETTING_KEY = "appointment_staff_aliases";
const ALWAYS_ACTIVE_STAFF_NAMES = new Set(["franci"]);

type StaffAlias = {
  userId?: string;
  externalName?: string;
};

function normalizeStaffAliases(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, StaffAlias>;
}

export async function GET(request: NextRequest) {
  const salonSlug = normalizeAppointmentSalonSlug(request.nextUrl.searchParams.get("salone"));
  const includeAllSalonStaff = request.nextUrl.searchParams.get("scope") === "salon";
  const session = await auth();
  let isAuthorized = Boolean(session?.user?.id);
  let locationId = session?.user?.sedeId || null;

  if (!isAuthorized) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isAuthorized = true;
      locationId = pcAuth.locationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    if (salonSlug) {
      const forcedLocation = await prisma.location.findFirst({
        where: {
          active: true,
          OR: salonSlug === "buenos-aires"
            ? [{ name: { contains: "Buenos", mode: "insensitive" } }, { name: { contains: "Corso", mode: "insensitive" } }]
            : [{ name: { contains: salonSlug, mode: "insensitive" } }],
        },
        select: { id: true },
      });
      locationId = forcedLocation?.id || locationId;
    }

    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const today = new Date(`${day}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [workers, aliasSetting] = await Promise.all([
      prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        photo_url: true,
        sede_id: true,
        location: { select: { name: true } },
        attendance_logs: {
          where: { date: { gte: today, lt: tomorrow } },
          select: { type: true, timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { name: "asc" },
      }),
      prisma.setting.findUnique({ where: { key: STAFF_ALIAS_SETTING_KEY } }),
    ]);
    const staffAliases = normalizeStaffAliases(aliasSetting?.value);

    const clockedInWorkers = workers
      .map((worker) => {
        const state = deriveAttendanceState(worker.attendance_logs);
        const alwaysActive = ALWAYS_ACTIVE_STAFF_NAMES.has(worker.name.trim().toLocaleLowerCase("it"));
        return {
          id: worker.id,
          name: worker.name,
          photo_url: worker.photo_url,
          sede_id: worker.sede_id,
          locationName: worker.location?.name ?? "",
          status: alwaysActive ? "IN" : state.status,
          alwaysActive,
          clockedInAt: state.firstEntry
            ? new Date(state.firstEntry.timestamp).toISOString()
            : null,
          breakStartedAt: state.status === "BREAK" && state.activePause
            ? new Date(state.activePause.timestamp).toISOString()
            : null,
          externalIds: Object.entries(staffAliases)
            .filter(([, alias]) => alias.userId === worker.id)
            .map(([externalId]) => externalId),
        };
      })
      .filter((worker) => includeAllSalonStaff
        ? (!locationId || worker.sede_id === locationId)
        : worker.alwaysActive || (
            (worker.status === "IN" || worker.status === "BREAK") &&
            (!locationId || worker.sede_id === locationId)
          ));

    clockedInWorkers.sort((a, b) => a.name.localeCompare(b.name, "it"));

    return NextResponse.json(clockedInWorkers);
  } catch (error) {
    console.error("Errore recupero staff attivo per cassa:", error);
    return NextResponse.json({ error: "Errore durante il recupero del personale attivo." }, { status: 500 });
  }
}
