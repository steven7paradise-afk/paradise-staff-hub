import { google } from "googleapis";
import type { LeaveRequest, Location, ScheduleCategory, ScheduleEntry, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LeaveRequestWithUser = LeaveRequest & { user: User };
type ScheduleEntryForCalendar = ScheduleEntry & {
  user: User;
  category: ScheduleCategory;
  location: Location | null;
};

const DEFAULT_CALENDAR_ID = "fee99b51672c8f5b5079181522a68a2f3a1e3791bd9af73c926d3feb109eab9d@group.calendar.google.com";
const DEFAULT_EXTRA_LEAVE_CALENDAR_IDS = [
  "cd56578ac3f02b555abd38d368d5f4a97aa91cf8ca74995f921baec95a8bada9@group.calendar.google.com",
];

function getPrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function eventDate(date: Date, time?: string | null) {
  if (!time) return { date: dateOnly(date) };
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "longOffset"
  }).format(date);
  const offset = tzString.split("GMT")[1] || "+02:00";
  return { dateTime: `${dateOnly(date)}T${time}:00${offset}`, timeZone: "Europe/Rome" };
}
function cleanCalendarId(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const match = trimmed.match(/\/ical\/([^/]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return trimmed;
}
function resolveExtraLeaveCalendarIds(primaryCalendarId: string) {
  const configured = process.env.GOOGLE_LEAVE_EXTRA_CALENDAR_IDS?.split(",") ?? [];
  return Array.from(new Set([...DEFAULT_EXTRA_LEAVE_CALENDAR_IDS, ...configured]
    .map((id) => id.trim())
    .filter((id) => id && id !== primaryCalendarId)));
}

function addLeaveTracking(event: ReturnType<typeof buildLeaveEvent>, leaveRequestId: string) {
  return {
    ...event,
    extendedProperties: {
      private: {
        paradiseSource: "leave-request",
        leaveRequestId,
      },
    },
  };
}

async function findTrackedLeaveEventId(calendar: any, calendarId: string, leaveRequestId: string) {
  const response = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [`leaveRequestId=${leaveRequestId}`],
    maxResults: 1,
    showDeleted: false,
    singleEvents: false,
  });
  return response.data.items?.[0]?.id ?? null;
}

async function upsertTrackedLeaveEvent(calendar: any, calendarId: string, leaveRequestId: string, event: ReturnType<typeof buildLeaveEvent>) {
  const trackedEvent = addLeaveTracking(event, leaveRequestId);
  const existingEventId = await findTrackedLeaveEventId(calendar, calendarId, leaveRequestId);

  if (existingEventId) {
    await calendar.events.update({
      calendarId,
      eventId: existingEventId,
      requestBody: trackedEvent,
      sendUpdates: "none",
    });
    return { calendarId, eventId: existingEventId, updated: true };
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: trackedEvent,
    sendUpdates: "none",
  });
  return { calendarId, eventId: response.data.id ?? null, updated: false };
}

async function deleteTrackedLeaveEvent(calendar: any, calendarId: string, leaveRequestId: string) {
  const existingEventId = await findTrackedLeaveEventId(calendar, calendarId, leaveRequestId);
  if (!existingEventId) {
    return { calendarId, skipped: true, reason: "No tracked leave event" };
  }

  await calendar.events.delete({
    calendarId,
    eventId: existingEventId,
    sendUpdates: "none",
  });
  return { calendarId, deleted: true, eventId: existingEventId };
}

async function resolveCalendarId() {
  let calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;

  const adminWithCalendar = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = cleanCalendarId(adminWithCalendar.google_calendar_id);
  }

  return calendarId;
}

async function getCalendarClient() {
  const calendarId = await resolveCalendarId();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!calendarId || !clientEmail || !privateKey) {
    return {
      skipped: true as const,
      reason: `Google Calendar not configured. calendarId: ${calendarId ? "present" : "missing"}, clientEmail: ${clientEmail ? "present" : "missing"}, privateKey: ${privateKey ? "present" : "missing"}`,
    };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return {
    skipped: false as const,
    calendarId,
    calendar: google.calendar({ version: "v3", auth }),
  };
}

