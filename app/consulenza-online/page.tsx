import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { parseIcal } from "@/lib/ical-parser";
import { OnlineConsultationsBrowser } from "@/components/online-consultations-browser";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { syncCowlendarConsultations } from "@/lib/google-calendar";
import {
  consultationEventDedupeKey,
  cowlendarBookingToConsultationEvent,
  cowlendarIdFromConsultationDescription,
  isOnlineConsultationBooking,
} from "@/lib/online-consultations";

export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function toIsoBoundary(date: Date, endOfDay = false) {
  const copy = new Date(date);
  if (endOfDay) copy.setHours(23, 59, 59, 999);
  else copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function uniqueConsultationEvents(input: any[]) {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const unique = [];

  for (const event of input) {
    const cowlendarId = cowlendarIdFromConsultationDescription(event.description);
    const dedupeKey = consultationEventDedupeKey(event);

    if ((cowlendarId && seenIds.has(cowlendarId)) || (dedupeKey && seenKeys.has(dedupeKey))) {
      continue;
    }

    if (cowlendarId) seenIds.add(cowlendarId);
    if (dedupeKey) seenKeys.add(dedupeKey);
    unique.push(event);
  }

  return unique;
}

export default async function ConsulenzaOnlinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });

  const role = session.user.role as Role;
  let canView = accessUser
    ? await canAccessForUser(prisma, "/consulenza-online", accessUser)
    : allowedRoles.has(role);

  if (!canView && role === "DIPENDENTE" && accessUser?.mansione && accessUser.mansione.toLowerCase().includes("assistenza")) {
    canView = true;
  }

  if (!canView) {
    redirect("/dashboard");
  }

  let events: any[] = [];
  let loadError = "";
  let cowlendarSyncError = "";

  const icalUrl = "https://calendar.google.com/calendar/ical/7492abf79691e5602a3b97a1765aefa2e9dab2e862a2add021338adefb197a55%40group.calendar.google.com/private-175e9e6e0af6739193e4a308f2704fcf/basic.ics";

  try {
    const res = await fetch(icalUrl, {
      next: { revalidate: 60 }, // Cache it for 1 minute
      headers: {
        "Cache-Control": "no-cache",
      }
    });

    if (!res.ok) {
      throw new Error(`Impossibile recuperare il calendario Google: HTTP ${res.status}`);
    }

    const icalText = await res.text();
    const parsed = parseIcal(icalText);
    
    events = uniqueConsultationEvents(parsed.map((e) => ({
      uid: e.uid,
      summary: e.summary,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    })));
  } catch (error: any) {
    console.error("Failed to load Google Calendar events from iCal:", error);
    loadError = error.message;
  }

  if (hasCowlendarToken()) {
    try {
      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);
      const bookings = await getCowlendarBookingsForRange({
        startDate: toIsoBoundary(rangeStart),
        endDate: toIsoBoundary(rangeEnd, true),
        limit: 5000,
      });
      const consultations = bookings.filter((booking) => !booking.is_canceled && isOnlineConsultationBooking(booking));

      if (consultations.length > 0) {
        const syncResult = await syncCowlendarConsultations(consultations);
        if ((syncResult as any)?.success === false) {
          cowlendarSyncError = String((syncResult as any).error || "Sincronizzazione CowCalendar non riuscita.");
        }
      }

      const existingCowlendarIds = new Set(events.map((event) => cowlendarIdFromConsultationDescription(event.description)).filter(Boolean));
      const existingKeys = new Set(events.map(consultationEventDedupeKey).filter(Boolean));
      const directCowlendarEvents = [];

      for (const booking of consultations) {
        const event = cowlendarBookingToConsultationEvent(booking);
        const bookingId = String(booking.id);
        const eventKey = consultationEventDedupeKey(event);

        if (existingCowlendarIds.has(bookingId) || (eventKey && existingKeys.has(eventKey))) {
          continue;
        }

        existingCowlendarIds.add(bookingId);
        if (eventKey) existingKeys.add(eventKey);
        directCowlendarEvents.push(event);
      }

      events = uniqueConsultationEvents([...events, ...directCowlendarEvents])
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    } catch (error: any) {
      console.error("Failed to sync Cowlendar consultations from consulenza-online:", error);
      cowlendarSyncError = error?.message || "Errore nel caricamento CowCalendar.";
    }
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";

  return (
    <AppShell title="Consulenza Online" subtitle="Calendario appuntamenti e disponibilità." role={role} hideHeader>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        {loadError && (
          <div className="rounded-[24px] border border-red-100 bg-[#FFF6F7] p-5 text-sm text-[#A15062] shadow-sm">
            Errore nel caricamento del calendario Google: {loadError}
          </div>
        )}
        {cowlendarSyncError && (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800 shadow-sm">
            CowCalendar letto, ma sincronizzazione Google Calendar non completata: {cowlendarSyncError}
          </div>
        )}
        <OnlineConsultationsBrowser 
          initialEvents={events} 
          serviceAccountEmail={serviceAccountEmail} 
        />
      </div>
    </AppShell>
  );
}
