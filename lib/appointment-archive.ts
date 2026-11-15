import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { APPOINTMENT_ARCHIVE_INVALIDATION_KEY, publishAppointmentChange } from "./appointment-realtime";
import { addAppointmentDays, appointmentDateKey, appointmentDayBoundaryIso, appointmentMonthRange } from "./appointment-date";
import { APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX, archiveMonths, archiveSearchText } from "./appointment-archive-range";
import { cowlendarRateLimitDelay, getCompleteCowlendarBookingsForRange, type CowlendarBooking } from "./cowlendar";
import { getShopifyOrderNamesBulk } from "./shopify";
import { getAppointmentStatusesFromGoogleSheet } from "./google-sheet";
import {
  COWLENDAR_DAY_VERSION_FIELD,
  COWLENDAR_WEBHOOK_VERSION_FIELD,
  cowlendarArchiveProtectionVersion,
  cowlendarArchiveVersion,
  cowlendarSavedArchiveVersion,
} from "./cowlendar-webhook-archive";

// One import per process; database leases also prevent duplicate work across replicas.
let queue = Promise.resolve();
const queued = new Set<string>();
type DayRecoveryResult = {
  status: "completed" | "cooldown" | "rate-limited" | "failed";
  changed?: number;
};

let pendingTodayRecovery: Promise<DayRecoveryResult> | null = null;
let dayRecoveryCooldown: { until: number; status: "cooldown" | "rate-limited" } | null = null;
const DAY_RECOVERY_KEY = "appointment_archive_day_recovery";
const DAY_RECOVERY_INTERVAL_MS = 60_000;
const FRESH_MS = 5 * 60_000;
const LEASE_MS = 5 * 60_000;
const STALE_LEASE = new Date(0);

type ArchiveLease = {
  completed_at: Date | null;
  lease_until: Date | null;
  error: boolean;
};

async function archiveInvalidationRevision(db: Prisma.TransactionClient) {
  const setting = await db.setting.findUnique({
    where: { key: APPOINTMENT_ARCHIVE_INVALIDATION_KEY },
    select: { value: true },
  });
  return typeof setting?.value === "string" ? setting.value : null;
}

async function bounded<T>(work: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work, new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]); }
  finally { clearTimeout(timer!); }
}

