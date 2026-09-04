const ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES = new Set(["franci"]);
const ALWAYS_ACTIVE_APPOINTMENT_STAFF_IDS = new Set(["cmqf02qgq0001jx0913ddfys1"]);

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
