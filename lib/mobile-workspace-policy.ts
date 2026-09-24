import { canAccess, canEdit, type PermissionSet, type Role } from "./roles";
import { appointmentSalonSlugFromName } from "./appointment-salon-url";

export const nativeModules = [
  { id: "appointments", title: "Appuntamenti", subtitle: "Agenda e note ufficio", symbol: "calendar", path: "/appointments" },
  { id: "employees", title: "Staff", subtitle: "Persone e sedi", symbol: "person.2", path: "/employees" },
  { id: "locations", title: "Sedi", subtitle: "Contatti dei saloni", symbol: "building.2", path: "/locations" },
] as const;

export function workspaceModules(user: { role: string; mansione?: string | null } | null, permissions?: PermissionSet) {
  // A device is not a staff identity. Salon mode only exposes its agenda, read-only.
  return nativeModules.filter((item) => user
    ? canAccess(item.path, user.role as Role, user.mansione ?? undefined, permissions)
    : item.id === "appointments").map((item) => ({
      ...item,
      canEdit: !!user && canEdit(item.path, user.role as Role, user.mansione ?? undefined, permissions),
    }));
}

export function isWorkspaceAdmin(role: string) {
  return ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(role);
}

// Fail closed: bookings with an unknown salon are never disclosed to a shared device.
export function bookingBelongsToSalon(serviceTitle: string | null | undefined, locationName: string) {
  const salon = appointmentSalonSlugFromName(locationName);
  const source = String(serviceTitle ?? "").toLowerCase();
  if (source.includes("duomo") && (source.includes("buenos") || source.includes("corso"))) return false;
  return (salon === "buenos-aires" || salon === "duomo") && appointmentSalonSlugFromName(serviceTitle) === salon;
}

export function officeNoteText(value: unknown): string {
  return value && typeof value === "object" && "text" in value && typeof value.text === "string" ? value.text : "";
}
