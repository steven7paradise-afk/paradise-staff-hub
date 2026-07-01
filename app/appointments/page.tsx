import { redirect } from "next/navigation";
import { AppointmentsBrowser } from "@/components/appointments-browser";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { getShopifyOrderNamesBulk } from "@/lib/shopify";


export const dynamic = "force-dynamic";

const allowedRoles = new Set<Role>(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

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

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const mansione = (session.user as any).mansione as string | undefined;

  let canView = allowedRoles.has(role);
  if (!canView && role === "DIPENDENTE" && mansione && mansione.toLowerCase().includes("assistenza")) {
    canView = true;
  }

  if (!canView) redirect("/dashboard");

  const localUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, photo_url: true },
  });

  const localUsersByName = new Map(
    localUsers
      .filter((user) => normalizeName(user.name))
      .map((user) => [normalizeName(user.name), user]),
  );

  let loadError = "";
  let bookings = [] as Awaited<ReturnType<typeof getCowlendarBookingsForRange>>;

  if (hasCowlendarToken()) {
    try {
      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      bookings = await getCowlendarBookingsForRange({
        startDate: toIsoBoundary(rangeStart),
        endDate: toIsoBoundary(rangeEnd, true),
        limit: 3500,
      });
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Errore nel caricamento appuntamenti.";
    }
  }

  const orderIds = bookings.map((b: any) => b.order_id).filter(Boolean);
  const shopifyOrderNames = await getShopifyOrderNamesBulk(orderIds);


  const serializedBookings = bookings
    .filter((booking) => !booking.is_canceled)
    .map((booking) => {
      const bookingDate = new Date(booking.start_date);

      const teammates = (booking.teammates ?? [])
        .map((mate) => {
          const rawName = `${mate.firstname ?? ""} ${mate.lastname ?? ""}`.trim();
          const cleanedName = cleanTeamName(rawName);
          const matchedUser = localUsersByName.get(normalizeName(cleanedName));

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
          .filter((item) => {
            const label = normalizeName(item.label);
            return label.includes("note") || label.includes("memo") || label.includes("comment");
          })
          .map((item) => item.value),
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
        createdAt: booking.created_at || null,
        updatedAt: booking.updated_at || null,
        notesText: notesText || null,
        extraDetails,
      };
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

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
        <AppointmentsBrowser initialBookings={serializedBookings} />
      )}
    </AppShell>
  );
}
