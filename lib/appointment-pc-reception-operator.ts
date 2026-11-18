import { isAppointmentReceptionist } from "./appointment-arrival-access";
import { appointmentDateKey, addAppointmentDays } from "./appointment-date";
import { isAppointmentPinOnlyRole } from "./appointment-pin-entry";
import { verifyAppointmentPcReception } from "./appointment-pc-reception-session";
import { appointmentSalonForPC, isAppointmentStaffLocationForPC } from "./appointments-pc-auth";
import { deriveAttendanceState } from "./attendance-state";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
import { prisma } from "./prisma";

/** The caller must obtain pc through checkPCAuthorization, never request data. */
export async function findAppointmentPcReceptionOperator(
  pc: { locationId: string; accessMode?: "worker" | "reception" },
  deviceToken: string | undefined,
  operatorToken: string | undefined,
) {
  if (pc.accessMode !== "reception") return null;
  const now = Date.now();
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const session = verifyAppointmentPcReception(operatorToken, deviceToken, pc.locationId, secret, now);
  if (!session || await appointmentSalonForPC(pc.locationId) !== "repubblica") return null;

  const day = appointmentDateKey(new Date(now));
  const worker = await prisma.user.findFirst({
    where: { id: session.userId, active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } },
    select: {
      id: true, name: true, email: true, photo_url: true, role: true, mansione: true, sede_id: true,
      attendance_logs: {
        where: {
          date: { gte: new Date(`${day}T00:00:00.000Z`), lt: new Date(`${addAppointmentDays(day, 1)}T00:00:00.000Z`) },
          timestamp: { lte: new Date(now) },
        },
        select: { type: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });
  if (!worker) return null;
  const administrator = isAppointmentPinOnlyRole(worker.role);
  if (!administrator && (!isAppointmentReceptionist(worker) || !worker.sede_id ||
      !await isAppointmentStaffLocationForPC(pc.locationId, worker.sede_id))) return null;
  const attendance = deriveAttendanceState(worker.attendance_logs);
  return {
    id: worker.id,
    name: worker.name,
    email: worker.email,
    photo_url: worker.photo_url,
    role: worker.role,
    mansione: worker.mansione,
    sede_id: worker.sede_id,
    arrivalOnly: !administrator && attendance.status === "OUT",
    expiresAt: session.expiresAt,
  };
}
