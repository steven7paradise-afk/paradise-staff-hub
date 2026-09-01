import type { Metadata } from "next";
import { TabletClock } from "@/components/tablet-clock";
import { cookies, headers } from "next/headers";
import { getBrandingTheme } from "@/lib/branding";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureClientControlForm, CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";
import { getCowlendarBookingsForRange, hasCowlendarToken } from "@/lib/cowlendar";
import { getShopifyOrderNamesBulk, isFuzzyNameMatch } from "@/lib/shopify";


export const dynamic = "force-dynamic";

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

function getSalonFromText(value?: string | null): "duomo" | "buenos-aires" | "ufficio" | "altro" {
  const source = normalizeName(value);
  if (!source) return "altro";
  if (source.includes("duomo")) return "duomo";
  if (source.includes("buenos aires") || source.includes("corso buenos aires")) return "buenos-aires";
  if (source.includes("ufficio paradise") || source.includes("ufficio")) return "ufficio";
  return "altro";
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Tablet Clock | Paradise",
    description: "Tablet clock-in and appointment manager interface.",
    manifest: "/tablet-clock-manifest.webmanifest",
    icons: {
      icon: [
        { url: "/tablet-clock-icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/tablet-clock-icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/tablet-clock-icon-180.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: "Paradise Clock",
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function TabletClockPage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const params = await searchParams;
  const [cookieStore, headerStore, session] = await Promise.all([
    cookies(),
    headers(),
    auth()
  ]);
  const requestedDevice = params.device ?? cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  
  let device = null;
  let branding = null;
  let tabletBranding = null;
  let clientControlFormId: string | null = null;
  let todayAppointments = [] as any[];
  
  try {
    const now = new Date();
    // Format start of today and end of tomorrow in Europe/Rome timezone
    const romeDateTodayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const romeDateTomorrowStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(tomorrow);
    const startIso = `${romeDateTodayStr}T00:00:00.000Z`;
    const endIso = `${romeDateTomorrowStr}T23:59:59.999Z`;

    const [dev, brand, tabletSetting, bookingsRaw, localUsers, clientControlResponses] = await Promise.all([
      authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)),
      getBrandingTheme(),
      prisma.setting.findUnique({ where: { key: "tablet_branding" } }),
      hasCowlendarToken()
        ? getCowlendarBookingsForRange({
            startDate: startIso,
            endDate: endIso,
            limit: 150,
          })
        : Promise.resolve([]),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true, photo_url: true },
      }),
      prisma.serviceFormResponse.findMany({
        where: {
          form: {
            name: { contains: "controllo cliente", mode: "insensitive" }
          }
        },
        orderBy: {
          created_at: "desc"
        },
        take: 1000,
        select: {
          id: true,
          created_at: true,
          answers: true,
        }
      })
    ]);

    device = dev;
    branding = brand;
    tabletBranding = tabletSetting ? (tabletSetting.value as any) : null;
    
    if (dev?.location?.id) {
      const clientControlForm = await ensureClientControlForm(session?.user?.id ?? null);
      clientControlFormId = clientControlForm.active ? clientControlForm.id : null;

      const orderIds = bookingsRaw.map((b) => b.order_id).filter(Boolean);
      const shopifyOrderNames = await getShopifyOrderNamesBulk(orderIds);


      // Filter today's appointments for this salon!
      const salonLower = dev.location.name.toLowerCase();
      const targetSalonKey: "duomo" | "buenos-aires" | "altro" =
        salonLower.includes("duomo") ? "duomo" :
        (salonLower.includes("buenos aires") || salonLower.includes("corso buenos aires")) ? "buenos-aires" :
        "altro";
        
      const localUsersByName = new Map(
        localUsers
          .filter((user) => normalizeName(user.name))
          .map((user) => [normalizeName(user.name), user]),
      );

      // Track which orders or clients have been checked out recently
      const savedOrders = new Set<string>();
      // Map of date string YYYY-MM-DD (in Europe/Rome) -> Set of normalized client names checked out on that day
      const savedClientNamesByDate = new Map<string, Set<string>>();
      // Track which booking IDs have been checked out
      const savedBookingIds = new Set<string>();

      for (const resp of clientControlResponses) {
        const answers = resp.answers as Record<string, any>;
        if (!answers) continue;

        // Track completed checkouts
        const order = String(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").trim().toLowerCase().replace(/^#/, "");
        if (order) {
          savedOrders.add(order);
        }
        const client = String(answers[CLIENT_CONTROL_FIELD_IDS.clientName] || "").trim().toLowerCase();
        if (client) {
          const respDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(resp.created_at));
          if (!savedClientNamesByDate.has(respDateStr)) {
            savedClientNamesByDate.set(respDateStr, new Set());
          }
          savedClientNamesByDate.get(respDateStr)!.add(client);
        }
        const bId = String(answers.booking_id || "").trim();
        if (bId) {
          savedBookingIds.add(bId);
        }
      }

      const mappedBookings = bookingsRaw
        .filter((booking) => !booking.is_canceled)
        .map((booking) => {
          const bookingDate = new Date(booking.start_date);
          
          const inferredSalon: "duomo" | "buenos-aires" | "ufficio" | "altro" =
            [booking.service?.title, booking.booking_str, ...(booking.teammates ?? []).map((mate) => `${mate.firstname ?? ""} ${mate.lastname ?? ""}`)]
               .map(getSalonFromText)
               .find((value) => value !== "altro") || "altro";

          // Calculate staff members (teammates)
          const teammates = (booking.teammates ?? [])
            .map((mate) => {
              const rawName = `${mate.firstname ?? ""} ${mate.lastname ?? ""}`.trim();
              const cleanedName = cleanTeamName(rawName);
              const matchedUser = localUsersByName.get(normalizeName(cleanedName));
              return {
                name: cleanedName,
                photoUrl: matchedUser?.photo_url || mate.thumbnail || null,
              };
            })
            .filter(mate => mate.name);

          // Compute full name: try form_data first (e.g. first and last name), then fall back to customer.name
          let customerFullName = booking.customer?.name?.trim() || "";
          const formFirstName = String(booking.form_data?.firstname || "").trim();
          const formLastName = String(booking.form_data?.lastname || "").trim();
          const formFullName = [formFirstName, formLastName].filter(Boolean).join(" ");

          if (formFullName) {
            customerFullName = formFullName;
          }

          if (!customerFullName) {
            customerFullName = "Cliente";
          }

          // Format start time as HH:MM in Europe/Rome timezone
          const time = new Intl.DateTimeFormat("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Rome",
          }).format(bookingDate);

          const bookingRomeDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(bookingDate);
          const orderName = booking.order_id ? shopifyOrderNames.get(String(booking.order_id)) : null;
          const cleanOrderName = (orderName || "").trim().toLowerCase().replace(/^#/, "");
          const cleanBookingOrder = (booking.booking_str || "").trim().toLowerCase().replace(/^#/, "");
          const cleanClientName = customerFullName.trim().toLowerCase();
          
          const orderMatched = (cleanOrderName && savedOrders.has(cleanOrderName)) || 
                               (cleanBookingOrder && savedOrders.has(cleanBookingOrder));
          
          let nameMatched = false;
          const savedNames = savedClientNamesByDate.get(bookingRomeDateStr);
          if (savedNames && cleanClientName) {
            for (const savedName of savedNames) {
              if (savedName.includes(cleanClientName) || cleanClientName.includes(savedName) || isFuzzyNameMatch(cleanClientName, savedName)) {
                nameMatched = true;
                break;
              }
            }
          }
          const isSaved = savedBookingIds.has(booking.id) || orderMatched || nameMatched;

          return {
            id: booking.id,
            time,
            customerName: customerFullName,
            customerPhotoUrl: null,
            inferredSalon,
            teammates,
            status: booking.confirmation_status || "confirmed",
            startDate: booking.start_date,
            endDate: booking.end_date || null,
            bookingStr: booking.order_id ? (orderName || `#${booking.order_id}`) : "",
            priceAmount: booking.price?.amount ?? null,
            priceCurrency: booking.price?.currency || "EUR",
            notes: booking.notes || booking.note || booking.internal_note || booking.customer_note || "",
            serviceTitle: booking.service?.title || "Servizio",
            customerEmail: booking.customer?.email || null,
            customerPhone: booking.customer?.phone || null,
            isSaved,
            isManual: !booking.order_id,
          };
        })
        .filter((booking) => {
          // If tablet location name matches duomo or buenos-aires, only show those inferred salon appointments
          if (targetSalonKey !== "altro") {
            return booking.inferredSalon === targetSalonKey;
          }
          return true;
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // Divide into today and tomorrow
      const todayBookings = [];
      const tomorrowBookings = [];

      for (const booking of mappedBookings) {
        const bookingRomeDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(booking.startDate));
        if (bookingRomeDateStr === romeDateTodayStr) {
          todayBookings.push(booking);
        } else if (bookingRomeDateStr === romeDateTomorrowStr) {
          tomorrowBookings.push(booking);
        }
      }

      // Filter: only show active appointments that have not been checked out (saved) yet
      const activeTodayBookings = todayBookings.filter((booking) => !booking.isSaved);

      todayAppointments = activeTodayBookings;
    }
  } catch (error) {
    console.error("Error loading tablet page data:", error);
    // Safe fallbacks
    branding = await getBrandingTheme();
  }

  return (
    <TabletClock
      device={device ? {
        id: device.device_id,
        name: device.device_name,
        locationName: device.location.name,
      } : null}
      branding={branding}
      tabletBranding={tabletBranding}
      clientControlFormId={clientControlFormId}
      todayAppointments={todayAppointments}
    />
  );
}
