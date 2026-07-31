import type { Role } from "@/lib/roles";

function normalized(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function hasTaskAccess(role?: Role | string | null, mansione?: string | null, locationName?: string | null) {
  if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const job = normalized(mansione);
  const place = normalized(locationName);
  return (
    role === "RESPONSABILE" ||
    job.includes("ufficio") ||
    place.includes("ufficio") ||
    job.includes("responsabile salone") ||
    job.includes("vice responsabile salone")
  );
}

export function isTaskOfficeUser(role?: Role | string | null, mansione?: string | null, locationName?: string | null) {
  if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN") return true;
  return normalized(mansione).includes("ufficio") || normalized(locationName).includes("ufficio");
}

export function taskWorkerWhere() {
  return {
    active: true,
    role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    OR: [
      { role: "ADMIN" as const },
      { role: "RESPONSABILE" as const },
      { mansione: { contains: "ufficio", mode: "insensitive" as const } },
      { location: { name: { contains: "ufficio", mode: "insensitive" as const } } },
      { mansione: { contains: "responsabile salone", mode: "insensitive" as const } },
      { mansione: { contains: "vice responsabile salone", mode: "insensitive" as const } },
    ],
  };
}
