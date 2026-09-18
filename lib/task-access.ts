import type { Role } from "@/lib/roles";
import type { Prisma } from "@prisma/client";

function normalized(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function hasTaskAccess(role?: Role | string | null, mansione?: string | null, locationName?: string | null) {
  void mansione;
  void locationName;
  return ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE", "MAGAZZINO", "DIPENDENTE"].includes(role ?? "");
}

export function canViewAllTasks(role?: Role | string | null, mansione?: string | null, locationName?: string | null) {
  return role === "ZERO"
    || role === "SUPER_ADMIN"
    || role === "ADMIN"
    || role === "RESPONSABILE"
    || isTaskOfficeUser(role, mansione, locationName);
}

export function taskMentionSlug(name?: string | null) {
  return normalized(name).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function taskParticipantWhere(userId: string, userName?: string | null): Prisma.StaffTaskWhereInput {
  const mention = taskMentionSlug(userName);
  const commentVisibility: Prisma.StaffTaskCommentWhereInput = mention
    ? {
        OR: [
          { user_id: userId },
          { message: { contains: `@${mention}`, mode: "insensitive" } },
        ],
      }
    : { user_id: userId };

  return {
    OR: [
      { created_by_id: userId },
      { assignees: { some: { id: userId } } },
      { comments: { some: commentVisibility } },
    ],
  };
}

export function isTaskOfficeUser(role?: Role | string | null, mansione?: string | null, locationName?: string | null) {
  if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN") return true;
  return normalized(mansione).includes("ufficio") || normalized(locationName).includes("ufficio");
}

export function taskWorkerWhere(): Prisma.UserWhereInput {
  return {
    active: true,
    employee_status: { not: "Ex dipendente" },
    role: { not: "ZERO" },
  };
}

export function taskEscalationRecipientWhere(locationId?: string | null): Prisma.UserWhereInput {
  return {
    active: true,
    employee_status: { not: "Ex dipendente" },
    role: { not: "ZERO" },
    OR: [
      { role: "SUPER_ADMIN" as const },
      { role: "ADMIN" as const },
      { mansione: { contains: "ufficio", mode: "insensitive" as const } },
      { location: { name: { contains: "ufficio", mode: "insensitive" as const } } },
      { role: "RESPONSABILE" as const, ...(locationId ? { sede_id: locationId } : {}) },
      {
        ...(locationId ? { sede_id: locationId } : {}),
        mansione: { contains: "responsabile salone", mode: "insensitive" as const },
      },
      {
        ...(locationId ? { sede_id: locationId } : {}),
        mansione: { contains: "vice responsabile salone", mode: "insensitive" as const },
      },
    ],
  };
}
