import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResultBonusClient } from "@/components/result-bonus-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { canAccessForUser, type Role } from "@/lib/roles";
import { buildResultBonusData, mayConfigureResultBonus } from "@/lib/result-bonus-data";
import { validResultBonusMonth } from "@/lib/result-bonus";

export const dynamic = "force-dynamic";

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
}

export default async function PremioRisultatoPage({ searchParams }: { searchParams: Promise<{ staff?: string; month?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, mansione: true, active: true, sede_id: true, access_list: true, location: { select: { name: true } } },
  });
  if (!currentUser?.active) redirect("/login");
  if (!(await canAccessForUser(prisma, "/premio-risultato", currentUser))) redirect("/dashboard");
  if (!mayConfigureResultBonus(currentUser)) redirect("/dashboard");

  const params = await searchParams;
  let month = params.month || currentMonth();
  try { month = validResultBonusMonth(month); } catch { month = currentMonth(); }
  const data = await buildResultBonusData(currentUser, month);
  const resolvedData = { ...data, people: data.people.map((person) => ({ ...person, photoUrl: resolveDrivePhotoUrl(person.photoUrl) })) };

  return <AppShell title="Premio di risultato" subtitle="Conto mensile e giornate conformi" role={currentUser.role as Role} hideHeader transparentMobileHeader edgeToEdgeMain>
    <ResultBonusClient key={`${data.month}:${data.revision}`} initialData={resolvedData} initialStaffId={params.staff} />
  </AppShell>;
}
