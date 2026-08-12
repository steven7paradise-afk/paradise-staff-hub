import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  checkPCAuthorization,
} from "@/lib/appointments-pc-auth";
import { requiresBuenosAiresPcCassa } from "@/lib/pc-cassa-access";

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
    select: { location: { select: { name: true } } },
  }).catch(() => null);
  if (requiresBuenosAiresPcCassa(String(session.user.role ?? ""), dbUser?.location?.name)) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: String(session.user.role ?? ""),
    sedeId: session.user.sedeId ?? null,
    isPC: false,
  };
}
