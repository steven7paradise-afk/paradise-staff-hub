import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDatabaseHealthCheck } from "@/lib/database-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const databaseHealthy = createDatabaseHealthCheck(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

export async function GET(request: Request) {
  const checkDatabase = new URL(request.url).searchParams.get("database") === "1";
  const healthy = !checkDatabase || await databaseHealthy();
  return NextResponse.json(
    {
      status: healthy ? "ok" : "unavailable",
      service: "paradise-staff-hub",
      ...(checkDatabase ? { database: healthy ? "ok" : "unavailable" } : {}),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
