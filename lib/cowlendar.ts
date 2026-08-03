import { prisma } from "@/lib/prisma";

const COWLENDAR_API_BASE = "https://app.cowlendar.com/public-api/v1";

type CowlendarResponse<T> = {
  data: T[];
  pagination?: {
    has_more?: boolean;
    next_cursor?: string | null;
  };
};

export type CowlendarService = {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  is_active?: boolean;
  is_archived?: boolean;
  timezone?: string | null;
  default_duration?: number | null;
  image_url?: string | null;
  teammates?: Array<{
    id: string;
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
    thumbnail?: string | null;
  }>;
  created_at?: string;
  updated_at?: string;
};

export type CowlendarBooking = {
  id: string;
  booking_str?: string | null;
  booking_type?: string | null;
  order_id?: string | null;
  start_date: string;
  end_date?: string | null;
  timezone?: string | null;
  service?: {
    id?: string;
    title?: string | null;
    type?: string | null;
    image_url?: string | null;
    image?: string | null;
    thumbnail?: string | null;
  } | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    locale?: string | null;
  } | null;
  teammates?: Array<{
    id: string;
    firstname?: string | null;
    lastname?: string | null;
    thumbnail?: string | null;
  }>;
  price?: {
    amount?: number | null;
    currency?: string | null;
  } | null;
  confirmation_status?: string | null;
  attendance?: string | null;
  financial_status?: string | null;
  notes?: string | null;
  note?: string | null;
  internal_note?: string | null;
  customer_note?: string | null;
  form_data?: Record<string, unknown> | null;
  is_canceled?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type CowlendarAppointmentStatus =
  | "PRENOTATO"
  | "NON_PRESENTATO"
  | "INIZIATO"
  | "IN_ATTESA"
  | "COMPLETATO"
  | "ARRIVATO_IN_RITARDO"
  | "PAGATO";

interface CacheData<T> {
  timestamp: number;
  data: T;
}

async function getCache<T>(key: string): Promise<CacheData<T> | null> {
  try {
    const record = await prisma.setting.findUnique({
      where: { key },
    });
    if (record && record.value) {
      return record.value as unknown as CacheData<T>;
    }
  } catch (err) {
    console.error(`Error reading cowlendar cache for key ${key}:`, err);
  }
  return null;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const value = {
      timestamp: Date.now(),
      data,
    };
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
    
    // Clean up older caches asynchronously to avoid blocking the user request
    cleanOldCowlendarCaches().catch((err) =>
      console.error("Failed to clean old cowlendar caches:", err)
    );
  } catch (err) {
    console.error(`Error writing cowlendar cache for key ${key}:`, err);
  }
}

async function cleanOldCowlendarCaches(): Promise<void> {
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const records = await prisma.setting.findMany({
      where: {
        key: {
          startsWith: "cowlendar_cache_",
        },
      },
    });

    for (const record of records) {
      const val = record.value as any;
      if (val && typeof val.timestamp === "number" && val.timestamp < oneDayAgo) {
        await prisma.setting.delete({
          where: { key: record.key },
        });
      }
    }
  } catch (err) {
    console.error("Error in cleanOldCowlendarCaches:", err);
  }
}

function getCowlendarToken() {
  return process.env.COWLENDAR_API_TOKEN?.trim() || "";
}

async function cowlendarFetch<T>(pathname: string, init?: RequestInit): Promise<CowlendarResponse<T>> {
  const token = getCowlendarToken();
  if (!token) {
    throw new Error("COWLENDAR_API_TOKEN mancante");
  }

  const response = await fetch(`${COWLENDAR_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Cowlendar ${response.status}`);
  }

  return response.json() as Promise<CowlendarResponse<T>>;
}

