import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { normalizeServicePage, servicePages, type ServicePageNumber } from "@/lib/service-pages";

export async function requireServicePageAccess(role: Role, locationId: string | null | undefined, page: ServicePageNumber, userId?: string) {
  if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE") return;

  // La matrice Ruoli & permessi e le autorizzazioni della mansione sono
  // definitive. Una pagina concessa esplicitamente non deve essere bloccata
  // dalla vecchia impostazione che sceglieva una sola pagina per ogni sede.
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, mansione: true, access_list: true },
    });
    if (user && await canAccessForUser(prisma, servicePages[page].href, user)) return;
  }

  if (page === 3 && userId) {
    // Check if the user is nominated for notifications
    const allActiveForms = await prisma.serviceForm.findMany({
      where: { active: true },
      select: { notify_user_ids: true, notify_roles: true }
    });

    const isNominated = allActiveForms.some((form) => {
      const notifyUserIds = form.notify_user_ids as string[] | null;
      const notifyRoles = form.notify_roles as string[] | null;
      return (
        (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(userId)) ||
        (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role))
      );
    });

    if (isNominated) return; // Allow access
  }

  if (!locationId) redirect("/dashboard");

  const setting = await prisma.setting.findUnique({ where: { key: `service_page:${locationId}` } });
  
  // Parse setting value
  let servicePageNum = 1;
  if (setting?.value) {
    if (typeof setting.value === "object" && setting.value !== null && !Array.isArray(setting.value)) {
      servicePageNum = Number((setting.value as any).page) || 1;
    } else {
      servicePageNum = Number(setting.value) || 1;
    }
  }

  if (normalizeServicePage(servicePageNum) !== page) redirect("/dashboard");
}
