import Link from "next/link";
import { CalendarDays, ChevronRight, FileCheck2, FileText, IdCard, LockKeyhole, User, Mail, Fingerprint, Briefcase, ShieldAlert, MapPin, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClientProfile } from "./client-profile";
import { LogoutButton } from "@/components/logout-button";
import { ProfileSettings } from "@/components/profile-settings";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { monthlyPersonalHours } from "@/lib/personal-hours";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function displayDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(value)
    : "Non impostata";
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { location: true } });
  if (!user) redirect("/login");
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  
  const [schedules, logs, records, openRequests, documents, unreadNotifications, taskInProgress, colleagues] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, include: { category: true } }),
    prisma.attendanceLog.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } }, select: { date: true, type: true, timestamp: true }, orderBy: { timestamp: "asc" } }),
    prisma.workHourRecord.findMany({ where: { user_id: user.id, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.leaveRequest.count({ where: { user_id: user.id, status: "PENDING" } }),
    prisma.document.count({ where: { user_id: user.id } }),
    prisma.notification.count({ where: { user_id: session.user.id, read: false } }),
    prisma.staffTask.count({ where: { assigned_to_id: user.id, status: "ACTIVE" } }),
    prisma.user.findMany({
      where: {
        id: { not: user.id },
        active: true
      },
      take: 4,
      select: {
        id: true,
        name: true,
        photo_url: true,
      }
    })
  ]);
  
  const hours = monthlyPersonalHours(year, month, schedules, logs, records);
  const plannedHours = hours.reduce((total, row) => total + row.plannedHours, 0);
  const workedHours = hours.reduce((total, row) => total + row.workedHours, 0);

  return (
    <AppShell title="Profilo" role={session.user.role as Role} hideHeader hideMobileHeader>
      <ClientProfile
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          birthDateLabel: displayDate(user.birth_date),
          fiscalCode: user.fiscal_code ?? "Non impostato",
          contractStartLabel: displayDate(user.contract_start),
          contractEndLabel: displayDate(user.contract_end),
          photoUrl: user.photo_url,
          locationName: user.location?.name ?? "Non assegnato",
          role: session.user.role,
        }}
        colleagues={colleagues}
        stats={{
          plannedHours,
          workedHours,
          openRequests,
          documents,
          taskInProgress,
        }}
        unreadNotifications={unreadNotifications}
        settingsNode={
          <ProfileSettings
            photoUrl={user.photo_url}
            name={user.name}
            role={user.role}
            calendarSync={user.google_calendar_sync}
            calendarId={user.google_calendar_id}
          />
        }
      />
    </AppShell>
  );
}
