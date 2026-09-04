import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

const CASHMATIC_LIVE_URL = "https://cashmatic-payment-production.up.railway.app/cassa-live";

export default async function CassaLivePage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      mansione: true,
      access_list: true,
      active: true,
    },
  }).catch(() => null);

  if (!user?.active) redirect("/login");
  if (!(await canAccessForUser(prisma, "/cassa-live", user))) redirect("/dashboard");

  return (
    <AppShell
      title="Cassa Live"
      subtitle="Controllo Cashmatic in tempo reale"
      role={user.role as Role}
      hideHeader
      edgeToEdgeMain
      hideDesktopControls
      hideAdminAssistant
    >
      <iframe
        src={CASHMATIC_LIVE_URL}
        title="Cassa Live Cashmatic"
        loading="eager"
        allow="clipboard-read; clipboard-write"
        className="block h-[calc(100dvh-64px)] min-h-[640px] w-full border-0 bg-white xl:h-dvh"
      />
    </AppShell>
  );
}
