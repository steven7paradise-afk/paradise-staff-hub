import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderManager } from "@/components/order-manager";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { requiresBuenosAiresPcCassa } from "@/lib/pc-cassa-access";
import { ensureOrderForm, ORDER_FORM_CATEGORY } from "@/lib/order-form";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { resolveRemoteControllerWorker } from "@/lib/remote-controller-user";

export const dynamic = "force-dynamic";

function isSartaOrder(response: any) {
  const answers = (response.answers as Record<string, any>) || {};
  const fields = (response.form?.fields as any[]) || [];

  // Find the field "Cosa dobbiamo fare?"
  const cosaDobbiamoFareField = fields.find(f => 
    f.label?.toLowerCase().includes("cosa dobbiamo fare")
  );
  
  // Find the field "Quante Fasce ?"
  const quanteFasceField = fields.find(f => 
    f.label?.toLowerCase().includes("quante fasce")
  );

  const cosaValue = cosaDobbiamoFareField ? answers[cosaDobbiamoFareField.id] : null;
  const fasceValue = quanteFasceField ? answers[quanteFasceField.id] : null;

  const directCosaValue = answers["field_1782212873121"];
  const directFasceValue = answers["field_1782219581986"];

  const matchesCosa = 
    (cosaValue && (cosaValue.toLowerCase().includes("conversione") || cosaValue.toLowerCase().includes("conver"))) ||
    (directCosaValue && (directCosaValue.toLowerCase().includes("conversione") || directCosaValue.toLowerCase().includes("conver")));

  const matchesFasce = 
    (fasceValue && fasceValue.toLowerCase().includes("personalizzato")) ||
    (directFasceValue && directFasceValue.toLowerCase().includes("personalizzato"));

  return Boolean(matchesCosa || matchesFasce);
}

export default async function OrdersPage(props: { searchParams: Promise<{ remoteTarget?: string }> }) {
  const searchParams = await props.searchParams;
  const remoteTarget = typeof searchParams.remoteTarget === "string" ? searchParams.remoteTarget.trim() : "";
  const session = await auth();
  const cookieStore = await cookies();
  const pcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
  const selectedWorkerId = cookieStore.get(appointmentsPcWorkerCookieName)?.value || "";
  const isAdminRemoteController = Boolean(
    !pcAuth &&
    remoteTarget &&
    session?.user?.id &&
    ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  const remoteWorker = isAdminRemoteController
    ? await resolveRemoteControllerWorker(session!.user.id, remoteTarget)
    : null;
  const isPC = Boolean(pcAuth || remoteWorker);
  if (!session?.user?.id && !pcAuth) redirect("/login");

  const role = (isPC ? "RESPONSABILE" : session!.user.role) as Role;
  const canManageOrders =
    isPC || ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role);

  const [dbUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: remoteWorker?.id || (isPC ? (selectedWorkerId || "PC_CASSA") : session!.user.id) },
      select: { mansione: true, role: true, location: { select: { name: true } } },
    }),
    ensureOrderForm(isPC ? "u-super-admin" : session!.user.id),
  ]);

  if (!isPC && dbUser && requiresBuenosAiresPcCassa(dbUser.role, dbUser.location?.name)) {
    redirect("/pc-non-autorizzato");
  }

  const isSarta =
    dbUser?.mansione?.trim().toLowerCase() === "sarta";

  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      status: { not: "ARCHIVED" },
      form: {
        is: {
          OR: [
            { category: { equals: ORDER_FORM_CATEGORY, mode: "insensitive" } },
            { name: { contains: "ordine", mode: "insensitive" } },
          ],
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true, photo_url: true, sede_id: true } },
      form: true,
    },
    orderBy: { created_at: "desc" },
    take: 300,
  });

  const allOrders = responses
    .map((response) => ({
      ...response,
      created_at: response.created_at.toISOString(),
      updated_at: response.updated_at.toISOString(),
    }));

  const operationalLocationId = pcAuth?.locationId || remoteWorker?.sede_id || "";
  const orders = isPC && operationalLocationId
    ? allOrders.filter((order) => order.user?.sede_id === operationalLocationId)
    : allOrders;

  return (
    <AppShell
      title="Ordini"
      subtitle="Pipeline ordini creati dai moduli operativi."
      role={role}
      hideHeader
      pcMode={isPC}
      remoteController={isAdminRemoteController}
      pcDisplayUser={remoteWorker ? { name: remoteWorker.name, photo_url: remoteWorker.photo_url } : null}
      pcProfileChooserHrefOverride={isAdminRemoteController ? `/appointments/buenos-aires?choose=1&remoteTarget=${encodeURIComponent(remoteTarget)}` : undefined}
    >
      <OrderManager
        initialOrders={orders as any}
        canManage={canManageOrders}
        currentUserName={remoteWorker?.name || (isPC ? "PC Cassa" : session?.user?.name ?? "Staff")}
        currentUserRole={role}
      />
    </AppShell>
  );
}
