export function canViewManagementDashboard(role: string | null | undefined) {
  return role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
}