function scheduleColorId(category: ScheduleCategory) {
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();

  if (code === "P" || code === "PE" || name.includes("permesso")) return "3";
  if (code === "F" || code === "FE" || name.includes("ferie")) return "7";
  if (code === "R" || code === "RI" || name.includes("riposo")) return "10";
  if (code === "M" || code === "MA" || code === "ML" || name.includes("malattia")) return "5";
  if (code === "C" || name.includes("chiuso")) return "4";
  if (code === "A" || name.includes("assenza")) return "6";
  if (code === "ND" || name.includes("non lavora")) return "11";

  return undefined;
}

/**
 * Returns true if the schedule category represents a leave type
 * (permesso, ferie, riposo, malattia) that should also be mirrored
 * to the extra leave calendars.
 */
function isLeaveCategory(category: ScheduleCategory): boolean {
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();
  return (
    code === "P" || code === "PE" || name.includes("permesso") ||
    code === "F" || code === "FE" || name.includes("ferie") ||
    code === "R" || code === "RI" || name.includes("riposo") ||
    code === "M" || code === "MA" || code === "ML" || name.includes("malattia")
  );
}

function buildScheduleEvent(entry: ScheduleEntryForCalendar) {
  const startTime = entry.start_time ?? entry.category.start_time;
  const endTime = entry.end_time ?? entry.category.end_time;
  const salone = entry.location?.name ?? "Sede non specificata";

  const code = entry.category.code.toUpperCase();
  const name = entry.category.name.toLowerCase();
  const isMalattiaOrRiposo = 
    code === "M" || code === "MA" || code === "ML" || name.includes("malattia") ||
    code === "R" || code === "RI" || name.includes("riposo");

  if (isMalattiaOrRiposo) {
    const originalTimeLabel = startTime && endTime ? `Orario programmato: ${startTime} - ${endTime}` : null;
    return {
      summary: `${entry.category.name} - ${entry.user.name}`,
      description: [
        `Dipendente: ${entry.user.name}`,
        `Email: ${entry.user.email}`,
        `Salone: ${salone}`,
        `Categoria: ${entry.category.code} - ${entry.category.name}`,
        originalTimeLabel,
        entry.note ? `Note: ${entry.note}` : null,
        "Creato automaticamente dal planning Paradise Staff Hub.",
      ].filter(Boolean).join("\n"),
      start: eventDate(entry.date),
      end: eventDate(addDays(entry.date, 1)),
      colorId: scheduleColorId(entry.category),
    };
  }

  const timeLabel = startTime && endTime ? ` ${startTime}-${endTime}` : "";
  return {
    summary: `${entry.category.name}${timeLabel} - ${entry.user.name}`,
    description: [
      `Dipendente: ${entry.user.name}`,
      `Email: ${entry.user.email}`,
      `Salone: ${salone}`,
      `Categoria: ${entry.category.code} - ${entry.category.name}`,
      entry.note ? `Note: ${entry.note}` : null,
      "Creato automaticamente dal planning Paradise Staff Hub.",
    ].filter(Boolean).join("\n"),
    start: eventDate(entry.date, startTime),
    end: endTime ? eventDate(entry.date, endTime) : eventDate(addDays(entry.date, 1)),
    colorId: scheduleColorId(entry.category),
  };
}

