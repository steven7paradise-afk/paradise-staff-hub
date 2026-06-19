import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderManager } from "@/components/order-manager";
import { auth } from "@/lib/auth";
import { ensureOrderForm, ORDER_FORM_CATEGORY } from "@/lib/order-form";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const canManageOrders = ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role);

  await ensureOrderForm(session.user.id);

  const responses = await prisma.serviceFormResponse.findMany({
    include: { user: true, form: true },
    orderBy: { created_at: "desc" },
  });

  const orders = responses
    .filter((response) => {
      const formName = response.form?.name?.toLowerCase() ?? "";
      const category = response.form?.category?.toLowerCase() ?? "";
      return category === ORDER_FORM_CATEGORY.toLowerCase() || formName.includes("ordine");
    })
    .filter((response) => response.status !== "ARCHIVED")
    .map((response) => ({
      ...response,
      created_at: response.created_at.toISOString(),
      updated_at: response.updated_at.toISOString(),
    }));

  return (
    <AppShell title="Ordini" subtitle="Pipeline ordini creati dai moduli operativi." role={role} hideHeader>
      <OrderManager initialOrders={orders as any} canManage={canManageOrders} />
    </AppShell>
  );
}
