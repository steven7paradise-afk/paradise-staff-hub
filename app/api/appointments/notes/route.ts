import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { canManageAppointmentOfficeNotes } from "@/lib/appointment-office-note-access";
import { readAppointmentEditRevisions, visibleAgendaRange } from "@/lib/appointment-range-revision";
import { saveAppointmentChange } from "@/lib/appointment-realtime";

const NOTE_KEY_PREFIX = "appointment_office_note:";

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request, {
    requirePcWorker: true,
    preferAuthenticatedAdmin: true,
  });
  if (!operationalUser?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const userAccess = operationalUser.id === "PC_CASSA"
    ? null
    : await prisma.user.findUnique({
        where: { id: operationalUser.id },
        select: { mansione: true, location: { select: { name: true } } },
      }).catch(() => null);
  if (!canManageAppointmentOfficeNotes({
    role: operationalUser.role,
    mansione: userAccess?.mansione,
    locationName: userAccess?.location?.name,
    isPC: operationalUser.isPC,
  })) {
    return NextResponse.json({ error: "Solo il personale di Ufficio Paradise o Corso Buenos Aires può modificare questa nota" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const text = String(body?.text || "").trim();

    if (!bookingId || bookingId.length > 200 || !text) {
      return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "La nota può contenere al massimo 1000 caratteri" }, { status: 400 });
    }

    const key = `${NOTE_KEY_PREFIX}${bookingId}`;
    const agendaRange = visibleAgendaRange(body.range);
    const agendaRevision = await saveAppointmentChange(async (tx) => {
      if (agendaRange) {
        await tx.$executeRaw`
          INSERT INTO settings (id, key, value)
          VALUES (${randomUUID()}, ${key}, '{}'::jsonb)
          ON CONFLICT (key) DO NOTHING
        `;
        await tx.$queryRaw`SELECT id FROM settings WHERE key = ${key} FOR UPDATE`;
      }
      const revision = agendaRange
        ? await readAppointmentEditRevisions(tx, agendaRange, bookingId, { kind: "office-note", text })
        : undefined;
      await tx.setting.upsert({ where: { key }, create: { key, value: { text } }, update: { value: { text } } });
      return revision;
    });

    return NextResponse.json({ bookingId, text, agendaRevision });
  } catch (error) {
    console.error("Failed to save office appointment note:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della nota" }, { status: 500 });
  }
}
