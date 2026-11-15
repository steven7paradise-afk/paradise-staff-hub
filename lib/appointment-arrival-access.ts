import { isAppointmentPinOnlyRole } from "./appointment-pin-entry";
import { appointmentSalonSlugFromName } from "./appointment-salon-url";

type AppointmentArrivalOperator = { role?: string | null; mansione?: string | null };

export function isAppointmentReceptionist(user: AppointmentArrivalOperator) {
  const job = String(user.mansione ?? "").trim().toLowerCase();
  return /\breception(?:ist)?\b/.test(job);
}

export function canRecordEarlyAppointmentArrival(user: AppointmentArrivalOperator) {
  return isAppointmentPinOnlyRole(user.role) || isAppointmentReceptionist(user);
}

export function isRepubblicaReceptionist(user: AppointmentArrivalOperator & { location?: { name: string; active: boolean } | null }) {
  const salon = appointmentSalonSlugFromName(user.location?.name);
  return isAppointmentReceptionist(user) &&
    ((salon === "repubblica" && user.location?.active === true) ||
      (salon === "buenos-aires" && user.location?.active === false));
}

export function isAppointmentArrivalStatus(status: string) {
  return status === "IN_ATTESA" || status === "ARRIVATO_IN_RITARDO";
}

export function isReceptionArrivalAgendaPath(pathname: string, method: string) {
  if (method === "POST") return pathname === "/api/appointments/status";
  return (method === "GET" || method === "HEAD") && [
    "/appointments", "/api/appointments/events", "/api/appointments/pc/active-staff",
  ].includes(pathname);
}

export function isBeforeSalonOpening(now: Date, openingTime?: string | null) {
  if (!openingTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(openingTime)) return false;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  return time < openingTime;
}
