import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { parseIcal } from "@/lib/ical-parser";
import { OnlineConsultationsBrowser } from "@/components/online-consultations-browser";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

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
    
    events = parsed.map((e) => ({
      uid: e.uid,
      summary: e.summary,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    }));
  } catch (error: any) {
    console.error("Failed to load Google Calendar events from iCal:", error);
    loadError = error.message;
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
        <OnlineConsultationsBrowser 
          initialEvents={events} 
          serviceAccountEmail={serviceAccountEmail} 
        />
      </div>
    </AppShell>
  );
}
