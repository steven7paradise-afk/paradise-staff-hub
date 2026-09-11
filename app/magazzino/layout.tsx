import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { WAREHOUSE_TEMPORARILY_DISABLED } from "@/lib/warehouse-availability";

export const dynamic = "force-dynamic";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (WAREHOUSE_TEMPORARILY_DISABLED) redirect("/dashboard");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, mansione: true, access_list: true } });
  if (!user || !(await canAccessForUser(prisma, "/magazzino", user))) redirect("/dashboard");
  return <AppShell title="Magazzino" role={user.role as Role} hideHeader edgeToEdgeMain>{children}</AppShell>;
}
