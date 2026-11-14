import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  appointmentSalonForPC,
  appointmentsPcCookieName,
  appointmentsPcWorkerCookieName,
  appointmentsRemoteTargetCookieName,
  appointmentsRemoteWorkerCookieName,
  checkPCAuthorization,
  hasRepubblicaAttendanceForUnassignedWorker,
  isAppointmentStaffLocationForPC,
} from "@/lib/appointments-pc-auth";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
import { isAppointmentPinOnlyRole } from "@/lib/appointment-pin-entry";
import { canAccessSalonShiftModules, isShiftProtectedPath } from "@/lib/salon-shift-access";
import { resolveRemoteControllerWorker } from "@/lib/remote-controller-user";
import {
  appointmentStaffDisplayName,
  isAlwaysActiveAppointmentStaff,
} from "@/lib/appointment-staff-access";

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

export async function getOperationalUser(
  request: NextRequest,
  options?: { requirePcWorker?: boolean; preferAuthenticatedAdmin?: boolean },
): Promise<OperationalUser | null> {
  const session = await auth();
  const pcAuth = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value).catch(() => null);
  const hasAuthenticatedAdmin = Boolean(
    session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  if (pcAuth && !(options?.preferAuthenticatedAdmin && hasAuthenticatedAdmin)) {
    const workerIdentity = selectedWorkerIdentity(request);
    const workerCandidate = workerIdentity
      ? await prisma.user.findFirst({
        where: {
          active: true,
          employee_status: { not: FORMER_EMPLOYEE_STATUS },
          OR: [{ id: workerIdentity }, { name: workerIdentity }],
        },
        select: { id: true, name: true, email: true, role: true, sede_id: true },
        })
      : null;
    let workerAtDeviceSalon = false;
    if (workerCandidate?.sede_id) {
      workerAtDeviceSalon = await isAppointmentStaffLocationForPC(pcAuth.locationId, workerCandidate.sede_id);
    } else if (
      workerCandidate && !isAppointmentPinOnlyRole(workerCandidate.role) &&
      !isAlwaysActiveAppointmentStaff(workerCandidate.name, workerCandidate.id) &&
      await appointmentSalonForPC(pcAuth.locationId) === "repubblica"
    ) {
      workerAtDeviceSalon = await hasRepubblicaAttendanceForUnassignedWorker(pcAuth.locationId, workerCandidate.id);
    }
    const worker = workerCandidate && (workerAtDeviceSalon ||
      isAlwaysActiveAppointmentStaff(workerCandidate.name, workerCandidate.id)) ? workerCandidate : null;

    if (worker) {
      return {
        id: worker.id,
        name: appointmentStaffDisplayName(worker.name, worker.id),
        email: worker.email,
        role: worker.role,
        sedeId: workerAtDeviceSalon ? pcAuth.locationId : worker.sede_id,
        isPC: true,
      };
    }

    if (options?.requirePcWorker) return null;

    return {
      id: "PC_CASSA",
      name: pcAuth.name,
      email: "cassa@paradise.tech",
      role: "RESPONSABILE",
      sedeId: pcAuth.locationId,
      isPC: true,
    };
  }

  const remoteTarget = request.cookies.get(appointmentsRemoteTargetCookieName)?.value || "";
  const remoteWorkerId = request.cookies.get(appointmentsRemoteWorkerCookieName)?.value || "";
  const isAdmin = Boolean(session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role));
  if (isAdmin && remoteTarget && remoteWorkerId) {
    const worker = await resolveRemoteControllerWorker(session!.user.id, remoteTarget, remoteWorkerId);
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
