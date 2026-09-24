const OFFICE_NOTE_ADMIN_ROLES = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function normalized(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function canManageAppointmentOfficeNotes(input: {
  role?: string | null;
  mansione?: string | null;
  locationName?: string | null;
  isPC?: boolean;
}) {
  // Il ruolo amministrativo resta valido anche quando l'utente entra dal PC
  // cassa tramite il proprio PIN. In quel flusso `isPC` e' true, ma non deve
  // annullare i permessi di ZERO / SUPER_ADMIN / ADMIN.
  if (OFFICE_NOTE_ADMIN_ROLES.has(String(input.role || ""))) return true;

  const job = normalized(input.mansione);
  const location = normalized(input.locationName);
  const belongsToOffice = location.includes("ufficio") || job.includes("ufficio");
  const belongsToBuenosAires = location.includes("buenos aires") || location.includes("corso");

  return belongsToOffice || belongsToBuenosAires;
}
