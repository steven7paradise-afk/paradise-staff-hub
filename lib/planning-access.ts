import type { Role } from "@/lib/roles";

export const PLANNING_ACCESS_KEY = "planning_view_access";

export type PlanningAccess = {
  roles: Role[];
  userIds: string[];
  nextMonthVisible: boolean;
};

export function normalizePlanningAccess(value: unknown): PlanningAccess {
  const allowedRoles: Role[] = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE", "DIPENDENTE"];
  const defaultRoles: Role[] = ["RESPONSABILE", "DIPENDENTE"];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { roles: defaultRoles, userIds: [], nextMonthVisible: true };
  }
  const data = value as Record<string, unknown>;
  const roles = Array.isArray(data.roles)
    ? data.roles.filter((role): role is Role => allowedRoles.includes(role as Role))
    : defaultRoles;
  const userIds = Array.isArray(data.userIds)
    ? data.userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const nextMonthVisible = typeof data.nextMonthVisible === "boolean" ? data.nextMonthVisible : true;
  return { roles, userIds, nextMonthVisible };
}

export function canViewPlanning(role?: Role | string, userId?: string | null, access?: PlanningAccess) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const rules = access ?? normalizePlanningAccess(null);
  return rules.roles.includes(role as Role) || (userId ? rules.userIds.includes(userId) : false);
}

export function canEditPlanning(role?: Role | string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
