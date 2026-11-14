export type AppointmentSalonSlug = "buenos-aires" | "repubblica" | "duomo" | "ufficio";

export function appointmentSalonSlugFromName(value?: string | null): AppointmentSalonSlug | null {
  const source = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (source.includes("repubblica")) return "repubblica";
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
    .replace(/\s+/g, "-")
    .replace(/^salone[-_]/, "");

  if (slug === "buenos" || slug === "corso" || slug === "corso-buenos-aires") return "buenos-aires";
  if (slug === "buenos-aires" || slug === "repubblica" || slug === "duomo" || slug === "ufficio") return slug;
  return null;
}

export function appointmentSalonUrl(slug?: AppointmentSalonSlug | null) {
  return slug ? `/appointments/${slug}` : "/appointments";
}

export function isCashierAppointmentSalon(salon: AppointmentSalonSlug | null): salon is "repubblica" | "buenos-aires" {
  return salon === "repubblica" || salon === "buenos-aires";
}

export function repubblicaIncludesLegacyBuenosAires(locations: { id: string; active: boolean; name: string }[], locationId: string) {
  const activeLocations = locations.filter((location) => location.active);
  const republica = activeLocations.filter((location) => appointmentSalonSlugFromName(location.name) === "repubblica");
  return republica.length === 1 && republica[0].id === locationId &&
    !activeLocations.some((location) => appointmentSalonSlugFromName(location.name) === "buenos-aires");
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

export function isAppointmentWorkerDestination(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^\/appointments\/([^/?#]+)\?worker=([^&#]+)$/.exec(value);
  if (!match) return false;
  const [, segment, worker] = match;
  return appointmentSalonUrl(normalizeAppointmentSalonSlug(segment)) === `/appointments/${segment}` &&
    Boolean(new URLSearchParams(`worker=${worker}`).get("worker")?.trim());
}