async function importAppointmentArchive(month: string, force: boolean) {
  const range = appointmentMonthRange(`${month}-01`);
  const now = new Date();
  const lease = new Date(now.getTime() + LEASE_MS);
  const rateLimitKey = `${APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX}${month}`;
  const realtimeEnabled = process.env.APPOINTMENTS_REALTIME_ENABLED === "true";
  await prisma.appointmentArchiveSync.upsert({ where: { month }, create: { month }, update: {} });
  const [previous] = await prisma.$queryRaw<ArchiveLease[]>`
    WITH previous AS MATERIALIZED (
      SELECT month, completed_at, lease_until, error
      FROM appointment_archive_sync
      WHERE month = ${month}
        AND (lease_until IS NULL OR lease_until < ${now})
        AND (${force} OR completed_at IS NULL
          OR completed_at < ${new Date(now.getTime() - FRESH_MS)}
          OR lease_until = ${STALE_LEASE})
        AND NOT EXISTS (
          SELECT 1 FROM settings AS recovery
          WHERE recovery.key = ${DAY_RECOVERY_KEY}
            AND recovery.value ->> 'rateLimited' = 'true'
            AND (recovery.value ->> 'until')::bigint > ${now.getTime()}::bigint
        )
      FOR UPDATE
    )
    UPDATE appointment_archive_sync AS archive
    SET lease_until = ${lease}
    FROM previous
    WHERE archive.month = previous.month AND archive.lease_until IS NOT DISTINCT FROM previous.lease_until
    RETURNING previous.completed_at, previous.lease_until, previous.error
  `;
  if (!previous) return "skipped";
  try {
    const invalidation = realtimeEnabled ? await archiveInvalidationRevision(prisma) : null;
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
    const rows = bookings.map(b => {
      const payload: CowlendarBooking = { ...b, archiveOrderName: names.get(String(b.order_id)) || null };
      delete payload[COWLENDAR_WEBHOOK_VERSION_FIELD];
      delete payload[COWLENDAR_DAY_VERSION_FIELD];
      return { id: String(b.id), start_at: b.start_date,
        source_version: cowlendarArchiveVersion(b.updated_at),
        search_text: archiveSearchText(b, names.get(String(b.order_id)) || ""),
        payload,
        sheet: (sheets as Record<string, unknown>)[b.id] || null,
      };
    });
    return await prisma.$transaction(async tx => {
      const ownership = await tx.appointmentArchiveSync.updateMany({
        where: { month, lease_until: lease },
        data: { lease_until: lease },
      });
      if (!ownership.count) return "skipped";
      // A webhook that landed after the request started must get another import.
      if (realtimeEnabled && invalidation !== await archiveInvalidationRevision(tx)) {
        await tx.appointmentArchiveSync.update({ where: { month }, data: { lease_until: STALE_LEASE } });
        return "invalidated";
      }

      // Monthly responses must catch up to a signed webhook or day recovery
      // before replacing their data or dropping a booking missing from the list.
      const sourceCaughtUp = (saved: Prisma.Sql, sourceVersion: Prisma.Sql) => Prisma.sql`(
        ${cowlendarArchiveProtectionVersion(saved)} IS NULL OR
        ${sourceVersion} >= ${cowlendarArchiveProtectionVersion(saved)}
      )`;
      const [comparison] = await tx.$queryRaw<{ changed: boolean }[]>`
        WITH incoming AS MATERIALIZED (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS r(id text, start_at timestamptz, source_version numeric, search_text text, payload jsonb, sheet jsonb)
        ), changed AS (
          SELECT EXISTS (
            SELECT 1 FROM incoming r
            LEFT JOIN appointment_archive a ON a.id = r.id
            WHERE a.id IS NULL OR (a.synced_at <= ${now}
              AND ${sourceCaughtUp(Prisma.sql`a.payload`, Prisma.sql`r.source_version`)} AND (
              a.start_at IS DISTINCT FROM r.start_at
              OR (a.payload - 'archiveOrderName' - ${COWLENDAR_WEBHOOK_VERSION_FIELD}::text - ${COWLENDAR_DAY_VERSION_FIELD}::text) IS DISTINCT FROM (r.payload - 'archiveOrderName')
              OR (r.payload->>'archiveOrderName' IS NOT NULL
                AND a.payload->>'archiveOrderName' IS DISTINCT FROM r.payload->>'archiveOrderName')
              OR (NULLIF(r.sheet, 'null'::jsonb) IS NOT NULL
                AND (a.sheet - 'updatedAt') IS DISTINCT FROM (r.sheet - 'updatedAt'))
            ))
          ) AS changed
        ), saved AS (
          INSERT INTO appointment_archive (id, start_at, search_text, payload, sheet, synced_at)
          SELECT r.id, r.start_at, r.search_text, r.payload, r.sheet, ${now}
          FROM incoming r
          ON CONFLICT (id) DO UPDATE SET start_at = EXCLUDED.start_at,
            search_text = EXCLUDED.search_text || ' ' || COALESCE(appointment_archive.payload->>'archiveOrderName', ''),
            payload = CASE WHEN EXCLUDED.payload->>'archiveOrderName' IS NULL
              THEN jsonb_set(EXCLUDED.payload, '{archiveOrderName}', COALESCE(appointment_archive.payload->'archiveOrderName', 'null'::jsonb))
              ELSE EXCLUDED.payload END,
            sheet = CASE
              WHEN NULLIF(EXCLUDED.sheet, 'null'::jsonb) IS NULL
                OR (appointment_archive.sheet - 'updatedAt') IS NOT DISTINCT FROM (EXCLUDED.sheet - 'updatedAt')
              THEN appointment_archive.sheet ELSE EXCLUDED.sheet END,
            synced_at = EXCLUDED.synced_at
          WHERE appointment_archive.synced_at <= EXCLUDED.synced_at
            AND ${sourceCaughtUp(Prisma.sql`appointment_archive.payload`, Prisma.sql`(SELECT r.source_version FROM incoming r WHERE r.id = EXCLUDED.id)`)}
        )
        SELECT changed FROM changed`;
      const removed = await tx.appointmentArchive.deleteMany({ where: {
        start_at: { gte: new Date(appointmentDayBoundaryIso(range.start)), lte: new Date(appointmentDayBoundaryIso(range.end, true)) },
        synced_at: { lt: now },
        NOT: [
          { payload: { path: [COWLENDAR_WEBHOOK_VERSION_FIELD], not: Prisma.AnyNull } },
          // Allow a later complete import to remove a booking deleted upstream.
          {
            synced_at: { gte: new Date(now.getTime() - FRESH_MS) },
            payload: { path: [COWLENDAR_DAY_VERSION_FIELD], not: Prisma.AnyNull },
          },
        ],
      } });
      await tx.appointmentArchiveSync.update({ where: { month }, data: { completed_at: new Date(), lease_until: null, error: false } });
      if (previous.error) await tx.setting.deleteMany({ where: { key: rateLimitKey } });
      const needsCompletionNotice = force || !previous.completed_at || previous.error || previous.lease_until?.getTime() === STALE_LEASE.getTime();
      if (comparison?.changed || removed.count || needsCompletionNotice) await publishAppointmentChange(tx);
      return "completed";
    }, { timeout: 30_000 });
  } catch (error) {
    const rateLimitDelay = cowlendarRateLimitDelay(error);
    const markFailed = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.appointmentArchiveSync.updateMany({
        where: { month, lease_until: lease },
        data: { lease_until: new Date(Date.now() + Math.max(60_000, rateLimitDelay ?? 0)), error: true },
      });
      if (!updated.count) return;
      const rateLimitChanged = rateLimitDelay === null
        ? previous.error && (await tx.setting.deleteMany({ where: { key: rateLimitKey } })).count > 0
        : (await tx.setting.createMany({ data: { key: rateLimitKey, value: true }, skipDuplicates: true })).count > 0;
      if (!previous.error || rateLimitChanged) await publishAppointmentChange(tx);
    };
    if (realtimeEnabled || rateLimitDelay !== null || previous.error) await prisma.$transaction(markFailed);
    else await markFailed(prisma);
    console.error("Importazione archivio appuntamenti non riuscita", month, error instanceof Error ? error.message : "errore");
    return "failed";
  }
}