export async function syncScheduleEntryToGoogleCalendar(scheduleEntryId: string) {
  const entry = await prisma.scheduleEntry.findUnique({
    where: { id: scheduleEntryId },
    include: { user: true, category: true, location: true },
  });

  if (!entry) {
    return { skipped: true, reason: "Schedule entry not found" };
  }

  const isLeave = isLeaveCategory(entry.category);
  if (!isLeave) {
    if (entry.google_calendar_event_id) {
      await deleteScheduleEventFromGoogleCalendar(
        entry.google_calendar_event_id,
        entry.id,
        entry.user.google_calendar_id && entry.user.google_calendar_sync ? entry.user.google_calendar_id : null
      );
      await prisma.scheduleEntry.update({
        where: { id: entry.id },
        data: { google_calendar_event_id: null },
      });
      return { skipped: false, deleted: true, reason: "Non-leave category, removed from Google Calendar" };
    }
    return { skipped: true, reason: "Non-leave category (not synced)" };
  }

  const setup = await getCalendarClient();
  if (setup.skipped) return setup;

  const event = buildScheduleEvent(entry);
  let targetCalendarId = setup.calendarId;
  if (entry.user.google_calendar_id && entry.user.google_calendar_sync) {
    targetCalendarId = cleanCalendarId(entry.user.google_calendar_id);
  }

  // ── Primary calendar ──────────────────────────────────────────────
  let primaryEventId = entry.google_calendar_event_id;
  let updated = false;

  if (primaryEventId) {
    try {
      await setup.calendar.events.update({
        calendarId: targetCalendarId,
        eventId: primaryEventId,
        requestBody: event,
        sendUpdates: "none",
      });
      updated = true;
    } catch (error) {
      console.warn("Schedule event update failed, re-inserting:", error);
      primaryEventId = null; // fall through to insert
    }
  }

  if (!primaryEventId) {
    const response = await setup.calendar.events.insert({
      calendarId: targetCalendarId,
      requestBody: event,
      sendUpdates: "none",
    });
    primaryEventId = response.data.id ?? null;
    updated = false;

    if (primaryEventId) {
      await prisma.scheduleEntry.update({
        where: { id: entry.id },
        data: { google_calendar_event_id: primaryEventId },
      });
    }
  }

  // ── Extra leave calendars (ferie, permesso, riposo, malattia) ─────
  // Mirror the event to the extra calendars using the schedule entry id
  // as a stable tracking key so we can upsert/delete correctly.
  let extraCalendars: Array<{ calendarId: string; skipped?: boolean; error?: boolean; message?: string }> = [];
  if (isLeaveCategory(entry.category)) {
    const extraCalendarIds = resolveExtraLeaveCalendarIds(targetCalendarId);
    const results = await Promise.allSettled(
      extraCalendarIds.map((extraCalendarId) =>
        upsertTrackedLeaveEvent(setup.calendar, extraCalendarId, `schedule-${entry.id}`, event)
      )
    );
    extraCalendars = results.map((r) =>
      r.status === "fulfilled"
          ? r.value
          : { calendarId: "", error: true, message: r.reason instanceof Error ? r.reason.message : "Extra calendar sync failed" }
    );
  }

  return { skipped: false, eventId: primaryEventId, updated, extraCalendars };
}

export async function deleteScheduleEventFromGoogleCalendar(
  eventId?: string | null,
  scheduleEntryId?: string | null,
  userCalendarId?: string | null,
) {
  const setup = await getCalendarClient();
  if (setup.skipped) return setup;

  let targetCalendarId = setup.calendarId;
  if (userCalendarId) {
    targetCalendarId = cleanCalendarId(userCalendarId);
  } else if (scheduleEntryId) {
    const entry = await prisma.scheduleEntry.findUnique({
      where: { id: scheduleEntryId },
      include: { user: true },
    });
    if (entry?.user?.google_calendar_id && entry.user.google_calendar_sync) {
      targetCalendarId = cleanCalendarId(entry.user.google_calendar_id);
    }
  }

  // ── Primary calendar ──────────────────────────────────────────────
  let primaryResult: { deleted?: boolean; skipped?: boolean; reason?: string; error?: boolean; message?: string } = {
    skipped: true,
    reason: "No schedule event to delete",
  };

  if (eventId) {
    try {
      await setup.calendar.events.delete({
        calendarId: targetCalendarId,
        eventId,
        sendUpdates: "none",
      });
      primaryResult = { deleted: true };
    } catch (error) {
      console.error("Failed to delete schedule calendar event:", error);
      primaryResult = { error: true, message: error instanceof Error ? error.message : "Delete failed" };
    }
  }

  // ── Extra leave calendars ─────────────────────────────────────────
  // Remove the mirrored event from the extra leave calendars if the
  // schedule entry was a leave category (permesso/ferie/riposo/malattia).
  let extraCalendars: Array<unknown> = [];
  if (scheduleEntryId) {
    const extraCalendarIds = resolveExtraLeaveCalendarIds(setup.calendarId);
    const results = await Promise.allSettled(
      extraCalendarIds.map((extraCalendarId) =>
        deleteTrackedLeaveEvent(setup.calendar, extraCalendarId, `schedule-${scheduleEntryId}`)
      )
    );
    extraCalendars = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { error: true, message: r.reason instanceof Error ? r.reason.message : "Extra calendar delete failed" }
    );
  }

  return { ...primaryResult, eventId, extraCalendars };
}

