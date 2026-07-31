import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ToVerifyViewer } from "@/components/to-verify-viewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ServiceFormsToVerifyPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");
  const role = session.user.role as Role;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!currentUser || !currentUser.active) redirect("/login");

  // Query all active form responses needing verification (status === "NEW")
  const rawNewResponses = await prisma.serviceFormResponse.findMany({
    where: {
      status: "NEW",
    },
    include: {
      form: true,
      user: { select: { id: true, name: true, role: true, photo_url: true, sede_id: true } },
    },
    orderBy: { created_at: "desc" },
    take: 300,
  });

  // Filter responses matching the user's permission scopes
  const allowedNewResponses = rawNewResponses.filter((r: any) => {
    // Exclude cash closing or safe prelievo forms
    const isCashForm = r.form?.name?.toLowerCase().includes("cassa") || 
                       r.form?.category?.toLowerCase().includes("cassa") ||
                       r.form?.name?.toLowerCase().includes("prelievo") || 
                       r.form?.category?.toLowerCase().includes("cassaforte");
    if (isCashForm) return false;

    // Exclude own submissions
    if (r.user_id === currentUser.id) return false;

    // Managers
    if (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN") return true;
    if (role === "RESPONSABILE" && r.user?.sede_id === currentUser.sede_id) return true;

    // User explicitly nominated
    const notifyUserIds = r.form?.notify_user_ids as string[] | null;
    if (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(currentUser.id)) return true;

    // Role nominated
    const notifyRoles = r.form?.notify_roles as string[] | null;
    if (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role)) return true;

    return false;
  });

  const serializedResponses = allowedNewResponses.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));

  return (
    <AppShell title="Moduli da verificare" role={role} hideHeader>
      <ToVerifyViewer
        initialResponses={serializedResponses}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        currentUserRole={role}
      />
    </AppShell>
  );
}
