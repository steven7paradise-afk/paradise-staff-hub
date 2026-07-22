import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { FotoUploadClient } from "./foto-upload-client";

export const dynamic = "force-dynamic";

export default async function FotoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <AppShell
      title="Foto"
      subtitle="Caricamento rapido foto ordini su Google Drive."
      role={session.user.role as Role}
      hidePageHeaderOnMobile
      hideHeader
    >
      <FotoUploadClient />
    </AppShell>
  );
}