async function cowlendarRawFetch(pathname: string, init?: RequestInit) {
  const token = getCowlendarToken();
  if (!token) {
    throw new Error("COWLENDAR_API_TOKEN mancante");
  }

  return fetch(`${COWLENDAR_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function clearCowlendarBookingCaches() {
  try {
    await prisma.setting.deleteMany({
      where: {
        OR: [
          { key: { startsWith: "cowlendar_cache_bookings_" } },
          { key: { startsWith: "cowlendar_cache_range_" } },
        ],
      },
    });
  } catch (err) {
    console.error("Error clearing cowlendar booking caches:", err);
  }
}

function cowlendarStatusPayloads(status: CowlendarAppointmentStatus): Array<Record<string, string>> {
  const normalized = status.toLowerCase();
  const payloads: Array<Record<string, string>> = [
    { status },
    { status: normalized },
  ];

  if (status === "PAGATO") {
    payloads.push({ financial_status: "PAID" }, { financial_status: "paid" });
  } else if (status === "PRENOTATO") {
    payloads.push({ confirmation_status: "CONFIRMED" }, { confirmation_status: "confirmed" });
  } else {
    const attendanceMap: Record<Exclude<CowlendarAppointmentStatus, "PAGATO" | "PRENOTATO">, string> = {
      NON_PRESENTATO: "NO_SHOW",
      INIZIATO: "INIZIATO",
      IN_ATTESA: "IN_ATTESA",
      COMPLETATO: "COMPLETATO",
      ARRIVATO_IN_RITARDO: "IN_RITARDO",
    };
    const attendance = attendanceMap[status];
    payloads.push({ attendance }, { attendance: attendance.toLowerCase() });
  }

  return payloads;
}

export async function updateCowlendarBookingStatus(bookingId: string, status: CowlendarAppointmentStatus) {
  const id = String(bookingId || "").trim();
  if (!id) {
    throw new Error("ID prenotazione Cowlendar mancante");
  }

  const paths = [`/bookings/${encodeURIComponent(id)}`, `/bookings/${encodeURIComponent(id)}/status`];
  let lastError = "endpoint non disponibile";

  for (const path of paths) {
    for (const payload of cowlendarStatusPayloads(status)) {
      const response = await cowlendarRawFetch(path, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await clearCowlendarBookingCaches();
        const text = await response.text();
        return {
          ok: true,
          path,
          payload,
          response: text ? tryParseJson(text) : null,
        };
      }

      const text = await response.text().catch(() => "");
      lastError = `Cowlendar ${response.status}${text ? `: ${text}` : ""}`;
      if (response.status === 401 || response.status === 403) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(`Cowlendar non ha accettato l'aggiornamento dello stato (${lastError})`);
}

export async function updateCowlendarBookingTeam(bookingId: string, teammateIds: string[]) {
  const id = String(bookingId || "").trim();
  const ids = [...new Set(teammateIds.map((value) => String(value || "").trim()).filter(Boolean))];

  if (!id) {
    throw new Error("ID prenotazione Cowlendar mancante");
  }

  if (!ids.length) {
    throw new Error("Seleziona almeno una collaboratrice.");
  }

  const paths = [`/bookings/${encodeURIComponent(id)}`, `/bookings/${encodeURIComponent(id)}/teammates`];
  const payloads: Array<Record<string, unknown>> = [
    { teammates: ids },
    { teammate_ids: ids },
    { teammateIds: ids },
    { teammates: ids.map((teammateId) => ({ id: teammateId })) },
  ];
  let lastError = "endpoint non disponibile";

  for (const path of paths) {
    for (const payload of payloads) {
      const response = await cowlendarRawFetch(path, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await clearCowlendarBookingCaches();
        const text = await response.text();
        return {
          ok: true,
          path,
          payload,
          response: text ? tryParseJson(text) : null,
        };
      }

      const text = await response.text().catch(() => "");
      lastError = `Cowlendar ${response.status}${text ? `: ${text}` : ""}`;
      if (response.status === 401 || response.status === 403) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(`Cowlendar non ha accettato l'aggiornamento del team (${lastError})`);
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function getCowlendarServices() {
  const cacheKey = "cowlendar_cache_services";
  const cached = await getCache<CowlendarService[]>(cacheKey);
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  if (cached && now - cached.timestamp < maxAge) {
    return cached.data;
  }

  try {
    const result = await cowlendarFetch<CowlendarService>("/services");
    const data = result.data ?? [];
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    if (cached) {
      console.warn("Serving stale cowlendar services due to fetch error:", error);
      return cached.data;
    }
    throw error;
  }
}

export async function getCowlendarBookings(limit = 250) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit || 250), 1), 500);
  const cacheKey = `cowlendar_cache_bookings_${safeLimit}`;
  
  const cached = await getCache<CowlendarBooking[]>(cacheKey);
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (cached && now - cached.timestamp < maxAge) {
    return cached.data;
  }

  try {
    const collected: CowlendarBooking[] = [];
    let cursor: string | null = null;
    let attempts = 0;

    while (collected.length < safeLimit && attempts < 20) {
      attempts += 1;
      const pageLimit = Math.min(50, safeLimit - collected.length);
      const query = new URLSearchParams();
      query.set("limit", String(pageLimit));
      if (cursor) query.set("cursor", cursor);

      try {
        const result = await cowlendarFetch<CowlendarBooking>(`/bookings?${query.toString()}`);
        const data = result.data ?? [];
        collected.push(...data);

        cursor = result.pagination?.next_cursor ?? null;
        if (!result.pagination?.has_more || !cursor || data.length === 0) break;
        continue;
      } catch (error) {
        if (error instanceof Error && error.message === "Cowlendar 400") {
          const fallbackPath: string = cursor ? `/bookings?cursor=${encodeURIComponent(cursor)}` : "/bookings";
          const fallback = await cowlendarFetch<CowlendarBooking>(fallbackPath);
          const data = fallback.data ?? [];
          collected.push(...data);
          cursor = fallback.pagination?.next_cursor ?? null;
          if (!fallback.pagination?.has_more || !cursor || data.length === 0) break;
          continue;
        }

        throw error;
      }
    }

    const finalData = collected.slice(0, safeLimit);
    await setCache(cacheKey, finalData);
    return finalData;
  } catch (error) {
    if (cached) {
      console.warn(`Serving stale cowlendar bookings (${safeLimit}) due to fetch error:`, error);
      return cached.data;
    }
    throw error;
  }
}

