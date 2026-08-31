import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { prisma } from "@/lib/prisma";
import { romeDayRange } from "@/lib/shift-reports";
import { ReportSteps, type ScheduledWorker } from "./report-steps";

export const dynamic = "force-dynamic";

export default async function ShiftReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role)) redirect("/dashboard");
  if (["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/shift-reports/admin");

  const responsible = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      photo_url: true,
      sede_id: true,
      location: { select: { name: true } },
    },
  });
  const responsibleName = responsible?.name || session.user.name || "Responsabile";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const { date } = romeDayRange(today);
  const schedules = responsible?.sede_id ? await prisma.scheduleEntry.findMany({
    where: {
      date,
      OR: [
        { location_id: responsible.sede_id },
        { location_id: null, user: { sede_id: responsible.sede_id } },
      ],
      user: {
        active: true,
        employee_status: { not: FORMER_EMPLOYEE_STATUS },
        id: { not: session.user.id },
        role: { notIn: ["ZERO", "SUPER_ADMIN", "ADMIN"] },
      },
    },
    include: {
      user: { select: { id: true, name: true, photo_url: true } },
      category: { select: { code: true, name: true, start_time: true, end_time: true } },
    },
    orderBy: { user: { name: "asc" } },
  }) : [];
  const nonWorkingCategory = /RIPOS|FERIE|MALATT|PERMESS|ASSEN|CHIUS/;
  const scheduledWorkers: ScheduledWorker[] = schedules
    .filter((entry) => !nonWorkingCategory.test(`${entry.category.code} ${entry.category.name}`.toUpperCase()))
    .map((entry) => {
      const name = entry.user.name;
      const start = entry.start_time || entry.category.start_time;
      const end = entry.end_time || entry.category.end_time;
      return {
        id: entry.user.id,
        name,
        photoUrl: entry.user.photo_url,
        initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
        shiftTime: start && end ? `${start}–${end}` : start || end || "orario non indicato",
      };
    });

  return <AppShell title="Report di turno" subtitle="" hideHeader>
    <section className="flex min-h-[112px] items-center gap-4 rounded-[28px] border border-white/90 bg-[linear-gradient(105deg,rgba(255,225,242,0.88),rgba(255,250,247,0.9))] px-4 py-4 shadow-[0_14px_40px_rgba(104,62,79,0.08)] backdrop-blur-2xl sm:gap-5 sm:px-6">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/90 bg-gradient-to-br from-[#d96f9e] to-[#e999bd] text-lg font-black text-white shadow-md sm:size-[72px]">
        {responsible?.photo_url ? <img src={responsible.photo_url} alt="" className="h-full w-full object-cover" /> : responsibleName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a45a7d]">Report giornaliero</p>
        <h1 className="mt-1 truncate text-xl font-black tracking-[-0.035em] text-[#1d1d1f] sm:text-2xl">{responsible?.location?.name || "Sede non assegnata"}</h1>
        <p className="mt-1 truncate text-xs font-semibold text-[#6e6e73]">Compilato da {responsibleName}</p>
      </div>
      <div className="grid size-12 shrink-0 place-items-center rounded-full border border-[#e8a6c8] bg-white/70 text-[#cf5c98] shadow-sm sm:size-14" aria-hidden="true">
        <Heart className="size-5" />
      </div>
    </section>
    <ReportSteps workers={scheduledWorkers} />
  </AppShell>;
}
