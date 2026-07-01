import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteScheduleEventFromGoogleCalendar, syncScheduleEntryToGoogleCalendar } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

const planningRoles = new Set(["SUPER_ADMIN", "ADMIN"]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTime(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const time = String(value);
  return timePattern.test(time) ? time : undefined;
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !planningRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();

  if (Array.isArray(data)) {
    try {
      // Validazione preliminare dei campi principali
      for (const item of data) {
        const userId = String(item.userId ?? "");
        const locationId = item.locationId ? String(item.locationId) : null;
        const date = new Date(String(item.date ?? ""));
        const startTime = normalizeTime(item.startTime);
        const endTime = normalizeTime(item.endTime);

        if (!userId || !locationId || Number.isNaN(date.valueOf())) {
          return NextResponse.json({ error: "Dati turni non validi." }, { status: 400 });
        }
        if (startTime === undefined || endTime === undefined || Boolean(startTime) !== Boolean(endTime)) {
          return NextResponse.json({ error: "Formato ora inizio/fine non valido." }, { status: 400 });
        }
        if (startTime && endTime && endTime <= startTime) {
          return NextResponse.json({ error: "L'ora fine deve essere successiva all'ora inizio." }, { status: 400 });
        }
      }

      const deleteFilters = data
        .filter((item) => !item.categoryId)
        .map((item) => ({
          user_id: String(item.userId ?? ""),
          date: new Date(String(item.date ?? "")),
          location_id: item.locationId ? String(item.locationId) : null,
        }));
      const calendarEventsToDelete = deleteFilters.length
        ? await prisma.scheduleEntry.findMany({
            where: { OR: deleteFilters },
            select: { id: true, google_calendar_event_id: true },
          })
        : [];

      const operations = data.map((item) => {
        const userId = String(item.userId ?? "");
        const categoryId = item.categoryId ? String(item.categoryId) : null;
        const locationId = item.locationId ? String(item.locationId) : null;
        const startTime = normalizeTime(item.startTime);
        const endTime = normalizeTime(item.endTime);
        const date = new Date(String(item.date ?? ""));

        if (!categoryId) {
          return prisma.scheduleEntry.deleteMany({
            where: { user_id: userId, date, location_id: locationId },
          });
        }

        return prisma.scheduleEntry.upsert({
          where: { user_id_date: { user_id: userId, date } },
          update: { category_id: categoryId, location_id: locationId, start_time: startTime, end_time: endTime },
          create: { user_id: userId, category_id: categoryId, location_id: locationId, date, start_time: startTime, end_time: endTime },
        });
      });

      const results = await prisma.$transaction(operations);
      const upsertedEntryIds = results
        .map((result) => (result && typeof result === "object" && "id" in result ? String(result.id) : null))
        .filter((id): id is string => Boolean(id));
      const calendarSync = await Promise.allSettled([
        ...calendarEventsToDelete.map((entry) => deleteScheduleEventFromGoogleCalendar(entry.google_calendar_event_id, entry.id)),
        ...upsertedEntryIds.map((id) => syncScheduleEntryToGoogleCalendar(id)),
      ]);
      const calendarFailures = calendarSync.filter((result) => result.status === "rejected").length;

      return NextResponse.json({ success: true, count: data.length, calendarSync: { attempted: calendarSync.length, failures: calendarFailures } });
    } catch (error: any) {
      return NextResponse.json({ error: error.message ?? "Errore nel salvataggio di massa." }, { status: 500 });
    }
  }

  const userId = String(data.userId ?? "");
  const categoryId = data.categoryId ? String(data.categoryId) : null;
  const locationId = data.locationId ? String(data.locationId) : null;
  const startTime = normalizeTime(data.startTime);
  const endTime = normalizeTime(data.endTime);
  const date = new Date(String(data.date ?? ""));
  if (!userId || !locationId || Number.isNaN(date.valueOf())) {
    return NextResponse.json({ error: "Cella planning non valida." }, { status: 400 });
  }
  if (startTime === undefined || endTime === undefined || Boolean(startTime) !== Boolean(endTime)) {
    return NextResponse.json({ error: "Inserisci ora inizio e fine nel formato corretto." }, { status: 400 });
  }
  if (startTime && endTime && endTime <= startTime) {
    return NextResponse.json({ error: "L'ora fine deve essere dopo l'ora inizio." }, { status: 400 });
  }

  const worker = await prisma.user.findUnique({ where: { id: userId } });
  if (!worker || (session.user.role === "RESPONSABILE" && locationId !== session.user.sedeId)) {
    return NextResponse.json({ error: "Personale non disponibile per questa sede." }, { status: 403 });
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location?.active) {
    return NextResponse.json({ error: "Salone non valido." }, { status: 400 });
  }

  if (!categoryId) {
    const existing = await prisma.scheduleEntry.findFirst({
      where: { user_id: userId, date, location_id: locationId },
      select: { id: true, google_calendar_event_id: true },
    });
    await prisma.scheduleEntry.deleteMany({ where: { user_id: userId, date, location_id: locationId } });
    const calendarSync = await deleteScheduleEventFromGoogleCalendar(existing?.google_calendar_event_id, existing?.id);
    return NextResponse.json({ removed: true, calendarSync });
  }

  const category = await prisma.scheduleCategory.findUnique({ where: { id: categoryId } });
  if (!category?.active) {
    return NextResponse.json({ error: "Categoria non valida." }, { status: 400 });
  }
  if (category.location_id && category.location_id !== locationId) {
    return NextResponse.json({ error: "Questa categoria appartiene a un altro salone." }, { status: 400 });
  }

  const entry = await prisma.scheduleEntry.upsert({
    where: { user_id_date: { user_id: userId, date } },
    update: { category_id: categoryId, location_id: locationId, start_time: startTime, end_time: endTime },
    create: { user_id: userId, category_id: categoryId, location_id: locationId, date, start_time: startTime, end_time: endTime },
  });
  const calendarSync = await syncScheduleEntryToGoogleCalendar(entry.id);
  return NextResponse.json({ ...entry, calendarSync });
}
