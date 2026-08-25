import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  checkPCAuthorization,
} from "@/lib/appointments-pc-auth";
import { canAccessSalonShiftModules, isShiftProtectedPath } from "@/lib/salon-shift-access";

export type OperationalUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  sedeId?: string | null;
  isPC?: boolean;
};

function selectedWorkerIdentity(request: NextRequest) {
  const raw = request.cookies.get(appointmentsPcWorkerCookieName)?.value || "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function getOperationalUser(request: NextRequest): Promise<OperationalUser | null> {
  const session = await auth();
  const pcAuth = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value).catch(() => null);
  if (pcAuth) {
    const workerIdentity = selectedWorkerIdentity(request);
    const worker = workerIdentity
      ? await prisma.user.findFirst({
        where: {
          active: true,
          sede_id: pcAuth.locationId,
          OR: [{ id: workerIdentity }, { name: workerIdentity }],
        },
        select: { id: true, name: true, email: true, role: true, sede_id: true },
        })
      : null;

    if (worker) {
      return {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
        sedeId: worker.sede_id,
        isPC: true,
      };
    }

    return {
      id: "PC_CASSA",
      name: pcAuth.name,
      email: "cassa@paradise.tech",
      role: "RESPONSABILE",
      sedeId: pcAuth.locationId,
      isPC: true,
    };
  }

  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, sede_id: true, active: true, location: { select: { name: true } } },
  }).catch(() => null);
  if (!dbUser?.active) return null;
  if (
    dbUser &&
    isShiftProtectedPath(request.nextUrl.pathname) &&
    !(await canAccessSalonShiftModules(dbUser).catch(() => false))
  ) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    sedeId: dbUser.sede_id,
    isPC: false,
  };
}
