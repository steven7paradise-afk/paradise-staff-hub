import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { appointmentSalonForPC, appointmentStaffLocationsForPC, checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { appointmentSalonSlugFromName, normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import {
  appointmentStaffDisplayName,
  hasCurrentAttendanceAtAppointmentSalon,
  isAlwaysActiveAppointmentStaff,
  isRepubblicaPinRosterWorker,
  repubblicaAppointmentRosterScope,
} from "@/lib/appointment-staff-access";

export const dynamic = "force-dynamic";

const STAFF_ALIAS_SETTING_KEY = "appointment_staff_aliases";
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
  const scope = request.nextUrl.searchParams.get("scope");
  const isRepubblicaBoard = scope === "repubblica-board";
  const includeAllSalonStaff = scope === "salon";
  const isPinEntry = scope === "pin-entry";
  const session = await auth();
  let isAuthorized = Boolean(session?.user?.id);
  let locationId = session?.user?.sedeId || null;
  let pcLocationId: string | null = null;

  if ((!isAuthorized || isPinEntry || includeAllSalonStaff) && !isRepubblicaBoard) {
    const cookieStore = await cookies();
    const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
    const pcAuth = await checkPCAuthorization(pcToken);
    if (pcAuth) {
      isAuthorized = true;
      locationId = pcAuth.locationId;
      pcLocationId = pcAuth.locationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    let resolvedSalon = salonSlug;
    let staffLocationIds: string[] | null = null;
    if (isRepubblicaBoard || (!pcLocationId && salonSlug === "repubblica")) {
      const activeLocations = await prisma.location.findMany({
        where: { active: true },
        select: { id: true, name: true },
      });
      const locations = activeLocations.filter((location) => appointmentSalonSlugFromName(location.name) === "repubblica");
      if (locations.length !== 1) {
        return NextResponse.json({ error: "Sede Salone Repubblica non identificata." }, { status: 404 });
      }
      locationId = locations[0].id;
      resolvedSalon = "repubblica";
      staffLocationIds = await appointmentStaffLocationsForPC(locationId, resolvedSalon);
    } else if (pcLocationId) {
      const pcSalon = await appointmentSalonForPC(pcLocationId);
      if (!pcSalon || (salonSlug && pcSalon !== salonSlug)) {
        return NextResponse.json({ error: "Apri la pagina del salone associato a questo computer." }, { status: 403 });
      }
      resolvedSalon = pcSalon;
      staffLocationIds = await appointmentStaffLocationsForPC(pcLocationId, pcSalon);
    } else if (salonSlug) {
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

    const isRepubblicaRoster = isRepubblicaBoard || (includeAllSalonStaff && resolvedSalon === "repubblica");
    const isRepubblicaPcPinEntry = isPinEntry && pcLocationId !== null && resolvedSalon === "repubblica";
    const eligibleLocationIds = staffLocationIds ?? (locationId ? [locationId] : []);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const today = new Date(`${day}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [workers, aliasSetting] = await Promise.all([
      prisma.user.findMany({
        where: {
          active: true,
          ...(isRepubblicaRoster ? {
            OR: repubblicaAppointmentRosterScope(eligibleLocationIds),
          } : {}),
          ...(isRepubblicaRoster || isPinEntry ? { employee_status: { not: FORMER_EMPLOYEE_STATUS } } : {}),
          ...(isPinEntry ? { role: { notIn: ["ADMIN", "SUPER_ADMIN", "ZERO"] } } : {}),
        },
        select: {
          id: true,
          name: true,
          photo_url: true,
          sede_id: true,
          location: { select: { name: true } },
          attendance_logs: {
            where: { date: { gte: today, lt: tomorrow } },
            select: { type: true, timestamp: true, location_id: true },
            orderBy: { timestamp: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.setting.findUnique({ where: { key: STAFF_ALIAS_SETTING_KEY } }),
    ]);
    const staffAliases = normalizeStaffAliases(aliasSetting?.value);

    const clockedInWorkers = workers.flatMap((worker) => {
      const state = deriveAttendanceState(worker.attendance_logs);
      const alwaysActive = isAlwaysActiveAppointmentStaff(worker.name, worker.id);
      const status = alwaysActive ? "IN" : state.status;
      const localAttendance = hasCurrentAttendanceAtAppointmentSalon(
        state.status, state.lastValidLog?.location_id, eligibleLocationIds,
      );
      if (isRepubblicaRoster && !alwaysActive && !worker.sede_id && !localAttendance) return [];
      if (isRepubblicaPcPinEntry) {
        if (!isRepubblicaPinRosterWorker({
          assignedLocationId: worker.sede_id,
          attendanceLocationId: state.lastValidLog?.location_id,
          status: state.status,
          alwaysActive,
        }, eligibleLocationIds)) return [];
      } else if (!isRepubblicaRoster && !alwaysActive) {
        if (locationId && (!worker.sede_id || !eligibleLocationIds.includes(worker.sede_id))) return [];
        if (!includeAllSalonStaff && status !== "IN" && status !== "BREAK") return [];
      }

      return [{
        id: worker.id,
        name: appointmentStaffDisplayName(worker.name, worker.id),
        photo_url: worker.photo_url,
        sede_id: worker.sede_id,
        locationName: resolvedSalon === "repubblica" && (
          (worker.sede_id && worker.sede_id !== locationId && eligibleLocationIds.includes(worker.sede_id)) ||
          (!worker.sede_id && localAttendance)
        ) ? "Salone Repubblica" : worker.location?.name ?? "",
        status,
        alwaysActive,
        clockedInAt: state.firstEntry
          ? new Date(state.firstEntry.timestamp).toISOString()
          : null,
        breakStartedAt: state.status === "BREAK" && state.activePause
          ? new Date(state.activePause.timestamp).toISOString()
          : null,
        externalIds: Object.entries(staffAliases)
          .filter(([, alias]) =>
            alias.userId === worker.id &&
            !/^(staff disponibile|staff assente paradise|non assegnat[oi])$/i.test(String(alias.externalName || "").trim())
          )
          .map(([externalId]) => externalId),
      }];
    });

    clockedInWorkers.sort((a, b) => a.name.localeCompare(b.name, "it"));

    return NextResponse.json(clockedInWorkers);
  } catch (error) {
    console.error("Errore recupero staff attivo per cassa:", error);
    return NextResponse.json({ error: "Errore durante il recupero del personale attivo." }, { status: 500 });
  }
}
