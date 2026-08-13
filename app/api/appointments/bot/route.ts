import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCowlendarBookingsForRange, type CowlendarBooking } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_SETTING_KEY = "appointment_status_overrides";
const BOT_UPDATE_SETTING_KEY = "appointment_bot_updates";
const terminalStatuses = new Set([
  "IN_ATTESA",
  "INIZIATO",
  "COMPLETATO",
  "ARRIVATO_IN_RITARDO",
  "NON_PRESENTATO",
]);

type BotUpdate = {
  state: "ON_THE_WAY" | "DELAYED";
  delayMinutes: number | null;
  message: string | null;
  updatedAt: string;
  source: "BOT";
};

function recordMap<T>(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, T>;
  return value as Record<string, T>;
}

function apiKeyFromRequest(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer || request.headers.get("x-api-key")?.trim() || "";
}

function safeKeyMatches(received: string, expected: string) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function authorizeBot(request: NextRequest) {
  const configuredKey = process.env.APPOINTMENTS_BOT_API_KEY?.trim() || "";
  if (!configuredKey) {
    return NextResponse.json(
      { error: "APPOINTMENTS_BOT_API_KEY non configurata." },
      { status: 503 },
    );
  }
  if (!safeKeyMatches(apiKeyFromRequest(request), configuredKey)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return null;
}

function romeDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0039")) return digits.slice(2);
  if (digits.startsWith("39")) return digits;
  return digits.length === 10 && digits.startsWith("3") ? `39${digits}` : digits;
}

function bookingCustomerName(booking: CowlendarBooking) {
  return (
    booking.customer?.name?.trim() ||
    [booking.form_data?.firstname, booking.form_data?.lastname]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ") ||
    "Cliente"
  );
}

function bookingPhone(booking: CowlendarBooking) {
  return String(
    booking.customer?.phone ||
      booking.form_data?.["Numero telefono"] ||
      booking.form_data?.phone ||
      booking.form_data?.telefono ||
      "",
  ).trim();
}

async function getTodayBookings() {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayKey = romeDateKey(now);
  const bookings = await getCowlendarBookingsForRange({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 1000,
  });
  return bookings.filter(
    (booking) => !booking.is_canceled && romeDateKey(new Date(booking.start_date)) === todayKey,
  );
}

function parseDateBoundary(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+02:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getBookingsForBot(request: NextRequest) {
  const now = new Date();
  const requestedFrom = parseDateBoundary(request.nextUrl.searchParams.get("from"));
  const requestedTo = parseDateBoundary(request.nextUrl.searchParams.get("to"), true);
  const start = requestedFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const desiredEnd = requestedTo || new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const maximumEnd = new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000);
  const end = desiredEnd.getTime() > maximumEnd.getTime() ? maximumEnd : desiredEnd;
  const exactToday = !requestedFrom && !requestedTo;
  const todayKey = romeDateKey(now);
  const bookings = await getCowlendarBookingsForRange({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 5000,
  });
  return bookings.filter(
    (booking) => !exactToday || romeDateKey(new Date(booking.start_date)) === todayKey,
  );
}

function inferCustomerUpdate(message: string, requestedState?: string, requestedDelay?: unknown) {
  const normalizedState = String(requestedState || "").trim().toUpperCase();
  const delayFromBody = Number(requestedDelay);
  const delayMatch = message.match(/\b(\d{1,3})\s*(?:min|minuti|minute)\b/i);
  const delayMinutes = Number.isFinite(delayFromBody)
    ? Math.max(0, Math.min(360, Math.trunc(delayFromBody)))
    : delayMatch
      ? Math.max(0, Math.min(360, Number(delayMatch[1])))
      : null;
  const state = normalizedState === "DELAYED" || delayMinutes
    ? "DELAYED"
    : normalizedState === "ON_THE_WAY" || /sto arrivando|arrivo|in arrivo|per strada/i.test(message)
      ? "ON_THE_WAY"
      : null;
  return { state, delayMinutes } as const;
}

function normalizeOperationalStatus(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized || normalized === "PAID" || normalized === "PAGATO") return "PRENOTATO";
  if (normalized === "CONFIRMED" || normalized === "CONFERMATO") return "PRENOTATO";
  return normalized;
}

