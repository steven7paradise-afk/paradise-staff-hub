import { prisma } from "@/lib/prisma";
import { digest } from "./security";
export async function consumeRate(identity: string, limit: number, now = Date.now()) {
  const window = Math.floor(now / 60_000);
  const key = `${digest(identity)}:${window}`;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO mcp_rate_buckets (key, count, expires_at) VALUES (${key}, 1, ${new Date((window + 2) * 60_000)})
    ON CONFLICT (key) DO UPDATE SET count = LEAST(mcp_rate_buckets.count + 1, ${limit + 1}) RETURNING count`;
  return rows[0].count <= limit;
}
export function rateLimited() { return Response.json({ error: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }); }
