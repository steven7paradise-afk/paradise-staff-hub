import { AppShell } from "@/components/app-shell";
import { RecruitmentManager } from "@/components/recruitment-manager";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const [session, candidates, locations, managers] = await Promise.all([
    auth(),
    prisma.candidate.findMany({
      orderBy: { created_at: "desc" },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] },
        active: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell title="Talent System" subtitle="Gestione candidature, fasi di selezione e assunzione dello staff.">
      <RecruitmentManager
        initialCandidates={candidates}
        locations={locations.map((loc) => ({ id: loc.id, name: loc.name }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        userRole={session?.user?.role ?? "DIPENDENTE"}
      />
    </AppShell>
  );
}
