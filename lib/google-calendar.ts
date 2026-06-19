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
  return { dateTime: `${dateOnly(date)}T${time}:00`, timeZone: "Europe/Rome" };
}

async function resolveCalendarId() {
  let calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;

  const adminWithCalendar = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = adminWithCalendar.google_calendar_id.trim();
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

function buildScheduleEvent(entry: ScheduleEntryForCalendar) {
  const startTime = entry.start_time ?? entry.category.start_time;
  const endTime = entry.end_time ?? entry.category.end_time;
  const timeLabel = startTime && endTime ? ` ${startTime}-${endTime}` : "";
  const salone = entry.location?.name ?? "Sede non specificata";

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

  const setup = await getCalendarClient();
  if (setup.skipped) return setup;

  const event = buildScheduleEvent(entry);

  if (entry.google_calendar_event_id) {
    try {
      await setup.calendar.events.update({
        calendarId: setup.calendarId,
        eventId: entry.google_calendar_event_id,
        requestBody: event,
        sendUpdates: "none",
      });
      return { skipped: false, eventId: entry.google_calendar_event_id, updated: true };
    } catch (error) {
      console.warn("Schedule event update failed, re-inserting:", error);
    }
  }

  const response = await setup.calendar.events.insert({
    calendarId: setup.calendarId,
    requestBody: event,
    sendUpdates: "none",
  });
  const eventId = response.data.id;

  if (eventId) {
    await prisma.scheduleEntry.update({
      where: { id: entry.id },
      data: { google_calendar_event_id: eventId },
    });
  }

  return { skipped: false, eventId, updated: false };
}

export async function deleteScheduleEventFromGoogleCalendar(eventId?: string | null) {
  if (!eventId) {
    return { skipped: true, reason: "No schedule event to delete" };
  }

  const setup = await getCalendarClient();
  if (setup.skipped) return setup;

  try {
    await setup.calendar.events.delete({
      calendarId: setup.calendarId,
      eventId,
      sendUpdates: "none",
    });
    return { deleted: true, eventId };
  } catch (error) {
    console.error("Failed to delete schedule calendar event:", error);
    return { error: true, message: error instanceof Error ? error.message : "Delete failed" };
  }
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
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = adminWithCalendar.google_calendar_id.trim();
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

  // If rejected, delete the event from Google Calendar if it exists
  if (leave.status === "REJECTED") {
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
        return { deleted: true, eventId: leave.google_calendar_event_id };
      } catch (error) {
        console.error("Failed to delete calendar event:", error);
        return { error: true, message: error instanceof Error ? error.message : "Delete failed" };
      }
    }
    return { skipped: true, reason: "Request rejected and no calendar event existed" };
  }

  const event = buildLeaveEvent(leave);

  if (leave.google_calendar_event_id) {
    try {
      await calendar.events.update({
        calendarId,
        eventId: leave.google_calendar_event_id,
        requestBody: event,
        sendUpdates: "none",
      });
      return { skipped: false, eventId: leave.google_calendar_event_id, updated: true };
    } catch (error) {
      console.warn("Event update failed, re-inserting new event:", error);
      const response = await calendar.events.insert({ 
        calendarId, 
        requestBody: event,
        sendUpdates: "none"
      });
      const newEventId = response.data.id;
      if (newEventId) {
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { google_calendar_event_id: newEventId },
        });
      }
      return { skipped: false, eventId: newEventId, updated: false };
    }
  }

  const response = await calendar.events.insert({ 
    calendarId, 
    requestBody: event,
    sendUpdates: "none"
  });
  const eventId = response.data.id;
  if (eventId) {
    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { google_calendar_event_id: eventId },
    });
  }

  return { skipped: false, eventId, updated: false };
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
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
      google_calendar_sync: true,
      google_calendar_id: { not: null },
    },
    select: { google_calendar_id: true },
  });

  if (adminWithCalendar?.google_calendar_id) {
    calendarId = adminWithCalendar.google_calendar_id.trim();
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