export async function syncAppointmentArchive(month: string, force = false) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mese non valido");
  const result = await importAppointmentArchive(month, force);
  if (result === "invalidated") await importAppointmentArchive(month, force);
}

export function scheduleAppointmentArchive(month: string, force = false) {
  if (queued.has(month)) return queue;
  queued.add(month);
  queue = queue.catch(() => {}).then(() => syncAppointmentArchive(month, force)).finally(() => queued.delete(month));
  return queue;
}

/** Merge today's upstream data without deleting visits or changing local service data. */
export async function recoverAppointmentArchiveDay(day: string) {
  const start = appointmentDayBoundaryIso(day);
  const end = appointmentDayBoundaryIso(addAppointmentDays(day, 1));
  const bookings = (await getCompleteCowlendarBookingsForRange(start, end, AbortSignal.timeout(25_000)))
    .filter(booking => appointmentDateKey(new Date(booking.start_date)) === day);

  if (!bookings.length) return 0;

  const existing = await prisma.appointmentArchive.findMany({
    where: { id: { in: bookings.map(booking => String(booking.id)) } },
    select: { id: true, payload: true },
  });
  const savedById = new Map(existing.map(row => [row.id, row.payload]));
  const changes = bookings.flatMap<{ booking: CowlendarBooking; saved: Prisma.JsonValue | undefined }>(booking => {
    const saved = savedById.get(String(booking.id));
    if (saved === undefined) return [{ booking, saved: undefined }];
    const previousVersion = cowlendarSavedArchiveVersion(saved);
    const nextVersion = cowlendarArchiveVersion(booking.updated_at);
    return previousVersion !== null && nextVersion !== null && nextVersion > previousVersion
      ? [{ booking, saved }] : [];
  });
  if (!changes.length) return 0;

  const names = await bounded(
    getShopifyOrderNamesBulk(changes.map(({ booking }) => booking.order_id)).catch(() => new Map<string, string>()),
    new Map<string, string>(), 3_500,
  );
  const syncedAt = new Date();
  const rows = changes.map(({ booking, saved }) => {
    const oldBooking = saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved as Record<string, Prisma.JsonValue> : null;
    const previousOrderName = oldBooking && String(booking.order_id ?? "") === String(oldBooking.order_id ?? "")
      && typeof oldBooking.archiveOrderName === "string" ? oldBooking.archiveOrderName : null;
    const orderName = names.get(String(booking.order_id)) || previousOrderName;
    const upstream = { ...booking };
    delete upstream[COWLENDAR_WEBHOOK_VERSION_FIELD];
    delete upstream[COWLENDAR_DAY_VERSION_FIELD];
    const sourceVersion = cowlendarArchiveVersion(booking.updated_at);
    const payload = {
      ...oldBooking, ...upstream, archiveOrderName: orderName,
      ...(sourceVersion === null ? {} : { [COWLENDAR_DAY_VERSION_FIELD]: sourceVersion }),
    };
    return {
      saved,
      data: {
        id: String(booking.id),
        start_at: new Date(booking.start_date),
        search_text: archiveSearchText(payload, orderName || ""),
        payload: payload as Prisma.InputJsonValue,
        synced_at: syncedAt,
      },
    };
  });
  return prisma.$transaction(async tx => {
    const additions = rows.filter(row => row.saved === undefined);
    let changed = additions.length
      ? (await tx.appointmentArchive.createMany({ data: additions.map(row => row.data), skipDuplicates: true })).count
      : 0;
    for (const { saved, data: { id, ...data } } of rows) {
      if (saved === undefined) continue;
      // Compare the source row again while writing. A concurrent webhook or
      // monthly import that changed the same booking gets to keep its version.
      changed += (await tx.appointmentArchive.updateMany({
        where: { id, payload: { equals: saved ?? Prisma.JsonNull } },
        data,
      })).count;
    }
    if (changed) await publishAppointmentChange(tx);
    return changed;
  });
}

