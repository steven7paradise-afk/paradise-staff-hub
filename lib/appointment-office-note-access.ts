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
  if (input.isPC) return false;
  if (OFFICE_NOTE_ADMIN_ROLES.has(String(input.role || ""))) return true;

  const job = normalized(input.mansione);
  const location = normalized(input.locationName);
  const isCustomerAssistance = job.includes("assistenza") || job.includes("customer care");
  const belongsToOffice = location.includes("ufficio") || job.includes("ufficio");

  return belongsToOffice && !isCustomerAssistance;
}
