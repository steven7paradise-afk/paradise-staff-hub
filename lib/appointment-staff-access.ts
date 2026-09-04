const ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES = new Set(["franci"]);

export function isAlwaysActiveAppointmentStaff(name: string | null | undefined) {
  return ALWAYS_ACTIVE_APPOINTMENT_STAFF_NAMES.has(String(name || "").trim().toLocaleLowerCase("it"));
}
