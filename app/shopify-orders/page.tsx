import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShopifyOrdersConsole } from "@/components/shopify-orders-console";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { auth } from "@/lib/auth";
import { canAccessForUser, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { fetchShopifyOrdersPage } from "@/lib/shopify-orders-dashboard";

export const dynamic = "force-dynamic";

export default async function ShopifyOrdersPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
  const isPC = Boolean(pcAuth);

  if (!session?.user?.id && !isPC) redirect("/login");

  let role: Role = isPC ? "RESPONSABILE" : (session!.user.role as Role);
  if (!isPC) {
    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { id: true, role: true, mansione: true, access_list: true, active: true },
    });
    if (!user?.active) redirect("/login");
    if (!(await canAccessForUser(prisma, "/orders", user))) redirect("/dashboard");
    role = user.role as Role;
  }

  let initialData = { orders: [], hasNextPage: false, endCursor: null } as Awaited<ReturnType<typeof fetchShopifyOrdersPage>>;
  let initialError = "";
  try {
    initialData = await fetchShopifyOrdersPage({ first: 50 });
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Impossibile caricare gli ordini Shopify.";
  }

  return (
    <AppShell
      title="Ordini Shopify"
      subtitle="Gestione degli ordini Shopify direttamente da Paradise"
      role={role}
      hideHeader
      edgeToEdgeMain
      pcMode={isPC}
      hideDesktopControls
      hideAdminAssistant
    >
      <ShopifyOrdersConsole initialData={initialData} initialError={initialError} />
    </AppShell>
  );
}

