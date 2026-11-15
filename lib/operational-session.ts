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
import { isRepubblicaReceptionist } from "@/lib/appointment-arrival-access";
import { appointmentPcArrivalCookieName, verifyAppointmentPcArrival } from "@/lib/appointment-pc-arrival-session";
import { findAppointmentPcArrivalOperator } from "@/lib/appointment-pc-arrival-operator";
import {
  appointmentStaffDisplayName,
  isAlwaysActiveAppointmentStaff,
} from "@/lib/appointment-staff-access";

export type OperationalUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  mansione?: string | null;
  sedeId?: string | null;
  isPC?: boolean;
  hasVerifiedPcArrivalSession?: boolean;
  arrivalOnly?: boolean;
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
  options?: {
    requirePcWorker?: boolean;
    preferAuthenticatedAdmin?: boolean;
    allowReceptionArrival?: boolean;
    allowPcOwnerStart?: boolean;
  },
): Promise<OperationalUser | null> {
  const session = await auth();
  const pcToken = request.cookies.get(appointmentsPcCookieName)?.value;
  const pcAuth = await checkPCAuthorization(pcToken).catch(() => null);
  const hasAuthenticatedAdmin = Boolean(
    session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  if (pcAuth && !(options?.preferAuthenticatedAdmin && hasAuthenticatedAdmin)) {
    const token = request.cookies.get(appointmentPcArrivalCookieName)?.value;
    if (token && (options?.allowReceptionArrival || options?.allowPcOwnerStart)) {
      const operator = await findAppointmentPcArrivalOperator(
        pcAuth.locationId, pcToken, token,
      );
      if (operator && (options.allowReceptionArrival ||
        (options.allowPcOwnerStart && !operator.arrivalOnly && isAlwaysActiveAppointmentStaff(operator.name, operator.id)))) return {
        id: operator.id,
        name: appointmentStaffDisplayName(operator.name, operator.id),
        email: operator.email,
        role: operator.role,
        mansione: operator.mansione,
        sedeId: pcAuth.locationId,
        isPC: true,
        hasVerifiedPcArrivalSession: true,
        arrivalOnly: operator.arrivalOnly,
      };
    }
    if (!options?.allowReceptionArrival &&
      verifyAppointmentPcArrival(token, pcToken, process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)?.arrivalOnly) {
      return null;
    }
    const workerIdentity = selectedWorkerIdentity(request);
    const workerCandidate = workerIdentity
      ? await prisma.user.findFirst({
        where: {
          active: true,
          employee_status: { not: FORMER_EMPLOYEE_STATUS },
          OR: [{ id: workerIdentity }, { name: workerIdentity }],
        },
        select: { id: true, name: true, email: true, role: true, mansione: true, sede_id: true },
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
        mansione: worker.mansione,
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
    select: { id: true, name: true, email: true, role: true, mansione: true, sede_id: true, active: true, location: { select: { name: true, active: true } } },
  }).catch(() => null);
  if (!dbUser?.active) return null;
  const outsideShift = isShiftProtectedPath(request.nextUrl.pathname) &&
    !(await canAccessSalonShiftModules(dbUser).catch(() => false));
  if (outsideShift && !(options?.allowReceptionArrival && isRepubblicaReceptionist(dbUser))) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    mansione: dbUser.mansione,
    sedeId: dbUser.sede_id,
    isPC: false,
    arrivalOnly: outsideShift,
  };
}
