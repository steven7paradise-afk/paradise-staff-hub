import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderManager } from "@/components/order-manager";
import { ensureOrderForm } from "@/lib/order-form";
import { resolveOrderConfirmer } from "@/lib/order-confirmation";
import { resolveOrderWorkspaceAccess } from "@/lib/order-workspace-access";
import { findOrderWorkspaceReference, loadOrderWorkspace } from "@/lib/order-workspace-store";
import { isOrderInWorkspace, orderWorkspacePath, type OrderWorkspace } from "@/lib/order-workspace";
import { prisma } from "@/lib/prisma";

export type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function OrdersPage({ searchParams: pendingSearchParams, workspace }: OrdersPageProps & { workspace: OrderWorkspace }) {
  const searchParams = await pendingSearchParams;
  const access = await resolveOrderWorkspaceAccess({
    cookieStore: await cookies(),
    remoteTarget: typeof searchParams.remoteTarget === "string" ? searchParams.remoteTarget : "",
  });
  if (!access.ok) redirect(access.redirectTo);
  const { session, isPC, role, canManageOrders, remoteWorker, remoteTarget, isAdminRemoteController, selectedPcWorker, operationalLocationId } = access;
  await ensureOrderForm(isPC ? "u-super-admin" : session!.user.id);

  const reference = [searchParams.ordine, searchParams.order, searchParams.orderId]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const linkedOrder = reference ? await findOrderWorkspaceReference(reference, operationalLocationId) : null;
  if (linkedOrder && !isOrderInWorkspace(linkedOrder, workspace)) {
    const targetWorkspace = workspace === "orders" ? "conversions" : "orders";
    const nextParams = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) value.forEach((item) => nextParams.append(key, item));
      else if (typeof value === "string") nextParams.set(key, value);
    }
    redirect(`${orderWorkspacePath(targetWorkspace)}?${nextParams.toString()}`);
  }

  const [responses, orderStaff] = await Promise.all([
    loadOrderWorkspace(workspace, operationalLocationId),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, photo_url: true } }),
  ]);
  // An old printed label stays accessible even outside the board's latest 300.
  if (linkedOrder && !responses.some((order) => order.id === linkedOrder.id)) {
    responses.unshift(linkedOrder);
    if (responses.length > 300) responses.pop();
  }
  const orders = responses.map((response) => ({
    ...response,
    confirmed_by: resolveOrderConfirmer(response, orderStaff),
    created_at: response.created_at.toISOString(),
    updated_at: response.updated_at.toISOString(),
  }));
  const isConversions = workspace === "conversions";

  return (
    <AppShell
      title={isConversions ? "Conversioni capelli" : "Ordini"}
      subtitle={isConversions ? "Lavorazioni di conversione capelli create dai moduli operativi." : "Pipeline ordini creati dai moduli operativi."}
      role={role}
      hideHeader
      pcMode={isPC}
      remoteController={isAdminRemoteController}
      pcDisplayUser={remoteWorker ? { name: remoteWorker.name, photo_url: remoteWorker.photo_url } : selectedPcWorker}
      pcProfileChooserHrefOverride={isAdminRemoteController ? `/appointments/buenos-aires?choose=1&remoteTarget=${encodeURIComponent(remoteTarget)}` : undefined}
    >
      <OrderManager
        key={workspace}
        workspace={workspace}
        initialOrders={orders as any}
        canManage={canManageOrders}
        currentUserName={remoteWorker?.name || selectedPcWorker?.name || (isPC ? "PC Cassa" : session?.user?.name ?? "Staff")}
        currentUserRole={role}
      />
    </AppShell>
  );
}
