import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NfcBadgeManager } from "@/components/nfc-badge-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

export const dynamic = "force-dynamic";

export default async function NfcSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/dashboard");
  const workers = await prisma.user.findMany({
    where: { active: true, employee_status: { not: FORMER_EMPLOYEE_STATUS }, role: { not: "ZERO" } },
    select: { id: true, name: true, role: true, mansione: true, photo_url: true, nfc_badge_hash: true, nfc_badge_enabled: true, nfc_badge_enrolled_at: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <AppShell title="Badge NFC" subtitle="Associa una tessera al personale per timbrare avvicinandola al tablet.">
      <NfcBadgeManager initialWorkers={workers.map((worker) => ({
        id: worker.id, name: worker.name, role: worker.role, mansione: worker.mansione,
        photoUrl: worker.photo_url, locationName: worker.location?.name ?? null,
        hasBadge: Boolean(worker.nfc_badge_hash), enabled: worker.nfc_badge_enabled,
        enrolledAt: worker.nfc_badge_enrolled_at?.toISOString() ?? null,
      }))} />
    </AppShell>
  );
}
