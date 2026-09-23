import { NextRequest, NextResponse } from "next/server";
import { appointmentDateKey, appointmentDayBoundaryIso, isAppointmentDateKey } from "@/lib/appointment-date";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { getCowlendarBookingsForRange } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StatusEntry = {
  status?: string;
  updatedAt?: string;
  updatedBy?: string;
  startedAt?: string | null;
  stoppedAt?: string | null;
  elapsedSeconds?: number;
};

type TeamEntry = {
  teammates?: Array<{ id?: string; name?: string; photoUrl?: string | null }>;
};

function normalize(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(first?: string | null, last?: string | null) {
  return `${first || ""} ${last || ""}`.replace(/\s+/g, " ").trim();
}

function isBuenosAiresBooking(booking: {
  service?: { title?: string | null } | null;
  booking_str?: string | null;
  teammates?: Array<{ firstname?: string | null; lastname?: string | null }>;
}, workerLocations: Map<string, string>) {
  const teammateLocations = (booking.teammates || [])
    .map((mate) => workerLocations.get(normalize(displayName(mate.firstname, mate.lastname))) || "")
    .join(" ");
  const source = normalize([
    teammateLocations,
    booking.service?.title,
    booking.booking_str,
  ].filter(Boolean).join(" "));

  if (source.includes("duomo") && !source.includes("buenos") && !source.includes("corso")) return false;
  return source.includes("buenos") || source.includes("corso") || !source.includes("duomo");
}

export async function GET(request: NextRequest) {
  const pcAuth = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
  if (!pcAuth) return NextResponse.json({ error: "PC non autorizzato." }, { status: 401 });

  const requestedDate = request.nextUrl.searchParams.get("date") || appointmentDateKey();
  if (!isAppointmentDateKey(requestedDate)) {
    return NextResponse.json({ error: "Data non valida." }, { status: 400 });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const [bookings, workers, statusSetting, teamSetting] = await Promise.all([
    getCowlendarBookingsForRange({
      startDate: appointmentDayBoundaryIso(requestedDate),
      endDate: appointmentDayBoundaryIso(requestedDate, true),
      limit: 400,
      forceRefresh,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, photo_url: true, sede_id: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: "appointment_status_overrides" }, select: { value: true } }),
    prisma.setting.findUnique({ where: { key: "appointment_team_overrides" }, select: { value: true } }),
  ]);

  const statuses = statusSetting?.value && typeof statusSetting.value === "object" && !Array.isArray(statusSetting.value)
    ? statusSetting.value as Record<string, StatusEntry>
    : {};
  const teamOverrides = teamSetting?.value && typeof teamSetting.value === "object" && !Array.isArray(teamSetting.value)
    ? teamSetting.value as Record<string, TeamEntry>
    : {};

  const workerByName = new Map(workers.map((worker) => [normalize(worker.name), worker]));
  const workerLocations = new Map(workers.map((worker) => [normalize(worker.name), worker.location?.name || ""]));
  const salonBookings = bookings.filter((booking) => isBuenosAiresBooking(booking, workerLocations));
  // Read the same shared office notes used by the online appointments board.
  const officeNoteSettings = salonBookings.length ? await prisma.setting.findMany({
    where: { key: { in: salonBookings.map((booking) => `appointment_office_note:${booking.id}`) } },
    select: { key: true, value: true },
  }) : [];
  const officeNotes = new Map(officeNoteSettings.map(({ key, value }) => {
    const text = value && typeof value === "object" && !Array.isArray(value) &&
      "text" in value && typeof value.text === "string" ? value.text.trim() : "";
    return [key.slice("appointment_office_note:".length), text];
  }));

  const appointments = salonBookings
    .map((booking) => {
      const overriddenTeam = teamOverrides[booking.id]?.teammates
        ?.map((mate) => ({
          id: String(mate.id || "").trim(),
          name: String(mate.name || "").trim(),
          photoUrl: mate.photoUrl || null,
        }))
        .filter((mate) => mate.id && mate.name) || [];
      const cowlendarTeam = (booking.teammates || []).map((mate) => {
        const externalName = displayName(mate.firstname, mate.lastname);
        const local = workerByName.get(normalize(externalName));
        return {
          id: local?.id || mate.id,
          name: local?.name || externalName,
          photoUrl: local?.photo_url || mate.thumbnail || null,
        };
      }).filter((mate) => mate.name);
      const team = overriddenTeam.length ? overriddenTeam : cowlendarTeam;
      const status = statuses[booking.id];
      const customerName = booking.customer?.name?.trim() ||
        [booking.form_data?.firstname, booking.form_data?.lastname]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" ") ||
        booking.booking_str ||
        "Cliente";
      const note = [booking.notes, booking.note, booking.internal_note, booking.customer_note]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join("\n\n");

      return {
        id: booking.id,
        customerName,
        customerEmail: booking.customer?.email || null,
        customerPhone: booking.customer?.phone || null,
        serviceTitle: booking.service?.title || "Servizio",
        startDate: booking.start_date,
        endDate: booking.end_date || null,
        team,
        localStatus: status?.status || null,
        statusStartedAt: status?.startedAt || null,
        statusElapsedSeconds: status?.elapsedSeconds || 0,
        confirmationStatus: booking.confirmation_status || null,
        attendance: booking.attendance || null,
        financialStatus: booking.financial_status || null,
        isCanceled: Boolean(booking.is_canceled),
        notes: note || null,
        officeNote: officeNotes.get(booking.id) || null,
        orderId: booking.order_id ? String(booking.order_id) : null,
      };
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const salonWorkers = workers
    .filter((worker) => worker.sede_id === pcAuth.locationId || normalize(worker.location?.name).includes("buenos") || normalize(worker.location?.name).includes("corso"))
    .map((worker) => ({ id: worker.id, name: worker.name, photoUrl: worker.photo_url || null }));

  return NextResponse.json({
    date: requestedDate,
    locationName: "Buenos Aires",
    deviceName: pcAuth.name,
    workers: salonWorkers,
    appointments,
    updatedAt: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
