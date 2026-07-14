import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

async function guard(locationId: string) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) return { error: "Non autorizzato", status: 403 as const };
  return { session };
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const locationId = String(data.locationId ?? "");
  const userId = String(data.userId ?? "");
  const permission = await guard(locationId);
  if ("error" in permission) return NextResponse.json({ error: permission.error }, { status: permission.status });

  const [location, worker] = await Promise.all([
    prisma.location.findFirst({ where: { id: locationId, active: true } }),
    prisma.user.findFirst({
      where: {
        id: userId,
        active: true,
        NOT: {
          mansione: {
            in: ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"],
            mode: "insensitive"
          }
        }
      }
    }),
  ]);
  if (!location || !worker || worker.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Lavoratore o salone non valido." }, { status: 400 });
  }

  const override = await prisma.scheduleWorkerOverride.upsert({
    where: { location_id_user_id: { location_id: locationId, user_id: userId } },
    update: {},
    create: { location_id: locationId, user_id: userId },
  });

  return NextResponse.json({ id: override.id, locationId: override.location_id, userId: override.user_id });
}

export async function DELETE(request: NextRequest) {
  const data = await request.json();
  const locationId = String(data.locationId ?? "");
  const userId = String(data.userId ?? "");
  const permission = await guard(locationId);
  if ("error" in permission) return NextResponse.json({ error: permission.error }, { status: permission.status });

  await prisma.scheduleWorkerOverride.deleteMany({ where: { location_id: locationId, user_id: userId } });
  return NextResponse.json({ removed: true });
}