export async function syncLeaveRequestToGoogleCalendar(leaveRequestId: string) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { user: true },
  });

  if (!leave) {
    return { skipped: true, reason: "Leave request not found" };
  }

  let calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  // Prioritize calendar ID configured in the admin's database settings
  const adminWithCalendar = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = cleanCalendarId(adminWithCalendar.google_calendar_id);
  }

  if (!calendarId || !clientEmail || !privateKey) {
    return { 
      skipped: true, 
      reason: `Google Calendar not configured. calendarId: ${calendarId ? "present" : "missing"}, clientEmail: ${clientEmail ? "present" : "missing"}, privateKey: ${privateKey ? "present" : "missing"}` 
    };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });
  const extraCalendarIds = resolveExtraLeaveCalendarIds(calendarId);

  // If rejected, delete the event from Google Calendar if it exists
  if (leave.status === "REJECTED") {
    const extraCalendars = await Promise.allSettled(
      extraCalendarIds.map((extraCalendarId) => deleteTrackedLeaveEvent(calendar, extraCalendarId, leave.id))
    );

    if (leave.google_calendar_event_id) {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: leave.google_calendar_event_id,
          sendUpdates: "none",
        });
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { google_calendar_event_id: null },
        });
        return {
          deleted: true,
          eventId: leave.google_calendar_event_id,
          extraCalendars: extraCalendars.map((result) => result.status === "fulfilled" ? result.value : { error: true, message: result.reason instanceof Error ? result.reason.message : "Delete failed" }),
        };
      } catch (error) {
        console.error("Failed to delete calendar event:", error);
        return { error: true, message: error instanceof Error ? error.message : "Delete failed" };
      }
    }
    return {
      skipped: true,
      reason: "Request rejected and no calendar event existed",
      extraCalendars: extraCalendars.map((result) => result.status === "fulfilled" ? result.value : { error: true, message: result.reason instanceof Error ? result.reason.message : "Delete failed" }),
    };
  }

  const event = buildLeaveEvent(leave);
  let primaryResult: { skipped: boolean; eventId: string | null | undefined; updated: boolean };

  if (leave.google_calendar_event_id) {
    try {
      await calendar.events.update({
        calendarId,
        eventId: leave.google_calendar_event_id,
        requestBody: addLeaveTracking(event, leave.id),
        sendUpdates: "none",
      });
      primaryResult = { skipped: false, eventId: leave.google_calendar_event_id, updated: true };
    } catch (error) {
      console.warn("Event update failed, re-inserting new event:", error);
      const response = await calendar.events.insert({ 
        calendarId, 
        requestBody: addLeaveTracking(event, leave.id),
        sendUpdates: "none"
      });
      const newEventId = response.data.id;
      if (newEventId) {
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { google_calendar_event_id: newEventId },
        });
      }
      primaryResult = { skipped: false, eventId: newEventId, updated: false };
    }
  } else {
    const response = await calendar.events.insert({ 
      calendarId, 
      requestBody: addLeaveTracking(event, leave.id),
      sendUpdates: "none"
    });
    const eventId = response.data.id;
    if (eventId) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: { google_calendar_event_id: eventId },
      });
    }

    primaryResult = { skipped: false, eventId, updated: false };
  }

  const extraCalendars = leave.status === "APPROVED"
    ? await Promise.allSettled(
        extraCalendarIds.map((extraCalendarId) => upsertTrackedLeaveEvent(calendar, extraCalendarId, leave.id, event))
      )
    : await Promise.allSettled(
        extraCalendarIds.map((extraCalendarId) => deleteTrackedLeaveEvent(calendar, extraCalendarId, leave.id))
      );

  return {
    ...primaryResult,
    extraCalendars: extraCalendars.map((result) => result.status === "fulfilled" ? result.value : { error: true, message: result.reason instanceof Error ? result.reason.message : "Google Calendar extra non sincronizzato" }),
  };
}

