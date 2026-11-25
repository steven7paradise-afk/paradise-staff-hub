import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000;
const CLEANUP_LIMIT = 32;
const LIMITS = {
  pin: { ip: 10, global: 60 },
  roster: { ip: 30, global: 120 },
} as const;

type Bucket = { key: string; count: number; expires_at: Date };

export async function consumeMagazzinoRate(
  kind: "pin" | "roster",
  ip: string,
  now = Date.now(),
): Promise<{ allowed: boolean; retryAfter: number }> {
  const limits = LIMITS[kind];
  const currentTime = new Date(now);
  const expiresAt = new Date(now + WINDOW_MS);
  if (!Object.hasOwn(LIMITS, kind) || !ip.trim()
    || !Number.isFinite(currentTime.getTime()) || !Number.isFinite(expiresAt.getTime())) {
    throw new Error("Invalid Magazzino rate-limit input");
  }
  const prefix = `magazzino:${kind}:`;
  const globalKey = `${prefix}global`;
  // The route supplies a trusted, canonical address; never parse forwarded
  // headers or use a PIN/token as a fallback identity here.
  const ipKey = `${prefix}ip:${createHash("sha256").update(ip.trim()).digest("hex")}`;

  // Separate autocommit statements keep cleanup locks out of the consume path.
  // Never delete another integration's buckets, and never wait on a busy row.
  await prisma.$executeRaw`
    DELETE FROM mcp_rate_buckets
    WHERE key IN (
      SELECT key FROM mcp_rate_buckets
      WHERE key LIKE 'magazzino:%' AND expires_at <= ${currentTime}
        AND key NOT IN (${globalKey}, ${ipKey})
      ORDER BY expires_at, key
      LIMIT ${CLEANUP_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
  `;

  // All callers lock the shared global bucket before their IP bucket. Both
  // counters advance atomically, including denied attempts, without extending
  // an active window or allocating a fresh row for every minute.
  const buckets = await prisma.$queryRaw<Bucket[]>`
    INSERT INTO mcp_rate_buckets (key, count, expires_at)
    SELECT key, 1, ${expiresAt}
    FROM (VALUES (${globalKey}), (${ipKey})) AS requested(key)
    ORDER BY key
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN mcp_rate_buckets.expires_at <= ${currentTime} THEN 1
        ELSE LEAST(mcp_rate_buckets.count + 1,
          CASE WHEN mcp_rate_buckets.key = ${globalKey}
            THEN ${limits.global + 1} ELSE ${limits.ip + 1} END)
        END,
      expires_at = CASE WHEN mcp_rate_buckets.expires_at <= ${currentTime}
        THEN EXCLUDED.expires_at ELSE mcp_rate_buckets.expires_at END
    RETURNING key, count, expires_at
  `;

  if (buckets.length !== 2 || !buckets.some((bucket) => bucket.key === globalKey)
    || !buckets.some((bucket) => bucket.key === ipKey)) {
    throw new Error("Incomplete Magazzino rate-limit result");
  }
  let retryAfter = 0;
  for (const bucket of buckets) {
    if (!Number.isInteger(bucket.count) || bucket.count < 1
      || !(bucket.expires_at instanceof Date) || !Number.isFinite(bucket.expires_at.getTime())
      || bucket.expires_at.getTime() <= now) {
      throw new Error("Invalid Magazzino rate-limit result");
    }
    const limit = bucket.key === globalKey ? limits.global : limits.ip;
    if (bucket.count > limit) {
      retryAfter = Math.max(retryAfter, 1, Math.ceil((bucket.expires_at.getTime() - now) / 1000));
    }
  }
  return { allowed: retryAfter === 0, retryAfter };
}
