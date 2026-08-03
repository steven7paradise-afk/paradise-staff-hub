import { redirect } from "next/navigation";
import { AppointmentsBrowser } from "@/components/appointments-browser";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { getCowlendarBookingsForRange, getCowlendarServices, hasCowlendarToken } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { getShopifyOrderNamesBulk } from "@/lib/shopify";
import { syncCowlendarConsultations } from "@/lib/google-calendar";
import { getAppointmentStatusesFromGoogleSheet } from "@/lib/google-sheet";

export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

function normalizeName(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTeamName(value?: string | null) {
  return (value || "")
    .replace(/\|.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchUserByTeamName<T extends { name: string }>(users: T[], teamName: string) {
  const normalizedTeamName = normalizeName(teamName);
  if (!normalizedTeamName) return null;

  const exact = users.find((user) => normalizeName(user.name) === normalizedTeamName);
  if (exact) return exact;

  const teamParts = normalizedTeamName.split(" ").filter(Boolean);
  if (teamParts.length === 1) {
    const firstNameMatches = users.filter((user) => normalizeName(user.name).split(" ")[0] === teamParts[0]);
    if (firstNameMatches.length === 1) return firstNameMatches[0];
  }

  const containsMatches = users.filter((user) => {
    const userName = normalizeName(user.name);
    return teamParts.every((part) => userName.split(" ").includes(part));
  });
  return containsMatches.length === 1 ? containsMatches[0] : null;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toIsoBoundary(date: Date, endOfDay = false) {
  const copy = new Date(date);
  if (endOfDay) copy.setHours(23, 59, 59, 999);
  else copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function dedupeDetails(items: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalizeName(item.label)}::${item.value.trim()}`;
    if (!item.value.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSalonFromText(value?: string | null): "duomo" | "buenos-aires" | "ufficio" | "altro" {
  const source = normalizeName(value);
  if (!source) return "altro";
  if (source.includes("duomo")) return "duomo";
  if (source.includes("buenos aires") || source.includes("corso buenos aires")) return "buenos-aires";
  if (source.includes("ufficio paradise") || source.includes("ufficio")) return "ufficio";
  return "altro";
}

function isCorsoLocation(value?: string | null) {
  const source = normalizeName(value);
  return source.includes("buenos") || source.includes("corso");
}

function flattenBookingEntries(value: unknown, prefix = ""): Array<{ key: string; value: string }> {
  if (value == null || value === "") return [];

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [{ key: prefix || "value", value: String(value) }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenBookingEntries(item, prefix ? `${prefix} ${index + 1}` : `item ${index + 1}`));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenBookingEntries(nested, prefix ? `${prefix} ${key}` : key),
    );
  }

  return [];
}

function findImageUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(trimmed) ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = ["image_url", "imageUrl", "thumbnail", "photo", "photo_url", "url", "src"];

    for (const key of preferredKeys) {
      const found = findImageUrl(record[key]);
      if (found) return found;
    }

    for (const [key, nested] of Object.entries(record)) {
      if (!/image|photo|thumb|picture|media/i.test(key)) continue;
      const found = findImageUrl(nested);
      if (found) return found;
    }
  }

  return null;
}

function prettifyBookingLabel(value: string) {
  return value
    .replace(/^form data /i, "")
    .replace(/^quantity details \d+ /i, "")
    .replace(/^unit quantity$/i, "Quantita unita")
    .replace(/^quantity$/i, "Quantita")
    .replace(/^order id$/i, "Ordine Shopify")
    .replace(/^booking str$/i, "Codice prenotazione")
    .replace(/^numero telefono$/i, "Numero telefono")
    .replace(/^firstname$/i, "Nome")
    .replace(/^lastname$/i, "Cognome")
    .replace(/^email$/i, "Email")
    .replace(/^ig tag$/i, "IG tag")
    .replace(/^name$/i, "Nome")
    .replace(/\s+/g, " ")
    .trim();
}

function isCowlendarNoteField(label: string) {
  const normalized = normalizeName(label);
  return [
    "note",
    "nota",
    "memo",
    "comment",
    "commento",
    "messaggio",
    "message",
    "osservazione",
    "osservazioni",
    "richiesta",
    "richieste",
    "preferenza",
    "preferenze",
    "indicazione",
    "indicazioni",
  ].some((keyword) => normalized.includes(keyword));
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const forceRefresh = resolvedSearchParams?.refresh === "true";

  const role = session.user.role as Role;

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });

  let canView = accessUser
    ? await canAccessForUser(prisma, "/appointments", accessUser)
    : allowedRoles.has(role);
  if (!canView && role === "DIPENDENTE" && accessUser?.mansione && accessUser.mansione.toLowerCase().includes("assistenza")) {
    canView = true;
  }

  if (!canView) redirect("/dashboard");

  const localUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, photo_url: true, location: { select: { name: true } } },
  });

  let loadError = "";
  let bookings = [] as Awaited<ReturnType<typeof getCowlendarBookingsForRange>>;
  let services = [] as Awaited<ReturnType<typeof getCowlendarServices>>;

  if (hasCowlendarToken()) {
    try {
      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);

      [bookings, services] = await Promise.all([
        getCowlendarBookingsForRange({
          startDate: toIsoBoundary(rangeStart),
          endDate: toIsoBoundary(rangeEnd, true),
          limit: 5000,
          forceRefresh,
        }),
        getCowlendarServices(forceRefresh),
      ]);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Errore nel caricamento appuntamenti.";
    }
  }

  const corsoUsers = localUsers.filter((user) => isCorsoLocation(user.location?.name));

  const cowlendarTeamOptionsById = new Map<string, { id: string; name: string; photoUrl?: string | null }>();
  const cowlendarTeammates = [
    ...bookings.flatMap((booking) => booking.teammates ?? []),
    ...services.flatMap((service) => service.teammates ?? []),
  ];

  for (const mate of cowlendarTeammates) {
    const name = cleanTeamName(`${mate.firstname ?? ""} ${mate.lastname ?? ""}`.trim());
    const matchedUser = matchUserByTeamName(corsoUsers, name);
    if (!mate.id || !name || !matchedUser) continue;
    cowlendarTeamOptionsById.set(mate.id, {
      id: mate.id,
      name,
      photoUrl: matchedUser.photo_url || mate.thumbnail || null,
    });
  }

  const corsoTeamOptions = [...cowlendarTeamOptionsById.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));

  const [shopifyOrderNames, statusSetting, sheetStatusOverrides] = await Promise.all([
    getShopifyOrderNamesBulk(bookings.map((b: any) => b.order_id).filter(Boolean)),
    prisma.setting.findUnique({ where: { key: "appointment_status_overrides" } }),
    getAppointmentStatusesFromGoogleSheet(bookings.map((booking: any) => ({
      id: String(booking.id),
      customerName:
        booking.customer?.name?.trim() ||
        [booking.form_data?.firstname, booking.form_data?.lastname]
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
          .join(" ") ||
        booking.booking_str ||
        "",
      customerPhone:
        booking.customer?.phone ||
        booking.form_data?.["Numero telefono"] ||
        booking.form_data?.phone ||
        booking.form_data?.telefono ||
        null,
      startDate: booking.start_date,
    }))),
  ]);

  const statusOverrides =
    statusSetting?.value && typeof statusSetting.value === "object" && !Array.isArray(statusSetting.value)
      ? (statusSetting.value as Record<string, { status?: string; updatedAt?: string; updatedBy?: string }>)
      : {};

  const serializedBookings = bookings
    .map((booking) => {
      const bookingDate = new Date(booking.start_date);

      const teammates = (booking.teammates ?? [])
        .map((mate) => {
          const rawName = `${mate.firstname ?? ""} ${mate.lastname ?? ""}`.trim();
          const cleanedName = cleanTeamName(rawName);
          const matchedUser = matchUserByTeamName(localUsers, cleanedName);

          return {
            id: mate.id,
            name: cleanedName,
            photoUrl: matchedUser?.photo_url || mate.thumbnail || null,
          };
        })
        .filter((mate) => mate.name);

      const inferredSalon: "duomo" | "buenos-aires" | "ufficio" | "altro" =
        [booking.service?.title, booking.booking_str, ...(booking.teammates ?? []).map((mate) => `${mate.firstname ?? ""} ${mate.lastname ?? ""}`)]
          .map(getSalonFromText)
          .find((value) => value !== "altro") || "altro";

      const usedKeys = new Set([
        "id",
        "booking_str",
        "booking_type",
        "order_id",
        "start_date",
        "end_date",
        "timezone",
        "service",
        "customer",
        "teammates",
        "price",
        "confirmation_status",
        "attendance",
        "financial_status",
        "notes",
        "note",
        "internal_note",
        "customer_note",
        "is_canceled",
        "created_at",
        "updated_at",
      ]);

      const extraDetails = dedupeDetails(
        Object.entries(booking)
        .filter(([key, value]) => !usedKeys.has(key) && value != null && value !== "")
        .flatMap(([key, value]) => flattenBookingEntries(value, key))
        .map((item) => ({
          label: prettifyBookingLabel(item.key.replace(/_/g, " ")),
          value: item.value,
        })),
      );

      const noteCandidates = [
        booking.notes,
        booking.note,
        booking.internal_note,
        booking.customer_note,
        ...extraDetails
          .filter((item) => isCowlendarNoteField(item.label))
          .map((item) => `${item.label}: ${item.value}`),
      ]
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      const notesText = [...new Set(noteCandidates)].join("\n\n");

      const customerFullName =
        booking.customer?.name?.trim() ||
        [booking.form_data?.firstname, booking.form_data?.lastname]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" ") ||
        booking.booking_str ||
        "Cliente";

      return {
        id: booking.id,
        customerName: customerFullName,
        customerEmail: booking.customer?.email || null,
        customerPhone: booking.customer?.phone || null,
        serviceTitle: booking.service?.title || "Servizio",
        serviceImageUrl: findImageUrl(booking.service) || findImageUrl(booking),
        bookingType: booking.booking_type || null,
        bookingStr: booking.order_id 
          ? (shopifyOrderNames.get(String(booking.order_id)) || `#${booking.order_id}`) 
          : null,
        startDate: booking.start_date,
        endDate: booking.end_date || null,
        dateKey: localDateKey(bookingDate),
        inferredSalon,
        teammates,
        priceAmount: booking.price?.amount ?? null,
        priceCurrency: booking.price?.currency || "EUR",
        confirmationStatus: booking.confirmation_status || null,
        financialStatus: booking.financial_status || null,
        attendance: booking.attendance || null,
        isCanceled: Boolean(booking.is_canceled),
        localStatus: sheetStatusOverrides[String(booking.id)]?.status ?? statusOverrides[String(booking.id)]?.status ?? null,
        statusUpdatedAt: sheetStatusOverrides[String(booking.id)]?.updatedAt ?? statusOverrides[String(booking.id)]?.updatedAt ?? null,
        statusUpdatedBy: sheetStatusOverrides[String(booking.id)]?.updatedBy ?? statusOverrides[String(booking.id)]?.updatedBy ?? null,
        sheetMatched: Boolean(sheetStatusOverrides[String(booking.id)]),
        sheetNote: sheetStatusOverrides[String(booking.id)]?.sheetNote ?? null,
        createdAt: booking.created_at || null,
        updatedAt: booking.updated_at || null,
        notesText: notesText || null,
        extraDetails,
      };
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  if (hasCowlendarToken() && serializedBookings.length > 0) {
    try {
      await syncCowlendarConsultations(serializedBookings);
    } catch (err) {
      console.error("Auto-sync Cowlendar consultations failed:", err);
    }
  }

  return (
    <AppShell title="Appuntamenti" subtitle="Agenda interna appuntamenti." role={role} hideHeader>
      {!hasCowlendarToken() ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <section className="rounded-[28px] border border-[#F1D7DD] bg-[#FFF7F9] px-5 py-6 text-sm text-[#A15062] shadow-sm">
            Manca `COWLENDAR_API_TOKEN` nell&apos;ambiente del progetto.
          </section>
        </div>
      ) : null}

      {loadError ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <section className="rounded-[28px] border border-[#F7D9DD] bg-[#FFF6F7] px-5 py-6 text-sm text-[#A15062] shadow-sm">
            Non sono riuscito a leggere Cowlendar adesso: {loadError}
          </section>
        </div>
      ) : (
        <AppointmentsBrowser initialBookings={serializedBookings} corsoTeamOptions={corsoTeamOptions} />
      )}
    </AppShell>
  );
}
