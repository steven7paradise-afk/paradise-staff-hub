/** Office access is based on the assigned location, never on a role or display name. */
export function isAppointmentOfficeLocation(location?: string | null) {
  const normalized = String(location || "").trim().toLocaleLowerCase("it").replace(/\s+/g, " ").replace(/^salone\s+/, "");
  return normalized === "ufficio" || normalized === "ufficio paradise";
}

export function canAssignAppointmentOfficeStaff(operatorLocation?: string | null, staffLocation?: string | null) {
  return isAppointmentOfficeLocation(operatorLocation) && isAppointmentOfficeLocation(staffLocation);
}
