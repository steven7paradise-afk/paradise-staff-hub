import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResponseDetailView } from "@/components/response-detail-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { getShopifyOrderDetails, getShopifyOrderIdentity } from "@/lib/shopify";

export const dynamic = "force-dynamic";

type PageParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function ResponseDetailPage({ params, searchParams }: PageParams) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;

  const { id } = await params;
  const query = await searchParams;

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

  const answers = (response.answers as Record<string, unknown>) || {};
  const isClientControl = isClientControlFormName(response.form?.name || "", response.form?.category || "");
  const shopifyOrderCode = isClientControl
    ? String(answers.second_shopify_order || answers.secondShopifyOrder || answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").trim()
    : "";
  const [shopifyDetails, shopifyIdentity] = shopifyOrderCode
    ? await Promise.all([
        getShopifyOrderDetails(shopifyOrderCode).catch(() => null),
        getShopifyOrderIdentity(shopifyOrderCode).catch(() => null),
      ])
    : [null, null];

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
        backUrl={query.from === "cash" ? "/cash/shopify-payments" : undefined}
        shopifyOrder={shopifyDetails ? {
          code: shopifyOrderCode,
          adminUrl: shopifyIdentity?.adminUrl || null,
          ...shopifyDetails,
        } : null}
      />
    </AppShell>
  );
}
