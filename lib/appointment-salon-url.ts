export type AppointmentSalonSlug = "buenos-aires" | "duomo" | "ufficio";

export function appointmentSalonSlugFromName(value?: string | null): AppointmentSalonSlug | null {
  const source = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (source.includes("buenos") || source.includes("corso")) return "buenos-aires";
  if (source.includes("duomo")) return "duomo";
  if (source.includes("ufficio")) return "ufficio";
  return null;
}

export function normalizeAppointmentSalonSlug(value?: string | string[] | null): AppointmentSalonSlug | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^salone-/, "")
    .replace(/^salone_/, "")
    .replace(/\s+/g, "-");

  if (slug === "buenos" || slug === "corso" || slug === "corso-buenos-aires") return "buenos-aires";
  if (slug === "buenos-aires" || slug === "duomo" || slug === "ufficio") return slug;
  return null;
}

export function appointmentSalonUrl(slug?: AppointmentSalonSlug | null) {
  return slug ? `/appointments/${slug}` : "/appointments";
}

export function isSameAppointmentDestination(currentHref: string, destination: string) {
  try {
    const current = new URL(currentHref, "https://staff-paradise.local");
    const next = new URL(destination, current.origin);
    return current.pathname === next.pathname && current.search === next.search;
  } catch {
    return false;
  }
}
