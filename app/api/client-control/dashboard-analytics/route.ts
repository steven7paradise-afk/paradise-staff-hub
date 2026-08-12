import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";

export const dynamic = "force-dynamic";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((name) => name.trim()).filter(Boolean);
  return String(value ?? "").split(/[,;]+/).map((name) => name.trim()).filter(Boolean);
}

function moneyValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBuenosAires(value: unknown) {
  const text = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return text.includes("buenos") || text.includes("corso");
}

function countsInAnalytics(answers: Record<string, unknown>) {
  const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare").trim().toLowerCase();
  return correctness !== "errore" && correctness !== "finito" && correctness !== "no show";
}

function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}`;
}

function romeDay(date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", day: "2-digit" }).format(date));
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function serviceNames(answers: Record<string, unknown>) {
  const raw = String(
    answers[CLIENT_CONTROL_FIELD_IDS.productsList] ||
    answers.client_control_service_title ||
    answers.service_title ||
    "Servizio non specificato",
  ).trim();
  return raw.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
}

type DayBucket = { controls: number; revenue: number; services: Map<string, number> };
type MonthBucket = { controls: number; revenue: number; days: Map<number, DayBucket> };
type WorkerBucket = {
  id: string;
  name: string;
  photoUrl: string | null;
  months: Map<string, MonthBucket>;
};

export async function GET(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  if (!operationalUser?.id || !managementRoles.has(String(operationalUser.role))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  periodStart.setUTCDate(periodStart.getUTCDate() - 1);
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  const months = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2 + index, 1));
    const key = monthKey(date);
    return { key, label: monthLabel(key), daysInMonth: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate() };
  });

  const [forms, employees] = await Promise.all([
    prisma.serviceForm.findMany({ where: { active: true }, select: { id: true, name: true, category: true } }),
    prisma.user.findMany({
      where: {
        active: true,
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
        location: { OR: [
          { name: { contains: "Buenos", mode: "insensitive" } },
          { name: { contains: "Corso", mode: "insensitive" } },
        ] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, photo_url: true },
    }),
  ]);
  const formIds = forms.filter((form) => isClientControlFormName(form.name, form.category)).map((form) => form.id);
  if (!formIds.length) return NextResponse.json({ months, salon: [], workers: [], ranking: [], totals: { controls: 0, revenue: 0 } });

  const responses = await prisma.serviceFormResponse.findMany({
    where: { form_id: { in: formIds }, created_at: { gte: periodStart, lt: periodEnd } },
    orderBy: { created_at: "asc" },
    select: { answers: true, created_at: true, user_location_name: true, user: { select: { name: true } } },
  });

  const canonicalNames = employees.map((employee) => employee.name);
  const employeeByName = new Map(employees.map((employee) => [resolveCanonicalStaffName(employee.name, canonicalNames), employee]));
  const workerMap = new Map<string, WorkerBucket>();
  const salonMonths = new Map<string, MonthBucket>();
  for (const employee of employees) {
    const canonical = resolveCanonicalStaffName(employee.name, canonicalNames);
    workerMap.set(canonical, { id: employee.id, name: employee.name, photoUrl: employee.photo_url, months: new Map() });
  }

  for (const response of responses) {
    const answers = (response.answers as Record<string, unknown>) || {};
    const location = answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name;
    if (!isBuenosAires(location) || !countsInAnalytics(answers)) continue;

    const key = monthKey(response.created_at);
    if (!months.some((month) => month.key === key)) continue;
    const day = romeDay(response.created_at);
    const totalRevenue = moneyValue(answers[CLIENT_CONTROL_FIELD_IDS.depositPaid]) + moneyValue(answers[CLIENT_CONTROL_FIELD_IDS.paid]);
    const services = serviceNames(answers);

    // Salon revenue counts each client control exactly once. It must not grow
    // when the same client was handled by two or more workers.
    const salonMonth = salonMonths.get(key) || { controls: 0, revenue: 0, days: new Map<number, DayBucket>() };
    const salonDay = salonMonth.days.get(day) || { controls: 0, revenue: 0, services: new Map<string, number>() };
    salonMonth.controls += 1;
    salonMonth.revenue += totalRevenue;
    salonDay.controls += 1;
    salonDay.revenue += totalRevenue;
    for (const service of services) salonDay.services.set(service, (salonDay.services.get(service) || 0) + 1);
    salonMonth.days.set(day, salonDay);
    salonMonths.set(key, salonMonth);

    const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const owner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const names = [...new Set((selectedStaff.length ? selectedStaff : owner.length ? owner : [response.user?.name || ""])
      .map((name) => resolveCanonicalStaffName(name, canonicalNames))
      .filter((name) => employeeByName.has(name)))];
    if (!names.length) continue;
    const revenueShare = totalRevenue / names.length;

    for (const name of names) {
      const worker = workerMap.get(name)!;
      const month = worker.months.get(key) || { controls: 0, revenue: 0, days: new Map<number, DayBucket>() };
      const daily = month.days.get(day) || { controls: 0, revenue: 0, services: new Map<string, number>() };
      month.controls += 1;
      month.revenue += revenueShare;
      daily.controls += 1;
      daily.revenue += revenueShare;
      for (const service of services) daily.services.set(service, (daily.services.get(service) || 0) + 1);
      month.days.set(day, daily);
      worker.months.set(key, month);
    }
  }

  const workers = Array.from(workerMap.values()).map((worker) => {
    const serializedMonths = months.map((monthInfo) => {
      const month = worker.months.get(monthInfo.key);
      return {
        ...monthInfo,
        controls: month?.controls || 0,
        revenue: Math.round((month?.revenue || 0) * 100) / 100,
        days: Array.from({ length: 31 }, (_, index) => {
          const day = index + 1;
          const data = month?.days.get(day);
          return {
            day,
            valid: day <= monthInfo.daysInMonth,
            controls: data?.controls || 0,
            revenue: Math.round((data?.revenue || 0) * 100) / 100,
            services: data ? Array.from(data.services.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) : [],
          };
        }),
      };
    });
    const controls = serializedMonths.reduce((sum, month) => sum + month.controls, 0);
    const revenue = serializedMonths.reduce((sum, month) => sum + month.revenue, 0);
    return {
      id: worker.id,
      name: worker.name,
      photoUrl: worker.photoUrl,
      controls,
      revenue: Math.round(revenue * 100) / 100,
      averageRevenue: controls ? Math.round((revenue / controls) * 100) / 100 : 0,
      months: serializedMonths,
    };
  }).sort((a, b) => b.controls - a.controls || b.revenue - a.revenue || a.name.localeCompare(b.name, "it"));

  const salon = months.map((monthInfo) => {
    const month = salonMonths.get(monthInfo.key);
    return {
      ...monthInfo,
      controls: month?.controls || 0,
      revenue: Math.round((month?.revenue || 0) * 100) / 100,
      days: Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        const data = month?.days.get(day);
        return {
          day,
          valid: day <= monthInfo.daysInMonth,
          controls: data?.controls || 0,
          revenue: Math.round((data?.revenue || 0) * 100) / 100,
          services: data ? Array.from(data.services.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) : [],
        };
      }),
    };
  });

  return NextResponse.json({
    months,
    salon,
    workers,
    ranking: workers.map(({ id, name, photoUrl, controls, revenue, averageRevenue }) => ({ id, name, photoUrl, controls, revenue, averageRevenue })),
    totals: {
      controls: workers.reduce((sum, worker) => sum + worker.controls, 0),
      revenue: Math.round(workers.reduce((sum, worker) => sum + worker.revenue, 0) * 100) / 100,
    },
  });
}
