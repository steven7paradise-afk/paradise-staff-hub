import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { normalizeServicePage, type ServicePageNumber } from "@/lib/service-pages";

export async function requireServicePageAccess(role: Role, locationId: string | null | undefined, page: ServicePageNumber) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return;
  if (!locationId) redirect("/dashboard");

  const setting = await prisma.setting.findUnique({ where: { key: `service_page:${locationId}` } });
  if (normalizeServicePage(String(setting?.value ?? 1)) !== page) redirect("/dashboard");
}
