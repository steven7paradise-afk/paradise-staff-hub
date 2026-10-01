const FRANCESCA_ID = "cmqf02qgq0001jx0913ddfys1";
const STEVEN_ID = "cmpmp66np0001ie09hko78bsb";

export function canWorkAcrossAppointmentLocations(role?: string | null) {
  return ["ADMIN", "SUPER_ADMIN", "ZERO"].includes(String(role ?? "").trim().toUpperCase());
}

type AssignmentEmployee = { id: string; name: string; role?: string | null; locationName?: string | null };
const normalizeAssignmentName = (value?: string | null) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\|.*$/, "").replace(/\s+/g, " ").trim();
/** Respect the existing always-active owner exception; other staff need the actual salon. */
export function suggestEmployeeForAppointmentSalon(employee: AssignmentEmployee, salon: string) {
  if (isAlwaysActiveAppointmentStaff(employee.name, employee.id)) return true;
  const normalize = (value?: string | null) => {
    const name = normalizeAssignmentName(value);
    if (!name || name.includes("ufficio")) return "";
    const clean = name.replace(/^salone\s+/, "").replace(/^corso\s+/, "");
    if (clean === "corso" || clean === "buenos aires") return "buenos aires";
    return clean;
  };
  const location = normalize(employee.locationName);
  const target = normalize(salon);
  return Boolean(location && target && location === target);
}

export function appointmentOperatorInSalon(employees: AssignmentEmployee[], operator: { id?: string; name?: string } | null, salon: string) {
  if (!operator) return undefined;
  const eligible = employees.filter(employee => suggestEmployeeForAppointmentSalon(employee, salon));
  if (operator.id && operator.id !== "kiosk-selected-worker") {
    return eligible.find(employee => employee.id === operator.id);
  }
  const name = normalizeAssignmentName(operator.name);
  if (!name) return undefined;
  const matches = eligible.filter(employee => normalizeAssignmentName(employee.name) === name ||
    normalizeAssignmentName(appointmentStaffDisplayName(employee.name, employee.id)) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

export function isClockedInAppointmentWorker(worker: { status?: string; clockedInAt?: string | null }) {
  return ["IN", "BREAK"].includes(worker.status || "") &&
    Boolean(worker.clockedInAt && Number.isFinite(Date.parse(worker.clockedInAt)));
}

export function isAvailableAppointmentServiceWorker(
  employee: AssignmentEmployee,
  attendance: { id: string; status?: string; clockedInAt?: string | null }[],
  salon: string,
) {
  return suggestEmployeeForAppointmentSalon(employee, salon) && (
    isAlwaysActiveAppointmentStaff(employee.name, employee.id) ||
    attendance.some(worker => worker.id === employee.id && isClockedInAppointmentWorker(worker))
  );
}

export function employeeMatchesAppointmentLocation(employee: AssignmentEmployee, salon: string) {
  if (canWorkAcrossAppointmentLocations(employee.role)) return true;
  const normalize = (value?: string | null) => normalizeAssignmentName(value).replace(/^salone\s+/, "").replace(/^corso\s+/, "");
  const location = normalize(employee.locationName);
  const target = normalize(salon);
  return Boolean(location && target && (location.includes(target) || target.includes(location)));
}

export function matchAppointmentEmployeeIds(team: { id: string; name: string }[], employees: AssignmentEmployee[], salon: string) {
  const eligible = employees.filter(employee => employeeMatchesAppointmentLocation(employee, salon));
  return [...new Set(team.flatMap(mate => {
    const byId = employees.find(employee => employee.id === mate.id);
    // An explicit identity must never be replaced by a similarly named worker.
    if (byId) return [byId.id];
    const name = normalizeAssignmentName(mate.name);
    if (!name) return [];
    const exact = eligible.filter(employee => normalizeAssignmentName(employee.name) === name);
    if (exact.length === 1) return [exact[0].id];
    const parts = name.split(" ");
    const compatible = eligible.filter(employee => parts.every(part => normalizeAssignmentName(employee.name).split(" ").includes(part)));
    return compatible.length === 1 ? [compatible[0].id] : [];
  }))];
}

const ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES = new Set(["franci"]);
const ALWAYS_ACTIVE_APPOINTMENT_STAFF_IDS = new Set([FRANCESCA_ID]);

export function isAlwaysActiveAppointmentStaff(
  name: string | null | undefined,
  userId?: string | null,
) {
  const normalizedName = String(name || "").trim().toLocaleLowerCase("it");
  const normalizedId = String(userId || "").trim();

  return (
    ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES.has(normalizedName) ||
    ALWAYS_ACTIVE_APPOINTMENT_STAFF_IDS.has(normalizedId)
  );
}

export function appointmentStaffDisplayName(
  name: string | null | undefined,
  userId?: string | null,
) {
  const cleanName = String(name || "").trim();
  const normalizedName = cleanName.toLocaleLowerCase("it");
  const normalizedId = String(userId || "").trim();

  if (normalizedName === "franci" || normalizedId === FRANCESCA_ID) return "Francesca";
  if (normalizedName === "steven alvarez" || normalizedId === STEVEN_ID) return "Steven";
  return cleanName || "Staff";
}
