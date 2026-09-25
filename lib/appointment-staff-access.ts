const FRANCESCA_ID = "cmqf02qgq0001jx0913ddfys1";
const STEVEN_ID = "cmpmp66np0001ie09hko78bsb";

export function canWorkAcrossAppointmentLocations(role?: string | null) {
  return ["ADMIN", "SUPER_ADMIN", "ZERO"].includes(String(role ?? "").trim().toUpperCase());
}

type AssignmentEmployee = { id: string; name: string; role?: string | null; locationName?: string | null };
const normalizeAssignmentName = (value?: string | null) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\|.*$/, "").replace(/\s+/g, " ").trim();
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
