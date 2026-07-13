import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MalattieManager } from "@/components/malattie-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MalattiePage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
  if (!allowedRoles.has(session.user.role)) {
    redirect("/dashboard");
  }

  const searchParamsResolved = await props.searchParams;
  const yearParam = searchParamsResolved.year ? String(searchParamsResolved.year) : null;

  let year: number;
  if (yearParam && /^\d{4}$/.test(yearParam)) {
    year = parseInt(yearParam, 10);
  } else {
    year = new Date().getFullYear();
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  // Fetch all disease requests for the year for active workers in active locations
  const requests = await prisma.leaveRequest.findMany({
    where: {
      type: "MALATTIA",
      start_date: { lte: endOfYear },
      end_date: { gte: startOfYear },
      user: {
        active: true,
        location: {
          active: true,
        },
        ...(session.user.role === "RESPONSABILE" 
          ? { sede_id: session.user.sedeId } 
          : {}),
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      start_date: "desc",
    },
  });

  // Fetch active workers for dropdown filter list
  const workers = await prisma.user.findMany({
    where: {
      active: true,
      role: { not: "SUPER_ADMIN" },
      ...(session.user.role === "RESPONSABILE" ? { sede_id: session.user.sedeId } : {}),
    },
    select: {
      id: true,
      name: true,
      photo_url: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Helper formatting values
  const yearLabel = `Anno ${year}`;
  const prevYearUrl = `/malattie?year=${year - 1}`;
  const nextYearUrl = `/malattie?year=${year + 1}`;

  return (
    <AppShell title="Malattie" subtitle="Gestione dei certificati medici e delle assenze dello staff.">
      <MalattieManager
        initialRequests={requests.map((r) => ({
          id: r.id,
          userId: r.user_id,
          employeeName: r.user.name,
          employeePhoto: r.user.photo_url,
          employeeFiscalCode: r.user.fiscal_code,
          startDate: r.start_date.toISOString(),
          endDate: r.end_date.toISOString(),
          startTime: r.start_time,
          endTime: r.end_time,
          reason: r.reason,
          status: r.status,
          medicalCode: r.medical_code,
          sicknessUnjustified: r.sickness_unjustified,
        }))}
        workers={workers.map((w) => ({
          id: w.id,
          name: w.name,
          photoUrl: w.photo_url
        }))}
        currentRole={session.user.role}
        monthLabel={yearLabel}
        prevMonthUrl={prevYearUrl}
        nextMonthUrl={nextYearUrl}
      />
    </AppShell>
  );
}