export async function GET(request: NextRequest) {
  const authError = authorizeBot(request);
  if (authError) return authError;

  try {
    const threshold = Math.max(
      0,
      Math.min(180, Number(request.nextUrl.searchParams.get("overdueMinutes") || 5)),
    );
    const [bookings, statusSetting, updateSetting] = await Promise.all([
      getBookingsForBot(request),
      prisma.setting.findUnique({ where: { key: STATUS_SETTING_KEY } }),
      prisma.setting.findUnique({ where: { key: BOT_UPDATE_SETTING_KEY } }),
    ]);
    const statuses = recordMap<{ status?: string }>(statusSetting?.value);
    const updates = recordMap<BotUpdate>(updateSetting?.value);
    const nowMs = Date.now();

    const filter = String(request.nextUrl.searchParams.get("filter") || "all").toLowerCase();
    const appointmentRows = bookings
      .map((booking) => ({
        booking,
        elapsedMinutes: Math.floor((nowMs - new Date(booking.start_date).getTime()) / 60_000),
        effectiveStatus: normalizeOperationalStatus(
          statuses[String(booking.id)]?.status ||
            booking.attendance ||
            booking.confirmation_status ||
            "PRENOTATO",
        ),
      }))
      .filter(
        ({ elapsedMinutes, effectiveStatus }) =>
          filter !== "overdue" ||
          (elapsedMinutes >= threshold && !terminalStatuses.has(effectiveStatus)),
      )
      .sort((a, b) => new Date(a.booking.start_date).getTime() - new Date(b.booking.start_date).getTime())
      .map(({ booking, elapsedMinutes, effectiveStatus }) => ({
        bookingId: String(booking.id),
        shopifyOrderId: booking.order_id || null,
        bookingCode: booking.booking_str || null,
        appointmentAt: booking.start_date,
        appointmentEndsAt: booking.end_date || null,
        elapsedMinutes,
        delayMinutes: elapsedMinutes > 0 && !terminalStatuses.has(effectiveStatus) ? elapsedMinutes : 0,
        isOverdue: elapsedMinutes >= threshold && !terminalStatuses.has(effectiveStatus),
        status: effectiveStatus,
        isCanceled: Boolean(booking.is_canceled),
        customer: {
          name: bookingCustomerName(booking),
          phone: bookingPhone(booking),
          email: booking.customer?.email || null,
        },
        service: booking.service?.title || "Servizio",
        price: {
          amount: booking.price?.amount ?? null,
          currency: booking.price?.currency || "EUR",
          financialStatus: booking.financial_status || null,
        },
        staff: (booking.teammates || [])
          .map((mate) => `${mate.firstname || ""} ${mate.lastname || ""}`.trim())
          .filter(Boolean),
        // Free text is intentionally omitted: Cowlendar notes, staff comments and
        // form answers can contain explicit or sensitive internal information.
        customerUpdate: updates[String(booking.id)] || null,
      }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      filter,
      privacy: {
        internalNotesExposed: false,
        staffCommentsExposed: false,
        formAnswersExposed: false,
      },
      count: appointmentRows.length,
      appointments: appointmentRows,
    });
  } catch (error) {
    console.error("Failed to provide appointments to bot:", error);
    return NextResponse.json({ error: "Impossibile recuperare gli appuntamenti." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = authorizeBot(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const customerPhone = normalizePhone(body?.customerPhone);
    const message = String(body?.message || "").trim().slice(0, 500);
    const clearUpdate = String(body?.action || "").trim().toUpperCase() === "CLEAR";
    const inferred = inferCustomerUpdate(message, body?.state, body?.delayMinutes);
    if (!bookingId && !customerPhone) {
      return NextResponse.json({ error: "bookingId o customerPhone obbligatorio." }, { status: 400 });
    }
    if (!clearUpdate && !inferred.state) {
      return NextResponse.json(
        { error: "Risposta non riconosciuta. Usa ON_THE_WAY, DELAYED, CLEAR oppure indica i minuti." },
        { status: 400 },
      );
    }

    const bookings = await getTodayBookings();
    const booking = bookings
      .filter((item) =>
        bookingId
          ? String(item.id) === bookingId
          : normalizePhone(bookingPhone(item)) === customerPhone,
      )
      .sort(
        (a, b) =>
          Math.abs(Date.now() - new Date(a.start_date).getTime()) -
          Math.abs(Date.now() - new Date(b.start_date).getTime()),
      )[0];
    if (!booking) {
      return NextResponse.json({ error: "Appuntamento odierno non trovato." }, { status: 404 });
    }

    const currentSetting = await prisma.setting.findUnique({ where: { key: BOT_UPDATE_SETTING_KEY } });
    const currentUpdates = recordMap<BotUpdate>(currentSetting?.value);

    if (clearUpdate) {
      const nextUpdates = { ...currentUpdates };
      delete nextUpdates[String(booking.id)];
      await prisma.setting.upsert({
        where: { key: BOT_UPDATE_SETTING_KEY },
        create: { key: BOT_UPDATE_SETTING_KEY, value: nextUpdates },
        update: { value: nextUpdates },
      });

      return NextResponse.json({
        success: true,
        cleared: true,
        bookingId: String(booking.id),
        customerName: bookingCustomerName(booking),
      });
    }

    const update: BotUpdate = {
      state: inferred.state!,
      delayMinutes: inferred.delayMinutes,
      message: message || null,
      updatedAt: new Date().toISOString(),
      source: "BOT",
    };
    await prisma.setting.upsert({
      where: { key: BOT_UPDATE_SETTING_KEY },
      create: { key: BOT_UPDATE_SETTING_KEY, value: { ...currentUpdates, [String(booking.id)]: update } },
      update: { value: { ...currentUpdates, [String(booking.id)]: update } },
    });

    const updateLabel = update.delayMinutes
      ? `Sta arrivando con ${update.delayMinutes} minuti di ritardo.`
      : "La cliente ha comunicato che sta arrivando.";
    const comment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: String(booking.id),
        user_name: "Bot appuntamenti",
        user_role: "BOT",
        message: `${updateLabel}${message ? ` Messaggio: “${message}”` : ""}`,
      },
    });

    return NextResponse.json({
      success: true,
      bookingId: String(booking.id),
      customerName: bookingCustomerName(booking),
      update,
      comment,
    });
  } catch (error) {
    console.error("Failed to save appointment bot update:", error);
    return NextResponse.json({ error: "Impossibile salvare la risposta della cliente." }, { status: 500 });
  }
}
