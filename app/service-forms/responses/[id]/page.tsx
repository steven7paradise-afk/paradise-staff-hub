import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResponseDetailView } from "@/components/response-detail-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function ResponseDetailPage({ params }: PageParams) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;

  const { id } = await params;

  // Retrieve the response
  const response = await prisma.serviceFormResponse.findUnique({
    where: { id },
    include: {
      user: true,
      form: true,
    },
  });

  if (!response) redirect("/dashboard");

  // Verify access permissions
  const isOwner = response.user_id === session.user.id;
  const isManager = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role);
  
  const notifyUserIds = response.form?.notify_user_ids as string[] | null;
  const notifyRoles = response.form?.notify_roles as string[] | null;
  const isRecipient =
    (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(session.user.id)) ||
    (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(role));

  if (!isOwner && !isManager && !isRecipient) {
    redirect("/dashboard");
  }

  // Serialize dates
  const serializedResponse = {
    ...response,
    created_at: response.created_at.toISOString(),
    updated_at: response.updated_at.toISOString(),
  };

  return (
    <AppShell 
      title="Dettaglio Modulo"
      subtitle={`Dettaglio della risposta compilata per il modulo: ${response.form?.name || ""}`}
      role={role}
    >
      <ResponseDetailView
        initialResponse={serializedResponse}
        currentUserId={session.user.id}
        currentUserName={session.user.name || "Utente"}
        currentUserRole={role}
        isManager={isManager}
      />
    </AppShell>
  );
}
