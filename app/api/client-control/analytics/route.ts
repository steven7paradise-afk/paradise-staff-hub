import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";

export const dynamic = "force-dynamic";

function monthRange(monthParam: string | null) {
  const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  const [yearRaw, monthRaw] = (monthParam || fallback).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeYear = Number.isFinite(year) ? year : Number(fallback.slice(0, 4));
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : Number(fallback.slice(5, 7));
  const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0));
  return { key: `${safeYear}-${String(safeMonth).padStart(2, "0")}`, start, end };
}

function truthyCheck(value: unknown) {
  if (value === true) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return ["si", "sì", "true", "fatto", "ricevuta", "ok", "1"].includes(text);
}

function namesFromAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((name) => name.trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text.split(/[,;]+/).map((name) => name.trim()).filter(Boolean);
}

function countsInAnalytics(answers: Record<string, unknown>) {
  return String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare").trim().toLowerCase() !== "errore";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = pcToken ? await checkPCAuthorization(pcToken).catch(() => null) : null;
  let tabletDevice = null;
  if (!session?.user?.id && !pcAuth) {
    const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? "";
    tabletDevice = requestedDevice
      ? await authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)).catch(() => null)
      : null;
  }

  if (!session?.user?.id && !tabletDevice && !pcAuth) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { key, start, end } = monthRange(searchParams.get("month"));

  const forms = await prisma.serviceForm.findMany({
    where: { active: true },
    select: { id: true, name: true, category: true },
  });
  const clientFormIds = forms.filter((form) => isClientControlFormName(form.name, form.category)).map((form) => form.id);

  if (clientFormIds.length === 0) {
    return NextResponse.json({ month: key, salons: [], totals: { responses: 0, staff: 0 } });
  }

  const rawResponses = await prisma.serviceFormResponse.findMany({
    where: {
      form_id: { in: clientFormIds },
      created_at: { gte: start, lt: end },
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      answers: true,
      user_location_name: true,
      created_at: true,
      user: { select: { name: true } },
    },
  });

  // Filter out any "Finito" (dismissed/skipped) responses so they do not pollute analytics stats
  const responses = rawResponses.filter((resp) => {
    const answers = resp.answers as Record<string, unknown> | null;
    if (!answers) return true;
    const correctness = String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] || answers.client_control_correctness || "").trim().toLowerCase();
    return correctness !== "finito";
  });

  const employees = await prisma.user.findMany({
    where: {
      active: true,
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sede_id: true,
      location: { select: { id: true, name: true } },
    },
  });
  const canonicalEmployeeNames = employees.map((employee) => employee.name).filter((name): name is string => Boolean(name?.trim()));

  const recent = responses.slice(0, 30).map((response) => {
    const answers = response.answers as Record<string, unknown>;
    const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const staffNames = (selectedStaff.length > 0 ? selectedStaff : fallbackOwner.length > 0 ? fallbackOwner : [response.user?.name ?? "Senza responsabile"])
      .map((name) => resolveCanonicalStaffName(name, canonicalEmployeeNames));
    const checkCount =
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.notes]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.products]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.review]) ? 1 : 0);

    return {
      id: response.id,
      createdAt: response.created_at.toISOString(),
      salon: String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede"),
      client: String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "-"),
      staff: staffNames,
      paid: Number(String(answers[CLIENT_CONTROL_FIELD_IDS.paid] ?? "0").replace(",", ".")) || 0,
      deposit: Number(String(answers[CLIENT_CONTROL_FIELD_IDS.depositPaid] ?? "0").replace(",", ".")) || 0,
      checkCount,
      correctness: String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "Da controllare"),
      counts: countsInAnalytics(answers),
    };
  });

  const salonMap = new Map<string, {
    salon: string;
    responses: number;
    staff: Map<string, {
      name: string;
      services: number;
      notePhoto: number;
      products: number;
      reviews: number;
      checks: number;
    }>;
  }>();

  for (const response of responses) {
    const answers = response.answers as Record<string, unknown>;
    if (!countsInAnalytics(answers)) continue;
    const salon = String(answers[CLIENT_CONTROL_FIELD_IDS.location] || response.user_location_name || "Senza sede");
    if (!salonMap.has(salon)) {
      salonMap.set(salon, { salon, responses: 0, staff: new Map() });
    }

    const salonEntry = salonMap.get(salon)!;
    salonEntry.responses += 1;

    const selectedStaff = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
    const fallbackOwner = namesFromAnswer(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
    const staffNames = (selectedStaff.length > 0 ? selectedStaff : fallbackOwner.length > 0 ? fallbackOwner : ["Senza responsabile"])
      .map((name) => resolveCanonicalStaffName(name, canonicalEmployeeNames));

    const notePhoto =
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.notes]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.beforeMedia]) ? 1 : 0) +
      (truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.afterMedia]) ? 1 : 0);
    const products = truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.products]) ? 1 : 0;
    const reviews = truthyCheck(answers[CLIENT_CONTROL_FIELD_IDS.review]) ? 1 : 0;

    for (const name of staffNames) {
      const existing = salonEntry.staff.get(name) ?? {
        name,
        services: 0,
        notePhoto: 0,
        products: 0,
        reviews: 0,
        checks: 0,
      };
      existing.services += 1;
      existing.notePhoto += notePhoto;
      existing.products += products;
      existing.reviews += reviews;
      existing.checks += notePhoto + products + reviews;
      salonEntry.staff.set(name, existing);
    }
  }

  const salons = Array.from(salonMap.values()).map((salon) => ({
    salon: salon.salon,
    responses: salon.responses,
    staff: Array.from(salon.staff.values()).sort((a, b) => b.services - a.services || b.checks - a.checks || a.name.localeCompare(b.name)),
  })).sort((a, b) => b.responses - a.responses || a.salon.localeCompare(b.salon));

  const countedResponses = salons.reduce((sum, salon) => sum + salon.responses, 0);

  return NextResponse.json({
    month: key,
    salons,
    recent,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      locationId: employee.sede_id,
      locationName: employee.location?.name ?? "Senza sede",
    })),
    totals: {
      responses: countedResponses,
      rawResponses: responses.length,
      staff: salons.reduce((sum, salon) => sum + salon.staff.length, 0),
    },
  });
}