async function fetchAndCacheCowlendarRange(
  startDate: string,
  endDate: string,
  safeLimit: number,
  cacheKey: string
): Promise<CowlendarBooking[]> {
  const collected: CowlendarBooking[] = [];
  let cursor: string | null = null;
  let attempts = 0;

  while (collected.length < safeLimit && attempts < 40) {
    attempts += 1;
    const pageLimit = Math.min(100, safeLimit - collected.length);
    const query = new URLSearchParams();
    query.set("limit", String(pageLimit));
    query.set("start", startDate);
    query.set("end", endDate);
    query.set("sort", "start_date");
    if (cursor) query.set("cursor", cursor);

    try {
      const result = await cowlendarFetch<CowlendarBooking>(`/bookings?${query.toString()}`);
      const data = result.data ?? [];
      collected.push(...data);

      cursor = result.pagination?.next_cursor ?? null;
      if (!result.pagination?.has_more || !cursor || data.length === 0) break;
      continue;
    } catch (error) {
      if (error instanceof Error && error.message === "Cowlendar 400") {
        const fallbackBookings = await getCowlendarBookings(safeLimit);
        const rangeStartMs = new Date(startDate).getTime();
        const rangeEndMs = new Date(endDate).getTime();

        const finalData = fallbackBookings
          .filter((booking) => {
            const bookingMs = new Date(booking.start_date).getTime();
            return bookingMs >= rangeStartMs && bookingMs <= rangeEndMs;
          })
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
          .slice(0, safeLimit);

        await setCache(cacheKey, finalData);
        return finalData;
      }

      throw error;
    }
  }

  const finalData = collected.slice(0, safeLimit);
  await setCache(cacheKey, finalData);
  return finalData;
}

export async function getCowlendarBookingsForRange({
  startDate,
  endDate,
  limit = 800,
}: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<CowlendarBooking[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit || 800), 1), 5000);
  const cacheKey = `cowlendar_cache_range_v4_${startDate}_${endDate}_${safeLimit}`;
  
  const cached = await getCache<CowlendarBooking[]>(cacheKey);
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (cached) {
    if (now - cached.timestamp < maxAge) {
      return cached.data;
    } else {
      // Stale cache: return immediately and update in background
      console.log(`Cowlendar range cache stale for ${cacheKey}. Revalidating in background...`);
      fetchAndCacheCowlendarRange(startDate, endDate, safeLimit, cacheKey).catch((err) => {
        console.error(`Cowlendar background revalidation failed for ${cacheKey}:`, err);
      });
      return cached.data;
    }
  }

  return fetchAndCacheCowlendarRange(startDate, endDate, safeLimit, cacheKey);
}

export function hasCowlendarToken() {
  return Boolean(getCowlendarToken());
}
