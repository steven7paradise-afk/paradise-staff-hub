export function isAppointmentEntryPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
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