function buildLeaveEvent(leave: LeaveRequestWithUser) {
  const typeLabel = leave.type.toLowerCase();
  const statusPrefix = 
    leave.status === "PENDING" 
      ? "[IN ATTESA] " 
      : leave.status === "FLAGGED" 
        ? "[IN VERIFICA] " 
        : "";

  const summary = `${statusPrefix}${leave.type} - ${leave.user.name}`;
  
  const isMalattiaOrRiposo = 
    typeLabel.includes("malattia") || 
    typeLabel.includes("riposo");

  if (isMalattiaOrRiposo) {
    const originalTimeLabel = leave.start_time && leave.end_time ? `Orario richiesto: ${leave.start_time} - ${leave.end_time}` : null;
    const description = [
      `Dipendente: ${leave.user.name}`,
      `Email: ${leave.user.email}`,
      `Tipo: ${typeLabel}`,
      `Stato: ${leave.status}`,
      originalTimeLabel,
      leave.reason ? `Note: ${leave.reason}` : null,
      "Creato automaticamente da Paradise Staff Hub.",
    ].filter(Boolean).join("\n");

    return {
      summary,
      description,
      start: eventDate(leave.start_date),
      end: eventDate(addDays(leave.end_date, 1)),
    };
  }

  const description = [
    `Dipendente: ${leave.user.name}`,
    `Email: ${leave.user.email}`,
    `Tipo: ${typeLabel}`,
    `Stato: ${leave.status}`,
    leave.reason ? `Note: ${leave.reason}` : null,
    "Creato automaticamente da Paradise Staff Hub.",
  ].filter(Boolean).join("\n");

  if (leave.start_time && leave.end_time) {
    return {
      summary,
      description,
      start: eventDate(leave.start_date, leave.start_time),
      end: eventDate(leave.end_date, leave.end_time),
    };
  }

  return {
    summary,
    description,
    start: eventDate(leave.start_date),
    end: eventDate(addDays(leave.end_date, 1)),
  };
}

