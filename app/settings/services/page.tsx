import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SalonServicePages } from "@/components/salon-service-pages";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ServiceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  if (role !== "SUPER_ADMIN") redirect("/dashboard");

  const [locations, serviceSettings] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany({ where: { key: { startsWith: "service_page:" } } }),
  ]);

  return (
    <AppShell title="Pagine salone" subtitle="Scegli quale pagina operativa vede ogni salone al posto del tasto nel menu dipendente." role={role}>
      <SalonServicePages
        role={role}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        currentLocationId={locations[0]?.id ?? null}
        initialSettings={serviceSettings.map((setting) => {
          let page = 1;
          let customName = "";
          let customIcon = "";
          if (setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)) {
            const valObj = setting.value as any;
            page = Number(valObj.page) || 1;
            customName = String(valObj.customName || "");
            customIcon = String(valObj.customIcon || "");
          } else {
            page = Number(setting.value) || 1;
          }
          return {
            locationId: setting.key.replace("service_page:", ""),
            page,
            customName,
            customIcon,
          };
        })}
      />
    </AppShell>
  );
}
