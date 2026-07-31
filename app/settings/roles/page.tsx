import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANSIONI_PERMISSIONS_SETTING_KEY, ROLE_PERMISSIONS_SETTING_KEY, canAccessForUser, normalizeMansionePermissions, normalizeRolePermissions, type Role } from "@/lib/roles";
import { RolesSettingsClient } from "./roles-settings-client";

export const dynamic = "force-dynamic";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/settings/roles", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const [users, roleSetting, mansioneSetting] = await Promise.all([
    prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mansione: true,
      photo_url: true,
      location: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: MANSIONI_PERMISSIONS_SETTING_KEY } }).catch(() => null),
  ]);

  return (
    <AppShell
      title="Gestione Ruoli & Permessi"
      subtitle="Matrice permessi di sistema e pannello di controllo dei ruoli dello staff."
      role={role}
      hideHeader
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden -mx-4 rounded-none sm:mx-0 sm:rounded-[36px] bg-[#050608] pt-12 pb-6 px-5 text-white shadow-2xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,116,144,0.36),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(94,116,255,0.25),transparent_30%),linear-gradient(135deg,#050608,#0f172a_62%,#0f172a)]" />
          <div className="absolute -left-24 top-8 size-80 rounded-full border border-white/10" />
          <div className="absolute -left-12 top-16 size-64 rounded-full border border-white/10" />
          
          <div className="relative flex flex-col gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-400">
                Pannello Sicurezza
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Ruoli & Accessi
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
                Visualizza la configurazione delle rotte di sistema e gestisci in tempo reale i ruoli, le mansioni e i saloni del personale Paradise.
              </p>
            </div>
          </div>
        </section>

        <RolesSettingsClient 
          users={users as any} 
          currentUser={session.user as any} 
          initialRolePermissions={normalizeRolePermissions(roleSetting?.value)}
          initialMansionePermissions={normalizeMansionePermissions(mansioneSetting?.value)}
        />
      </div>
    </AppShell>
  );
}
