import { prisma } from "./prisma";
import { appointmentDayBoundaryIso, appointmentMonthRange } from "./appointment-date";
import { archiveMonths, archiveSearchText } from "./appointment-archive-range";
import { getCompleteCowlendarBookingsForRange, type CowlendarBooking } from "./cowlendar";
import { getShopifyOrderNamesBulk } from "./shopify";
import { getAppointmentStatusesFromGoogleSheet } from "./google-sheet";

// One import per process; database leases also prevent duplicate work across replicas.
let queue = Promise.resolve();
const queued = new Set<string>();
const FRESH_MS = 5 * 60_000;
const LEASE_MS = 5 * 60_000;

async function bounded<T>(work: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work, new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]); }
  finally { clearTimeout(timer!); }
}

export async function syncAppointmentArchive(month: string, force = false) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mese non valido");
  const range = appointmentMonthRange(`${month}-01`);
  const now = new Date();
  const lease = new Date(now.getTime() + LEASE_MS);
  await prisma.appointmentArchiveSync.upsert({ where: { month }, create: { month }, update: {} });
  const claimed = await prisma.appointmentArchiveSync.updateMany({
    where: { month, AND: [
      { OR: [{ lease_until: null }, { lease_until: { lt: now } }] },
      ...(force ? [] : [{ OR: [{ completed_at: null }, { completed_at: { lt: new Date(now.getTime() - FRESH_MS) } }, { lease_until: new Date(0) }] }]),
    ] }, data: { lease_until: lease, error: false },
  });
  if (!claimed.count) return;
  try {
    // This fetch verifies every page. A failed/incomplete import never replaces the previous snapshot.
    const deadline = AbortSignal.timeout(120_000);
    const bookings = await getCompleteCowlendarBookingsForRange(appointmentDayBoundaryIso(range.start), appointmentDayBoundaryIso(range.end, true), deadline);
    const [names, sheets] = await Promise.all([
      (async () => {
        const names = new Map<string, string>();
        for (let offset = 0; offset < bookings.length; offset += 100) {
          deadline.throwIfAborted();
          const batch = await bounded(getShopifyOrderNamesBulk(bookings.slice(offset, offset + 100).map(b => b.order_id)).catch(() => new Map<string, string>()), new Map<string, string>(), 5_000);
          for (const [id, name] of batch) names.set(id, name);
        }
        return names;
      })(),
      bounded(getAppointmentStatusesFromGoogleSheet(bookings.map(b => ({
        id: b.id, customerName: b.customer?.name || [b.form_data?.firstname, b.form_data?.lastname].filter(Boolean).join(" ") || b.booking_str || "",
        customerPhone: b.customer?.phone || null, startDate: b.start_date,
      }))).catch(() => ({})), {}, 8_000),
    ]);
    deadline.throwIfAborted();
    const rows = bookings.map(b => ({ id: String(b.id), start_at: b.start_date,
      search_text: archiveSearchText(b, names.get(String(b.order_id)) || ""),
      payload: { ...b, archiveOrderName: names.get(String(b.order_id)) || null },
      sheet: (sheets as Record<string, unknown>)[b.id] || null,
    }));
    await prisma.$transaction(async tx => {
      const ownership = await tx.appointmentArchiveSync.updateMany({ where: { month, lease_until: lease }, data: { error: false } });
      if (!ownership.count) throw new Error("Importazione sostituita");
      // Parameterized bulk insert avoids thousands of round trips and keeps publication atomic.
      await tx.$executeRaw`
        INSERT INTO appointment_archive (id, start_at, search_text, payload, sheet, synced_at)
        SELECT r.id, r.start_at, r.search_text, r.payload, r.sheet, ${now}
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS r(id text, start_at timestamptz, search_text text, payload jsonb, sheet jsonb)
        ON CONFLICT (id) DO UPDATE SET start_at = EXCLUDED.start_at,
          search_text = EXCLUDED.search_text || ' ' || COALESCE(appointment_archive.payload->>'archiveOrderName', ''),
          payload = CASE WHEN EXCLUDED.payload->>'archiveOrderName' IS NULL
            THEN jsonb_set(EXCLUDED.payload, '{archiveOrderName}', COALESCE(appointment_archive.payload->'archiveOrderName', 'null'::jsonb))
            ELSE EXCLUDED.payload END,
          sheet = COALESCE(NULLIF(EXCLUDED.sheet, 'null'::jsonb), appointment_archive.sheet), synced_at = EXCLUDED.synced_at
        WHERE appointment_archive.synced_at <= EXCLUDED.synced_at`;
      await tx.appointmentArchive.deleteMany({ where: {
        start_at: { gte: new Date(appointmentDayBoundaryIso(range.start)), lte: new Date(appointmentDayBoundaryIso(range.end, true)) },
        synced_at: { lt: now },
      } });
      await tx.appointmentArchiveSync.update({ where: { month }, data: { completed_at: new Date(), lease_until: null, error: false } });
    }, { timeout: 30_000 });
  } catch (error) {
    await prisma.appointmentArchiveSync.updateMany({ where: { month, lease_until: lease }, data: { lease_until: new Date(Date.now() + 60_000), error: true } });
    console.error("Importazione archivio appuntamenti non riuscita", month, error instanceof Error ? error.message : "errore");
  }
}

export function scheduleAppointmentArchive(month: string, force = false) {
  if (queued.has(month)) return queue;
  queued.add(month);
  queue = queue.catch(() => {}).then(() => syncAppointmentArchive(month, force)).finally(() => queued.delete(month));
  return queue;
}

export async function readAppointmentArchive(start: string, end: string, options: { page?: number; search?: string } = {}) {
  const months = archiveMonths(start, end);
  const search = (options.search || "").trim().slice(0, 120);
  const where = {
    start_at: { gte: new Date(appointmentDayBoundaryIso(start)), lte: new Date(appointmentDayBoundaryIso(end, true)) },
    ...(search ? { search_text: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const count = await prisma.appointmentArchive.count({ where });
  const page = Math.max(1, Math.min(Math.trunc(options.page || 1), Math.max(1, Math.ceil(count / 100))));
  const [rows, sync] = await Promise.all([
    prisma.appointmentArchive.findMany({ where, orderBy: [{ start_at: "asc" }, { id: "asc" }],
      ...(options.page !== undefined ? { skip: (page - 1) * 100, take: 100 } : {}),
    }),
    prisma.appointmentArchiveSync.findMany({ where: { month: { in: months } } }),
  ]);
  return { bookings: rows.map(r => r.payload as unknown as CowlendarBooking),
    sheets: Object.fromEntries(rows.filter(r => r.sheet).map(r => [r.id, r.sheet])), count, page, months,
    ready: months.every(month => sync.some(s => s.month === month && s.completed_at)),
    failed: sync.some(s => s.error),
    stale: sync.some(s => s.lease_until?.getTime() === 0 || !s.completed_at || Date.now() - s.completed_at.getTime() > FRESH_MS),
    updatedAt: sync.length && sync.every(s => s.completed_at) ? new Date(Math.min(...sync.map(s => s.completed_at!.getTime()))).toISOString() : null,
  };
}
