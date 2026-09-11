import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });

  if (!user || !(await canAccessForUser(prisma, "/hub", user))) {
    redirect("/dashboard");
  }

  return (
    <AppShell
      title="Magazzino Paradise"
      role={session.user.role as Role}
      hideHeader
      edgeToEdgeMain
      hideDesktopControls
      hideAdminAssistant
    >
      <iframe
        src="https://exciting-renewal-production-8936.up.railway.app/hub"
        title="Magazzino Paradise"
        loading="eager"
        allow="clipboard-read; clipboard-write"
        className="block h-[calc(100dvh-64px)] min-h-[640px] w-full border-0 bg-white xl:h-dvh"
      />
    </AppShell>
  );
}
