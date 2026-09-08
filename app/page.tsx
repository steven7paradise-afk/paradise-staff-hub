import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { normalizeDefaultPage } from "@/lib/default-page";
import { prisma } from "@/lib/prisma";
import { canAccess, getEffectivePermissionSet, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, default_page: true },
  });
  if (!user) redirect("/login");

  const preferredPage = normalizeDefaultPage(user.default_page);
  if (preferredPage) {
    const permissions = await getEffectivePermissionSet(prisma, user);
    if (canAccess(preferredPage, user.role as Role, user.mansione ?? undefined, permissions)) {
      redirect(preferredPage);
    }
  }

  redirect("/dashboard");
}