async function recoverTodayWithLease(): Promise<DayRecoveryResult> {
  const now = Date.now();
  const lease = { token: randomUUID(), until: now + DAY_RECOVERY_INTERVAL_MS };
  // Reserve a short database lease before calling Cowlendar. Tabs and
  // replicas therefore share the same request and the same 429 cooldown.
  const [claim] = await prisma.$queryRaw<{ claimed: boolean; until: number | null; rate_limited: boolean }[]>`
    WITH monthly_rate_limit AS (
      SELECT MAX(EXTRACT(EPOCH FROM archive.lease_until) * 1000)::double precision AS until
      FROM appointment_archive_sync AS archive
      INNER JOIN settings AS reason ON reason.key = ${APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX} || archive.month
      WHERE archive.error AND archive.lease_until > ${new Date(now)}
    ), taken AS (
      INSERT INTO settings (id, key, value)
      SELECT ${lease.token}, ${DAY_RECOVERY_KEY}, ${JSON.stringify(lease)}::jsonb
      FROM monthly_rate_limit WHERE until IS NULL
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      WHERE (settings.value ->> 'until')::bigint <= ${now}::bigint
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM taken) AS claimed,
      GREATEST(monthly_rate_limit.until, (recovery.value ->> 'until')::double precision) AS until,
      (monthly_rate_limit.until IS NOT NULL OR COALESCE(
        recovery.value ->> 'rateLimited' = 'true' AND (recovery.value ->> 'until')::bigint > ${now}::bigint, false
      )) AS rate_limited
    FROM monthly_rate_limit LEFT JOIN settings AS recovery ON recovery.key = ${DAY_RECOVERY_KEY}
  `;

  if (!claim?.claimed) {
    const status = claim?.rate_limited ? "rate-limited" : "cooldown";
    dayRecoveryCooldown = { until: Math.max(claim?.until ?? now, now + 5_000), status };
    return { status };
  }

  dayRecoveryCooldown = { until: lease.until, status: "cooldown" };
  try {
    const changed = await recoverAppointmentArchiveDay(appointmentDateKey(new Date(now)));
    return { status: "completed", changed };
  } catch (error) {
    const retry = cowlendarRateLimitDelay(error);
    if (retry === null) {
      console.error("Recupero degli appuntamenti di oggi non riuscito.");
      return { status: "failed" };
    }
    const until = Math.max(lease.until, Date.now() + retry);
    dayRecoveryCooldown = { until, status: "rate-limited" };
    await prisma.setting.updateMany({
      where: { key: DAY_RECOVERY_KEY, value: { path: ["token"], equals: lease.token } },
      data: { value: { ...lease, until, rateLimited: true } },
    });
    return { status: "rate-limited" };
  }
}

export function scheduleTodayAppointmentRecovery(): Promise<DayRecoveryResult> {
  if (pendingTodayRecovery) return pendingTodayRecovery;
  if (dayRecoveryCooldown && Date.now() < dayRecoveryCooldown.until) {
    return Promise.resolve({ status: dayRecoveryCooldown.status });
  }
  pendingTodayRecovery = recoverTodayWithLease()
    .catch(() => {
      if (!dayRecoveryCooldown || dayRecoveryCooldown.until <= Date.now()) {
        dayRecoveryCooldown = { until: Date.now() + 5_000, status: "cooldown" };
      }
      console.error("Coordinamento del recupero degli appuntamenti non disponibile.");
      return { status: "failed" } as const;
    })
    .finally(() => { pendingTodayRecovery = null; });
  return pendingTodayRecovery;
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
  const failedMonths = sync.filter(s => s.error).map(s => s.month);
  const rateLimited = failedMonths.length > 0 && Boolean(await prisma.setting.count({
    where: { key: { in: failedMonths.map(month => `${APPOINTMENT_ARCHIVE_RATE_LIMIT_KEY_PREFIX}${month}`) } },
  }));
  const invalidated = sync.some(s => s.lease_until?.getTime() === STALE_LEASE.getTime());
  return { bookings: rows.map(r => r.payload as unknown as CowlendarBooking),
    sheets: Object.fromEntries(rows.filter(r => r.sheet).map(r => [r.id, r.sheet])), count, page, months,
    ready: months.every(month => sync.some(s => s.month === month && s.completed_at)),
    failed: failedMonths.length > 0,
    rateLimited,
    invalidated,
    stale: invalidated || sync.some(s => !s.completed_at || Date.now() - s.completed_at.getTime() > FRESH_MS),
    updatedAt: sync.length && sync.every(s => s.completed_at) ? new Date(Math.min(...sync.map(s => s.completed_at!.getTime()))).toISOString() : null,
  };
}
