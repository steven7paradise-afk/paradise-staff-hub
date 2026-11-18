import { auth } from "@/lib/auth";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { appointmentPcReceptionCookieName } from "@/lib/appointment-pc-reception-session";
import { findAppointmentPcReceptionOperator } from "@/lib/appointment-pc-reception-operator";
import { requiresBuenosAiresPcCassa } from "@/lib/pc-cassa-access";
import { prisma } from "@/lib/prisma";
import { resolveRemoteControllerWorker } from "@/lib/remote-controller-user";
import type { Role } from "@/lib/roles";

type OrderCookieStore = { get(name: string): { value: string } | undefined };

/** Shared by both boards and read-only reference resolution. */
export async function resolveOrderWorkspaceAccess({ cookieStore, remoteTarget: requestedRemoteTarget }: {
  cookieStore: OrderCookieStore;
  remoteTarget?: string;
}) {
  const remoteTarget = requestedRemoteTarget?.trim() || "";
  const session = await auth();
  const hasAdministratorSession = Boolean(
    session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  const pcAuth = hasAdministratorSession
    ? null
    : await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
  const receptionOperator = pcAuth?.accessMode === "reception"
    ? await findAppointmentPcReceptionOperator(pcAuth, cookieStore.get(appointmentsPcCookieName)?.value, cookieStore.get(appointmentPcReceptionCookieName)?.value)
    : null;
  if (pcAuth?.accessMode === "reception" && (!receptionOperator || receptionOperator.arrivalOnly)) {
    return { ok: false, status: 403, redirectTo: "/appointments/repubblica?choose=1" } as const;
  }
  const selectedWorkerId = receptionOperator?.id || cookieStore.get(appointmentsPcWorkerCookieName)?.value || "";
  const isAdminRemoteController = Boolean(
    !pcAuth && remoteTarget && session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  const remoteWorker = isAdminRemoteController
    ? await resolveRemoteControllerWorker(session!.user.id, remoteTarget)
    : null;
  const isPC = Boolean(pcAuth || remoteWorker);
  if (!session?.user?.id && !pcAuth) return { ok: false, status: 401, redirectTo: "/login" } as const;

  const dbUser = await prisma.user.findUnique({
    where: { id: remoteWorker?.id || (isPC ? (selectedWorkerId || "PC_CASSA") : session!.user.id) },
    select: { id: true, name: true, photo_url: true, mansione: true, role: true, location: { select: { name: true } } },
  });
  const role = (isPC ? "RESPONSABILE" : session!.user.role) as Role;
  if (!isPC && dbUser && requiresBuenosAiresPcCassa(dbUser.role, dbUser.location?.name)) {
    return { ok: false, status: 403, redirectTo: "/pc-non-autorizzato" } as const;
  }

  return {
    ok: true,
    session,
    isPC,
    role,
    canManageOrders: isPC || ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role),
    remoteWorker,
    remoteTarget: isAdminRemoteController && remoteWorker ? remoteTarget : "",
    isAdminRemoteController,
    selectedPcWorker: pcAuth && selectedWorkerId && dbUser ? { name: dbUser.name, photo_url: dbUser.photo_url } : null,
    operationalLocationId: pcAuth?.locationId || remoteWorker?.sede_id || "",
  } as const;
}
