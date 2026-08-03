import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveAttendanceState } from "@/lib/attendance-state";
import { checkPCAuthorization, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";
import { normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    const salonSlug = normalizeAppointmentSalonSlug(request.nextUrl.searchParams.get("salone"));
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

    const workers = await prisma.user.findMany({
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
    });

    const clockedInWorkers = workers
      .map((worker) => {
        const state = deriveAttendanceState(worker.attendance_logs);
        return {
          id: worker.id,
          name: worker.name,
          photo_url: worker.photo_url,
          sede_id: worker.sede_id,
          locationName: worker.location?.name ?? "",
          status: state.status,
        };
      })
      .filter((w) => (w.status === "IN" || w.status === "BREAK") && (!locationId || w.sede_id === locationId));

    clockedInWorkers.sort((a, b) => a.name.localeCompare(b.name, "it"));

    return NextResponse.json(clockedInWorkers);
  } catch (error) {
    console.error("Errore recupero staff attivo per cassa:", error);
    return NextResponse.json({ error: "Errore durante il recupero del personale attivo." }, { status: 500 });
  }
}
