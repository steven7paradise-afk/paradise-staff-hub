import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditForUser } from "@/lib/roles";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

async function guard(locationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non autorizzato", status: 403 as const };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const isAuthorized = user && (user.role === "ZERO" || user.role === "SUPER_ADMIN" || user.role === "ADMIN" || await canEditForUser(prisma, "/schedules", user));
  if (!isAuthorized) return { error: "Non autorizzato", status: 403 as const };

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
          OR: [
            {
              mansione: {
                in: ["exdipendenti", "ex dipendente", "ex dipendenti", "ex-dipendente", "ex-dipendenti"],
                mode: "insensitive"
              }
            },
            {
              employee_status: {
                in: ["ex dipendente", "exdipendenti", "ex dipendenti", "ex-dipendente", "ex-dipendenti"],
                mode: "insensitive"
              }
            }
          ]
        }
      }
    }),
  ]);
  if (!location || !worker || ["ZERO", "SUPER_ADMIN"].includes(worker.role)) {
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
