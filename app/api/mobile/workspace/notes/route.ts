import { NextResponse } from "next/server";
import { mobileWorkspace } from "@/lib/mobile-workspace-auth";
import { workspaceBookings } from "@/lib/mobile-workspace-bookings";
import { isAppointmentDateKey } from "@/lib/appointment-date";
import { isWorkspaceAdmin, officeNoteText } from "@/lib/mobile-workspace-policy";
import { saveAppointmentChange } from "@/lib/appointment-realtime";

export async function PATCH(request: Request) {
  const context = await mobileWorkspace(request);
  if (!context) return NextResponse.json({ error: "Accesso scaduto." }, { status: 401 });
  if (!context.auth || !isWorkspaceAdmin(context.auth.user.role) || !context.modules.some((item) => item.id === "appointments" && item.canEdit)) {
    return NextResponse.json({ error: "Serve un amministratore autorizzato a modificare le note." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!isAppointmentDateKey(body?.date) || typeof body?.bookingId !== "string" || typeof body?.text !== "string" ||
    !body.text.trim() || body.text.trim().length > 1000 || typeof body?.previousText !== "string") {
    return NextResponse.json({ error: "Inserisci una nota da 1 a 1000 caratteri." }, { status: 400 });
  }
  const bookings = await workspaceBookings(context, body.date);
  if (!bookings.some((booking) => booking.id === body.bookingId)) return NextResponse.json({ error: "Appuntamento non disponibile in questo salone o giorno." }, { status: 404 });
  const key = `appointment_office_note:${body.bookingId}`;
  const text = body.text.trim();
  try {
    const saved = await saveAppointmentChange(async (tx) => {
      const current = await tx.setting.findUnique({ where: { key } });
      if (officeNoteText(current?.value) !== body.previousText) return false;
      const value = { text, updatedAt: new Date().toISOString(), updatedBy: context.auth!.user.id };
      if (!current) { await tx.setting.create({ data: { key, value } }); return true; }
      const result = await tx.setting.updateMany({ where: { key, value: { equals: current.value! } }, data: { value } });
      return result.count === 1;
    });
    if (!saved) return NextResponse.json({ error: "La nota è stata modificata da un’altra persona. Ricarica prima di salvare." }, { status: 409 });
    return NextResponse.json({ text });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Nota appena modificata. Ricarica prima di salvare." }, { status: 409 });
    }
    throw error;
  }
}
