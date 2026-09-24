import { NextRequest, NextResponse } from "next/server";
import { mobileWorkspace } from "@/lib/mobile-workspace-auth";
import { workspaceBookings } from "@/lib/mobile-workspace-bookings";
import { appointmentDateKey, isAppointmentDateKey } from "@/lib/appointment-date";
import { officeNoteText } from "@/lib/mobile-workspace-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const context = await mobileWorkspace(request);
  if (!context) return NextResponse.json({ error: "Accesso scaduto." }, { status: 401 });
  const access = context.modules.find((item) => item.id === "appointments");
  if (!access) return NextResponse.json({ error: "Non hai accesso agli appuntamenti." }, { status: 403 });
  const date = request.nextUrl.searchParams.get("date") ?? appointmentDateKey();
  if (!isAppointmentDateKey(date)) return NextResponse.json({ error: "Data non valida." }, { status: 400 });
  const bookings = await workspaceBookings(context, date);
  const settings = await prisma.setting.findMany({ where: { key: { in: [
    "appointment_status_overrides", "appointment_team_overrides",
    ...bookings.map((booking) => `appointment_office_note:${booking.id}`),
  ] } }, select: { key: true, value: true } });
  const values = new Map(settings.map((item) => [item.key, item.value]));
  const statuses = (values.get("appointment_status_overrides") ?? {}) as Record<string, { status?: string; startedAt?: string; elapsedSeconds?: number }>;
  const teams = (values.get("appointment_team_overrides") ?? {}) as Record<string, { teammates?: { id: string; name: string }[] }>;
  const appointments = bookings.map((booking) => {
    const status = statuses[booking.id];
    return {
      id: booking.id,
      customerName: booking.customer?.name?.trim() || [booking.form_data?.firstname, booking.form_data?.lastname].filter(Boolean).join(" ") || "Cliente",
      serviceTitle: booking.service?.title || "Servizio",
      startDate: booking.start_date,
      endDate: booking.end_date ?? null,
      team: teams[booking.id]?.teammates ?? (booking.teammates ?? []).map((mate) => ({ id: mate.id, name: [mate.firstname, mate.lastname].filter(Boolean).join(" ") })),
      status: booking.is_canceled ? "ANNULLATO" : status?.status || booking.attendance || booking.confirmation_status || "PRENOTATO",
      startedAt: status?.startedAt ?? null,
      elapsedSeconds: status?.elapsedSeconds ?? 0,
      officeNote: officeNoteText(values.get(`appointment_office_note:${booking.id}`)),
      notes: [booking.notes, booking.note, booking.internal_note, booking.customer_note].filter(Boolean).join("\n\n"),
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return NextResponse.json({ appointments, canEditNotes: access.canEdit && !!context.auth && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(context.auth.user.role), limit: 400 }, { headers: { "Cache-Control": "private, no-store" } });
}
