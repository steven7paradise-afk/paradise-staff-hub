import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResultBonusSettings } from "@/components/result-bonus-settings";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { loadResultBonusState, mayConfigureResultBonus } from "@/lib/result-bonus-data";
import { defaultResultBonusRules, defaultResultBonusDailyValues, validResultBonusMonth } from "@/lib/result-bonus";

export const dynamic = "force-dynamic";

export default async function DynamicsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, role: true, active: true, access_list: true, mansione: true } });
  if (!actor?.active) redirect("/login");
  if (!mayConfigureResultBonus(actor) || !(await canAccessForUser(prisma, "/premio-risultato", actor))) redirect("/premio-risultato");
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  const params = await searchParams;
  let month = params.month ?? currentMonth;
  try { validResultBonusMonth(month); } catch { month = currentMonth; }
  const [state, people] = await Promise.all([
    loadResultBonusState(month),
    prisma.user.findMany({ where: { active: true, role: { in: ["RESPONSABILE", "DIPENDENTE"] }, location: { name: { contains: "Buenos", mode: "insensitive" } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <AppShell title="Valore delle dinamiche" role={actor.role as Role} hideHeader edgeToEdgeMain>
    <ResultBonusSettings key={`${month}:${state.revision}`} month={month} revision={state.revision} initialRules={state.rules ?? defaultResultBonusRules()} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}
      initialDailyValues={state.dailyValues ?? defaultResultBonusDailyValues()}
      people={people.map((person) => ({ ...person, configured: Boolean(state.configs[person.id]) }))}
      lastUpdate={state.ruleHistory?.at(-1) ?? null}
      awards={state.events.filter((event) => event.type === "PERSONAL_BONUS").map((event) => ({ id: event.id, name: people.find((person) => person.id === event.userId)?.name ?? "Profilo non attivo", amount: event.amount ?? 0, evidence: event.evidence, date: event.date }))} />
  </AppShell>;
}
