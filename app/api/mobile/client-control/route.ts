import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { assignedClientBookings } from "@/lib/mobile-client-control";
import { controlFields, controlPatch } from "@/lib/mobile-client-control-policy";
import { appointmentDateKey, isAppointmentDateKey } from "@/lib/appointment-date";
import { ensureClientControlForm, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function currentUser(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || auth.session.device_name?.startsWith("ios-salon:") || auth.user.employee_status === FORMER_EMPLOYEE_STATUS) return null;
  return auth.user;
}
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale." }, 401);
  const date = request.nextUrl.searchParams.get("date") ?? appointmentDateKey();
  if (!isAppointmentDateKey(date)) return reply({ error: "Data non valida." }, 400);
  const assigned = await assignedClientBookings(user.id, date);
  const forms = await prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } });
  const formIds = forms.filter(f => isClientControlFormName(f.name, f.category)).map(f => f.id);
  const responses = assigned.length ? await prisma.serviceFormResponse.findMany({ where: {
    form_id: { in: formIds }, OR: assigned.map(({ booking }) => ({ answers: { path: ["booking_id"], equals: booking.id } })),
  }, orderBy: { updated_at: "desc" }, select: { answers: true, updated_at: true } }) : [];
  const items = assigned.map(({ booking: b, status }) => {
    const response = responses.find(r => (r.answers as Record<string, unknown>)?.booking_id === b.id);
    const answers = (response?.answers ?? {}) as Record<string, unknown>;
    return { id: b.id, customerName: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || "Cliente",
      serviceTitle: b.service?.title ?? "Servizio", startDate: b.start_date, status,
      revision: response?.updated_at.toISOString() ?? "", fields: controlFields(answers),
      confirmed: !!response && answers.client_control_is_draft !== true,
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return reply({ items });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return reply({ error: "Accedi con il tuo account personale." }, 401);
  const body = await request.json().catch(() => null);
  const patch = controlPatch(body?.fields);
  if (!patch || typeof body?.bookingId !== "string" || typeof body?.revision !== "string" || !isAppointmentDateKey(body?.date ?? "")) return reply({ error: "Scheda non valida." }, 400);
  const assigned = (await assignedClientBookings(user.id, body.date)).find(b => b.booking.id === body.bookingId);
  if (!assigned) return reply({ error: "Questo appuntamento non è assegnato a te. Aggiorna l’elenco." }, 403);
  const form = await ensureClientControlForm(user.id);
  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize first creation; subsequent saves also check the web/Mac revision.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mobile-client-control:${body.bookingId}`}))`;
      const previous = await tx.serviceFormResponse.findFirst({ where: { form_id: form.id, answers: { path: ["booking_id"], equals: body.bookingId } }, orderBy: { updated_at: "desc" } });
      if ((previous?.updated_at.toISOString() ?? "") !== body.revision) throw new Error("CONFLICT");
      const old = (previous?.answers ?? {}) as Record<string, Prisma.InputJsonValue>;
      // Confirmed payment checks stay with the existing web/Mac flow.
      if (previous && old.client_control_is_draft !== true) throw new Error("CONFIRMED");
      const b = assigned.booking;
      const answers = { ...old, ...patch, booking_id: b.id, client_control_client_name: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || old.client_control_client_name || "Cliente",
        client_control_location: old.client_control_location || user.location?.name || "",
        client_control_service_title: b.service?.title ?? "", client_control_is_draft: true,
        client_control_correctness: "Bozza", client_control_last_editor_id: user.id, client_control_last_editor_name: user.name,
        client_control_service_owner: old.client_control_service_owner || user.name,
        client_control_service_staff: old.client_control_service_staff || [user.name],
      };
      const updatedAt = new Date();
      if (previous) {
        const updated = await tx.serviceFormResponse.updateMany({ where: { id: previous.id, updated_at: previous.updated_at }, data: { answers, updated_at: updatedAt } });
        if (updated.count !== 1) throw new Error("CONFLICT");
      } else {
        await tx.serviceFormResponse.create({ data: { form_id: form.id, user_id: user.id, user_role: user.role,
          user_location_id: user.sede_id, user_location_name: user.location?.name, answers, status: "NEW", priority: "MEDIA", updated_at: updatedAt } });
      }
      await tx.shopifyOrderComment.create({ data: { order_name: b.id, user_name: user.name, user_role: user.role, message: "BOZZA CONTROLLO CLIENTE SALVATA · App MyParadise" } });
      return { revision: updatedAt.toISOString() };
    });
    return reply(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") return reply({ error: "La scheda è stata modificata da Mac o sito. Riaprila prima di salvare." }, 409);
    if (error instanceof Error && error.message === "CONFIRMED") return reply({ error: "Scheda già confermata. Le modifiche richiedono la verifica su Mac o sito." }, 409);
    console.error("Mobile client control save failed", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "Salvataggio non riuscito. I dati sul telefono sono rimasti nel modulo: riprova." }, 500);
  }
}
