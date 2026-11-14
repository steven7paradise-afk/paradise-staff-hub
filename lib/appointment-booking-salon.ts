import {
  appointmentSalonSlugFromName,
  normalizeAppointmentSalonSlug,
  repubblicaIncludesLegacyBuenosAires,
  type AppointmentSalonSlug,
} from "./appointment-salon-url";

type Location = { id: string; name: string; active: boolean };

export function agendaSalonScope(locations: Location[]) {
  const activeNonOffice = locations.filter(location =>
    location.active && appointmentSalonSlugFromName(location.name) !== "ufficio",
  );
  const repubblica = activeNonOffice.find(location => appointmentSalonSlugFromName(location.name) === "repubblica");
  return {
    mergeLegacyCorso: Boolean(repubblica && repubblicaIncludesLegacyBuenosAires(locations, repubblica.id)),
    defaultToRepubblica: Boolean(repubblica && activeNonOffice.length === 1),
  };
}

type SalonScope = ReturnType<typeof agendaSalonScope>;

type BookingSalonFields = {
  form_data?: Record<string, unknown> | null;
  service?: { title?: string | null } | null;
  booking_str?: string | null;
  teammates?: { firstname?: string | null; lastname?: string | null }[];
};

function salonsFromText(value: unknown): AppointmentSalonSlug[] {
  if (typeof value !== "string") return [];
  const slug = normalizeAppointmentSalonSlug(value);
  if (slug) return [slug];
  const text = value.toLowerCase();
  const salons: AppointmentSalonSlug[] = [];
  if (/\bduomo\b/.test(text)) salons.push("duomo");
  if (/\bufficio\b/.test(text)) salons.push("ufficio");
  if (/\brepubblica\b/.test(text)) salons.push("repubblica");
  if (/\bbuenos[\s_-]+aires\b/.test(text)) salons.push("buenos-aires");
  return salons;
}

export function resolveAgendaAppointmentSalon(
  booking: BookingSalonFields,
  teammateLocations: (string | null | undefined)[],
  scope: SalonScope,
  preferBookingLocation: boolean,
): AppointmentSalonSlug | "altro" {
  const canonical = (salon: AppointmentSalonSlug) =>
    salon === "buenos-aires" && scope.mergeLegacyCorso ? "repubblica" : salon;
  const readSalons = (values: unknown[]) => [...new Set(values.flatMap(salonsFromText).map(canonical))];

  const formLocations = [booking.form_data?.sede, booking.form_data?.salone];
  const explicitFormSalons = readSalons(formLocations);
  if (explicitFormSalons.length > 1) return "altro";
  if (explicitFormSalons[0]) return explicitFormSalons[0];
  if (preferBookingLocation && formLocations.some(value =>
    typeof value === "string" && value.trim() !== "" && !/^(?:no data|n\/a|-)$/i.test(value.trim()),
  )) return "altro";

  const explicitBookingSalons = readSalons([booking.service?.title, booking.booking_str]);
  if (preferBookingLocation && explicitBookingSalons.length > 1) return "altro";
  const bookingSalon = explicitBookingSalons[0];
  const workerSalons = readSalons(teammateLocations);
  const workerSalon = workerSalons.find(salon => salon !== "ufficio");
  const externalSalon = readSalons((booking.teammates ?? []).map(mate =>
    `${mate.firstname ?? ""} ${mate.lastname ?? ""}`,
  ))[0];
  const inferred = (preferBookingLocation ? bookingSalon : undefined) || workerSalon || bookingSalon || externalSalon;
  // A collaborator's office assignment is not the venue of a salon service.
  return inferred || (scope.defaultToRepubblica ? "repubblica" : workerSalons[0] || "altro");
}
