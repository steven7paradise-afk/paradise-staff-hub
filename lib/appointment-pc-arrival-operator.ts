import { isAppointmentPinOnlyRole } from "./appointment-pin-entry";
import { canRecordEarlyAppointmentArrival } from "./appointment-arrival-access";
import { appointmentSalonForPC, isAppointmentStaffLocationForPC } from "./appointments-pc-auth";
import { verifyAppointmentPcArrival } from "./appointment-pc-arrival-session";
import { FORMER_EMPLOYEE_STATUS } from "./former-employee";
import { prisma } from "./prisma";

export async function findAppointmentPcArrivalOperator(
  locationId: string,
  deviceToken: string | undefined,
  operatorToken: string | undefined,
) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const session = verifyAppointmentPcArrival(operatorToken, deviceToken, secret);
  if (!session || await appointmentSalonForPC(locationId) !== "repubblica") return null;

  const worker = await prisma.user.findFirst({
    where: { id: session.userId, active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS } },
    select: { id: true, name: true, email: true, role: true, mansione: true, sede_id: true },
  });
  if (!worker || !canRecordEarlyAppointmentArrival(worker)) return null;
  if (!isAppointmentPinOnlyRole(worker.role) &&
    (!worker.sede_id || !await isAppointmentStaffLocationForPC(locationId, worker.sede_id))) return null;
  return { ...worker, arrivalOnly: session.arrivalOnly };
}
