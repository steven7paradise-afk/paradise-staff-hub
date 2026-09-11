import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RemoteControlSetup } from "@/components/remote-control-setup";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RemotePage() {
  const session = await auth();
  if (!session?.user?.id || !["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/dashboard");

  return (
    <AppShell title="Controllo remoto" subtitle="Controlla in diretta il gestionale del salone">
      <RemoteControlSetup />
    </AppShell>
  );
}
