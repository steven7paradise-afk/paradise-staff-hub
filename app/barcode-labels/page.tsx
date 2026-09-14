import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarcodeLabelsManager } from "@/components/barcode-labels-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function BarcodeLabelsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  if (!user || !(await canAccessForUser(prisma, "/barcode-labels", user))) redirect("/dashboard");

  return (
    <AppShell
      title="Etichette barcode"
      subtitle="Crea, salva e stampa barcode Code 128."
      role={user.role as Role}
      hideHeader
      transparentMain
      edgeToEdgeMain
    >
      <BarcodeLabelsManager />
    </AppShell>
  );
}
