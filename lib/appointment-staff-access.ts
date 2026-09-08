const FRANCESCA_ID = "cmqf02qgq0001jx0913ddfys1";
const STEVEN_ID = "cmpmp66np0001ie09hko78bsb";

const ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES = new Set(["franci", "steven alvarez"]);
const ALWAYS_ACTIVE_APPOINTMENT_STAFF_IDS = new Set([FRANCESCA_ID, STEVEN_ID]);

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
