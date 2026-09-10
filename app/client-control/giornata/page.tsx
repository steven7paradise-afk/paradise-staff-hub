import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DailyClientControl, type DailyClientControlItem } from "@/components/daily-client-control";
import { auth } from "@/lib/auth";
import { appointmentDateKey, appointmentDayBoundaryIso, isAppointmentDateKey } from "@/lib/appointment-date";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

function normalize(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function truthy(value: unknown) {
  if (value === true) return true;
  return ["si", "sì", "true", "fatto", "ricevuta", "ok", "1"].includes(String(value ?? "").trim().toLowerCase());
}

function present(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as object).length > 0;
  return Boolean(String(value ?? "").trim());
}

function names(value: unknown) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[,;]+/);
  return source.map(String).map((name) => name.trim()).filter(Boolean);
}

function bookingSalon(booking: any): DailyClientControlItem["salon"] {
  const text = normalize([booking.service?.title, booking.form_data?.sede, booking.form_data?.salone, ...(booking.teammates || []).map((mate: any) => `${mate.firstname || ""} ${mate.lastname || ""}`)].join(" "));
  if (text.includes("buenos") || text.includes("corso")) return "buenos-aires";
  if (text.includes("duomo")) return "duomo";
  return "altro";
}

export default async function DailyClientControlPage({ searchParams }: { searchParams: Promise<{ day?: string; salone?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const accessUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, mansione: true, access_list: true } });
  const role = session.user.role as Role;
  const canAccess = accessUser ? await canAccessForUser(prisma, "/client-control", accessUser) : ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role);
  if (!canAccess) redirect("/dashboard");

  const params = await searchParams;
  const day = isAppointmentDateKey(params.day) ? params.day : appointmentDateKey();
  const salon = params.salone === "duomo" || params.salone === "buenos-aires" ? params.salone : "tutti";
  const bookings = hasCowlendarToken() ? await getCowlendarBookingsForRange({ startDate: appointmentDayBoundaryIso(day), endDate: appointmentDayBoundaryIso(day, true), limit: 1000 }).catch(() => []) : [];
  const activeBookings = bookings.filter((booking: any) => booking.id && !booking.is_canceled && !booking.isCanceled);
  const bookingIds = activeBookings.map((booking: any) => String(booking.id));

  const forms = await prisma.serviceForm.findMany({ where: { active: true }, select: { id: true, name: true, category: true } }).catch(() => []);
  const formIds = forms.filter((form) => isClientControlFormName(form.name, form.category)).map((form) => form.id);
  const dayRange = { gte: new Date(appointmentDayBoundaryIso(day)), lte: new Date(appointmentDayBoundaryIso(day, true)) };
  const responses = formIds.length ? await prisma.serviceFormResponse.findMany({
    where: { form_id: { in: formIds }, OR: [{ created_at: dayRange }, { updated_at: dayRange }, ...bookingIds.slice(0, 250).map((id) => ({ answers: { path: ["booking_id"], equals: id } }))] },
    orderBy: { updated_at: "desc" },
    select: { answers: true },
  }).catch(() => []) : [];

  type Control = NonNullable<DailyClientControlItem["control"]>;
  const byBooking = new Map<string, Control>();
  const byName = new Map<string, Control>();
  for (const response of responses) {
    const answers = response.answers as Record<string, unknown>;
    const staff = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const owners = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const noteText = String(answers.client_control_notes_text ?? "").trim();
    const control: Control = {
      exists: true,
      isDraft: truthy(answers.client_control_is_draft),
      noteDone: truthy(answers[CLIENT_CONTROL_FIELD_IDS.notes]) || Boolean(noteText),
      beforeMediaDone: truthy(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) || present(answers.photo_prima_fronte) || present(answers.photo_prima_dietro),
      afterMediaDone: truthy(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]) || present(answers.photo_dopo_fronte) || present(answers.photo_dopo_dietro),
      staffNames: staff.length ? staff : owners,
      noteText,
    };
    const bookingId = String(answers.booking_id ?? "").trim();
    const clientName = normalize(String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] ?? ""));
    if (bookingId && !byBooking.has(bookingId)) byBooking.set(bookingId, control);
    if (clientName && !byName.has(clientName)) byName.set(clientName, control);
  }

  const items: DailyClientControlItem[] = activeBookings.map((booking: any) => {
    const customerName = booking.customer?.name?.trim() || [booking.form_data?.firstname, booking.form_data?.lastname].map((value: unknown) => String(value || "").trim()).filter(Boolean).join(" ") || booking.booking_str || "Cliente senza nome";
    return {
      id: String(booking.id), customerName, serviceTitle: String(booking.service?.title || "Servizio"), startDate: booking.start_date, endDate: booking.end_date || null,
      salon: bookingSalon(booking), control: byBooking.get(String(booking.id)) || byName.get(normalize(customerName)) || null,
    };
  }).filter((item) => salon === "tutti" || item.salon === salon).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return <AppShell title="Controllo giornata" subtitle="Foto, note e responsabili delle clienti di oggi." role={role} hideHeader><DailyClientControl day={day} salon={salon} items={items} /></AppShell>;
}