export async function syncCandidateEventsToGoogleCalendar(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate) {
    return { skipped: true, reason: "Candidate not found" };
  }

  let calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  // Prioritize calendar ID configured in the admin's database settings
  const adminWithCalendar = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = cleanCalendarId(adminWithCalendar.google_calendar_id);
  }

  if (!calendarId || !clientEmail || !privateKey) {
    return { 
      skipped: true, 
      reason: "Google Calendar credentials or calendar ID not configured." 
    };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  let videoEventId = candidate.video_calendar_event_id;
  let interviewEventId = candidate.interview_calendar_event_id;

  // 1. Sync Video Call Event
  if (candidate.video_date) {
    const start = new Date(candidate.video_date);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // + 30 minutes
    const event = {
      summary: `[CANDIDATURA] Video Call - ${candidate.first_name} ${candidate.last_name}`,
      description: `Videochiamata conoscitiva con ${candidate.first_name} ${candidate.last_name}\nMansione: ${candidate.profession}\nTelefono: ${candidate.phone}\nEmail: ${candidate.email}\nNote: ${candidate.video_notes || "Nessuna nota"}`,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Rome" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Rome" },
    };

    if (videoEventId) {
      try {
        await calendar.events.update({ calendarId, eventId: videoEventId, requestBody: event, sendUpdates: "none" });
      } catch (error) {
        console.warn("Candidate video call update failed, re-inserting:", error);
        try {
          const res = await calendar.events.insert({ calendarId, requestBody: event, sendUpdates: "none" });
          videoEventId = res.data.id || null;
        } catch (insertErr) {
          console.error("Failed to insert video calendar event:", insertErr);
        }
      }
    } else {
      try {
        const res = await calendar.events.insert({ calendarId, requestBody: event, sendUpdates: "none" });
        videoEventId = res.data.id || null;
      } catch (insertErr) {
        console.error("Failed to insert video calendar event:", insertErr);
      }
    }
  } else if (videoEventId) {
    // delete event if date cleared
    try {
      await calendar.events.delete({ calendarId, eventId: videoEventId, sendUpdates: "none" });
      videoEventId = null;
    } catch (e) {
      console.error("Failed to delete video calendar event:", e);
    }
  }

  // 2. Sync In-sede Interview Event
  if (candidate.interview_date) {
    const start = new Date(candidate.interview_date);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // + 1 hour
    const event = {
      summary: `[CANDIDATURA] Colloquio - ${candidate.first_name} ${candidate.last_name}`,
      description: `Colloquio dal vivo in sede con ${candidate.first_name} ${candidate.last_name}\nMansione: ${candidate.profession}\nTelefono: ${candidate.phone}\nEmail: ${candidate.email}\nSede: ${candidate.interview_location || "Sede da stabilire"}\nNote: ${candidate.interview_notes || "Nessuna nota"}`,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Rome" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Rome" },
    };

    if (interviewEventId) {
      try {
        await calendar.events.update({ calendarId, eventId: interviewEventId, requestBody: event, sendUpdates: "none" });
      } catch (error) {
        console.warn("Candidate interview update failed, re-inserting:", error);
        try {
          const res = await calendar.events.insert({ calendarId, requestBody: event, sendUpdates: "none" });
          interviewEventId = res.data.id || null;
        } catch (insertErr) {
          console.error("Failed to insert interview calendar event:", insertErr);
        }
      }
    } else {
      try {
        const res = await calendar.events.insert({ calendarId, requestBody: event, sendUpdates: "none" });
        interviewEventId = res.data.id || null;
      } catch (insertErr) {
        console.error("Failed to insert interview calendar event:", insertErr);
      }
    }
  } else if (interviewEventId) {
    // delete event if date cleared
    try {
      await calendar.events.delete({ calendarId, eventId: interviewEventId, sendUpdates: "none" });
      interviewEventId = null;
    } catch (e) {
      console.error("Failed to delete interview calendar event:", e);
    }
  }

  // Save changes to Candidate model
  if (videoEventId !== candidate.video_calendar_event_id || interviewEventId !== candidate.interview_calendar_event_id) {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        video_calendar_event_id: videoEventId,
        interview_calendar_event_id: interviewEventId,
      },
    });
  }

  return { success: true };
}

const SOCIAL_CALENDAR_ID = "c5ee9c83ef80be6108f6b3008bb9c998cd92cee0c09cdec7b903edbb5573af5b@group.calendar.google.com";

async function getSocialCalendarClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    return {
      skipped: true as const,
      reason: `Google Calendar credentials missing. clientEmail: ${clientEmail ? "present" : "missing"}, privateKey: ${privateKey ? "present" : "missing"}`,
    };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return {
    skipped: false as const,
    calendarId: SOCIAL_CALENDAR_ID,
    calendar: google.calendar({ version: "v3", auth }),
  };
}

