export function isAppointmentEntryPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

// Administrators use the full PIN, never the public portrait/prefix selector.
// This identifies the operator only; it does not create an administrator session.
export function isAppointmentPinOnlyRole(role: string | null | undefined) {
  return ["ADMIN", "SUPER_ADMIN", "ZERO"].includes(role ?? "");
}

export async function uniquelyMatchAppointmentPin<T>(candidates: T[], matches: (candidate: T) => Promise<boolean>): Promise<T | null> {
  let selected: T | null = null;
  for (const candidate of candidates) {
    if (!await matches(candidate)) continue;
    if (selected !== null) return null;
    selected = candidate;
  }
  return selected;
}
