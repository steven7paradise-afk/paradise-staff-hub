import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InternalEmailComposer } from "@/components/internal-email-composer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      sede_id: true,
      location: { select: { name: true } },
    },
  });
  if (!sender || !allowedRoles.has(sender.role)) redirect("/dashboard");

  const recipientWhere = { active: true };

  const recipients = await prisma.user.findMany({
    where: recipientWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mansione: true,
      photo_url: true,
      location: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      title="Email"
      subtitle="Invia comunicazioni interne direttamente al personale Paradise."
      hidePageHeaderOnMobile
      edgeToEdgeMain
      hideDesktopControls
      hideDesktopSidebar
      hideAdminAssistant
    >
      <InternalEmailComposer
        currentUserId={sender.id}
        currentUserName={sender.name}
        focusMessageId={params.message || null}
        restrictedToLocation={null}
        recipients={recipients.map((recipient) => ({
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          mansione: recipient.mansione,
          locationName: recipient.location?.name || null,
          photoUrl: recipient.photo_url,
        }))}
      />
    </AppShell>
  );
}