export async function syncSocialPostToGoogleCalendar(socialPostId: string) {
  const post = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
  });

  if (!post) {
    return { skipped: true, reason: "Social post not found" };
  }

  const setup = await getSocialCalendarClient();
  if (setup.skipped) return setup;

  const startDateTime = post.scheduled_at.toISOString();
  const endDateTime = new Date(post.scheduled_at.getTime() + 30 * 60 * 1000).toISOString();

  const brandLabel = post.brand ? post.brand.split(",").map(b => b.trim() === "FRANCESCA" ? "FRANCESCA" : "PARADISE").join(" & ") : "PARADISE";
  const platformList = post.platform ? post.platform.split(",").join(" / ") : "";

  const event = {
    summary: `[${brandLabel}] ${post.title} (${platformList})`,
    description: [
      `Titolo: ${post.title}`,
      post.description ? `Descrizione: ${post.description}` : null,
      `Piattaforme: ${platformList}`,
      `Profilo/Brand: ${brandLabel}`,
      `Stato: ${post.status}`,
      post.video_url ? `Link Video: ${post.video_url}` : null,
      post.notes ? `Note: ${post.notes}` : null,
      `Gestito via Paradise Staff Hub.`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: startDateTime, timeZone: "Europe/Rome" },
    end: { dateTime: endDateTime, timeZone: "Europe/Rome" },
  };

  if (post.google_calendar_event_id) {
    try {
      await setup.calendar.events.update({
        calendarId: setup.calendarId,
        eventId: post.google_calendar_event_id,
        requestBody: event,
        sendUpdates: "none",
      });
      return { skipped: false, eventId: post.google_calendar_event_id, updated: true };
    } catch (error) {
      console.warn("Social event update failed, re-inserting:", error);
    }
  }

  const response = await setup.calendar.events.insert({
    calendarId: setup.calendarId,
    requestBody: event,
    sendUpdates: "none",
  });
  const eventId = response.data.id;

  if (eventId) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { google_calendar_event_id: eventId },
    });
  }

  return { skipped: false, eventId, updated: false };
}

export async function deleteSocialPostFromGoogleCalendar(eventId?: string | null) {
  if (!eventId) {
    return { skipped: true, reason: "No social post event to delete" };
  }

  const setup = await getSocialCalendarClient();
  if (setup.skipped) return setup;

  try {
    await setup.calendar.events.delete({
      calendarId: setup.calendarId,
      eventId,
      sendUpdates: "none",
    });
    return { deleted: true, eventId };
  } catch (error) {
    console.error("Failed to delete social calendar event:", error);
    return { deleted: false, error };
  }
}

export async function syncCowlendarConsultations(bookings: any[]) {
  const calendarId = "7492abf79691e5602a3b97a1765aefa2e9dab2e862a2add021338adefb197a55@group.calendar.google.com";
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    return { skipped: true, reason: "Google Calendar service account not configured." };
  }

  // Filter for consultations (only online consultations)
  const consultations = bookings.filter((b) => {
    const title = (b.serviceTitle || "").toLowerCase();
    return title.includes("consulenza") && title.includes("online");
  });

  if (consultations.length === 0) {
    return { skipped: true, reason: "No consultations found in range." };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    // Check calendar events from 1 month ago to 3 months in the future to detect duplicates
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 3);

    const existingEventsRes = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      maxResults: 2500,
    });

    const existingEvents = existingEventsRes.data.items || [];
    const syncedBookingIds = new Set<string>();

    for (const event of existingEvents) {
      const desc = event.description || "";
      const match = desc.match(/\[Cowlendar ID:\s*([^\]\s]+)\]/);
      if (match && match[1]) {
        syncedBookingIds.add(match[1]);
      }
    }

    let syncedCount = 0;

    for (const b of consultations) {
      const bookingId = String(b.id);
      if (syncedBookingIds.has(bookingId)) {
        continue;
      }

      const name = b.customerName || "Cliente";
      const phone = b.customerPhone || "Non indicato";
      const order = b.bookingStr || "Non indicato";
      const service = b.serviceTitle || "Consulenza";

      const start = b.startDate;
      const end = b.endDate || new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString();

      const description = [
        `Servizio: ${service}`,
        `Cliente: ${name}`,
        `Telefono: ${phone}`,
        `Ordine Shopify: ${order}`,
        `\n[Cowlendar ID: ${bookingId}]`
      ].join("\n");

      await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: `Consulenza Online - ${name}`,
          description,
          start: { dateTime: start },
          end: { dateTime: end },
        },
      });

      syncedCount++;
    }

    return { success: true, syncedCount };
  } catch (error: any) {
    console.error("Failed to sync Cowlendar consultations:", error);
    return { success: false, error: error.message };
  }
}

