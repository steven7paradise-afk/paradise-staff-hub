import { auth } from "@/lib/auth";
import { loadClientControlCowlendarHistory } from "@/lib/client-control-cowlendar-history";
import { loadClientControlShopifyHistory } from "@/lib/client-control-shopify-history";
import { requiresBuenosAiresPcCassa } from "@/lib/pc-cassa-access";
import { prisma } from "@/lib/prisma";
import { canAccess, getEffectivePermissionSet, type Role } from "@/lib/roles";
import { canAccessSalonShiftModules } from "@/lib/salon-shift-access";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return json({ error: "Accedi per consultare la scheda." }, 401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, active: true, role: true, mansione: true, location: { select: { name: true } } },
  });
  const permissions = user?.active ? await getEffectivePermissionSet(prisma, user) : undefined;
  const role = user?.role as Role | undefined;
  if (!user?.active || !canAccess("/client-control", role, user.mansione || undefined, permissions) ||
      !canAccess("/appointments", role, user.mansione || undefined, permissions) ||
      (role !== "DIPENDENTE" && requiresBuenosAiresPcCassa(role, user.location?.name)) ||
      !(await canAccessSalonShiftModules(user))) {
    return json({ error: "Non hai il permesso di consultare questo storico." }, 403);
  }

  const params = new URL(request.url).searchParams;
  const bookingId = params.get("booking") || "";
  const source = params.get("source");
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(bookingId) || (source !== "appointments" && source !== "payments")) {
    return json({ error: "Appuntamento o storico non valido." }, 400);
  }

  try {
    if (source === "appointments") {
      const result = await loadClientControlCowlendarHistory(bookingId);
      if (!result) return json({ status: "unlinked" });
      const { customer, total, completed, upcoming, canceled, appointments, status } = result;
      return json({ customer, total, completed, upcoming, canceled, appointments, status });
    }

    // The order is taken from the archived booking, never from a caller-supplied payment reference.
    const [booking] = await prisma.$queryRaw<{ order_id: string | null }[]>`
      SELECT payload ->> 'order_id' AS order_id FROM appointment_archive WHERE id = ${bookingId}
    `;
    return json(await loadClientControlShopifyHistory(booking?.order_id ?? null));
  } catch {
    return json({ error: "Non siamo riusciti a caricare lo storico. Riprova." }, 503);
  }
}
