import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessForUser, type Role } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { RefundRowActions } from "@/components/refund-row-actions";
import {
  CircleDollarSign,
  Undo2,
  Building2,
  UserRound,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins
} from "lucide-react";

export const dynamic = "force-dynamic";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function answer(response: any, key: string) {
  return (response.answers as any)?.[key];
}

function formatMoney(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default async function RefundsPage(props: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const role = session.user.role as Role;
  const canAccessPage = accessUser
    ? await canAccessForUser(prisma, "/refunds", accessUser)
    : (role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN");

  if (!canAccessPage) {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const monthParam = searchParams.month;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const now = new Date(today);

  const currentMonthDate = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? new Date(`${monthParam}-01T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const prevMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
  const nextMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);

  const start = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
  const end = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);

  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(currentMonthDate);

  // Fetch responses for "Richiesta Rimborso" form template created within this month range
  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      created_at: { gte: start, lt: end },
      form: {
        name: { contains: "rimborso", mode: "insensitive" },
      },
    },
    include: {
      user: { select: { id: true, name: true } },
      form: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  const refundCount = responses.length;
  const refundTotal = responses.reduce((sum, res) => {
    const val = parseFloat(String(answer(res, "refund_amount") || "0").replace(",", "."));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <AppShell
      title="Gestione Rimborsi"
      subtitle="Visualizzazione, approvazione e note interne per le richieste di rimborso compilate dallo staff."
      role={role}
      hideHeader
    >
      <div className="space-y-6">
        {/* Header Premium Rose/Red Band */}
        <section className="relative overflow-hidden -mx-4 rounded-none sm:mx-0 sm:rounded-[36px] bg-[#050608] pt-12 pb-5 px-5 text-white shadow-2xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(244,63,94,0.22),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(251,146,60,0.18),transparent_30%),linear-gradient(135deg,#050608,#0f172a_62%,#0f172a)]" />
          <div className="absolute -left-24 top-8 size-80 rounded-full border border-white/10" />
          <div className="absolute -left-12 top-16 size-64 rounded-full border border-white/10" />
          
          <div className="relative flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-rose-400">
                <Undo2 className="size-4 text-rose-300" />
                Amministrazione Rimborsi
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Registro Richieste Rimborsi
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
                Pannello di controllo per visualizzare, approvare o rifiutare le richieste di rimborso clienti provenienti dai vari saloni.
              </p>
              
              {/* Month Selector */}
              <div className="mt-6 flex items-center gap-2">
                <Link
                  href={`/refunds?month=${monthKey(prevMonth)}`}
                  className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </Link>
                <span className="rounded-2xl bg-white px-4 py-2 text-xs font-black capitalize text-black min-w-[120px] text-center shadow-md">
                  {monthLabel}
                </span>
                <Link
                  href={`/refunds?month=${monthKey(nextMonth)}`}
                  className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/10 to-rose-500/2 text-rose-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Importo Rimborsato</span>
                  <Coins className="size-4 opacity-80" />
                </div>
                <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                  {formatMoney(refundTotal)}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/10 to-amber-500/2 text-amber-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Totale richieste</span>
                  <ClipboardList className="size-4 opacity-80" />
                </div>
                <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                  {refundCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Refunds List Table */}
        <Card className="-mx-4 rounded-none sm:mx-0 sm:rounded-[24px] overflow-hidden bg-white p-0 shadow-xl border border-black/5 dark:bg-[#121212] dark:border-white/5">
          <div className="flex flex-col gap-3 border-b border-black/5 dark:border-white/5 p-5 bg-white dark:bg-[#121212]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E11D48]">Gestione Pratiche</p>
              <h2 className="mt-1 text-2xl font-black text-black dark:text-white">Elenco Rimborsi</h2>
              <p className="mt-1 text-sm text-black/45 dark:text-white/45">Filtra, approva o rifiuta le richieste ed inserisci note amministrative interne.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {responses.length === 0 ? (
              <div className="p-12 text-center text-black/45 dark:text-white/45">
                Nessuna richiesta di rimborso registrata per questo mese.
              </div>
            ) : (
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-[#FAF7F9] dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45 border-b border-black/5 dark:border-white/5">
                  <tr>
                    <th className="px-5 py-4">Compilato il</th>
                    <th className="px-5 py-4">Salone / Operatore</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Ordine Shopify</th>
                    <th className="px-5 py-4">Motivazione / Note Staff</th>
                    <th className="px-5 py-4">Canale / Metodo</th>
                    <th className="px-5 py-4 text-right">Importo</th>
                    <th className="px-5 py-4">Approvazione / Note Interne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-[#121212]">
                  {responses.map((res) => {
                    const dateStr = new Date(res.created_at).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Rome"
                    });

                    const clientName = answer(res, "refund_client_name") || "-";
                    const shopifyOrder = answer(res, "refund_shopify_order") || "-";
                    const amount = parseFloat(String(answer(res, "refund_amount") || "0").replace(",", "."));
                    const method = answer(res, "refund_method") || "-";
                    const reason = answer(res, "refund_reason") || "-";
                    const notes = answer(res, "refund_notes") || "";

                    return (
                      <tr key={res.id} className="align-top hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-5 py-4 font-bold text-black dark:text-white white-space-nowrap">{dateStr}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold flex items-center gap-1 text-black dark:text-white">
                              <Building2 className="size-3 text-rose-600 dark:text-rose-400" />
                              {res.user_location_name || "Sede non indicata"}
                            </span>
                            <span className="text-xs text-black/45 dark:text-white/45 flex items-center gap-1">
                              <UserRound className="size-3" />
                              {res.user?.name || "Operatore sconosciuto"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-black text-black dark:text-white">{clientName}</td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-black/60 dark:text-white/60">
                            {shopifyOrder}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-[300px]">
                          <div className="flex flex-col gap-1.5">
                            <p className="text-xs font-bold text-black dark:text-white leading-relaxed break-words">{reason}</p>
                            {notes && (
                              <p className="text-[11px] text-black/45 dark:text-white/45 italic leading-relaxed border-l-2 border-rose-500/30 pl-2">
                                Note Staff: {notes}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-black/60 dark:text-white/60">{method}</td>
                        <td className="px-5 py-4 text-right font-black text-[#E11D48]">
                          {formatMoney(isNaN(amount) ? 0 : amount)}
                        </td>
                        <td className="px-5 py-4">
                          <RefundRowActions
                            responseId={res.id}
                            initialStatus={res.status}
                            initialNotes={res.internal_notes}
                            refund={{
                              id: res.id,
                              created_at: res.created_at.toISOString(),
                              user_location_name: res.user_location_name,
                              user: res.user,
                              status: res.status,
                              internal_notes: res.internal_notes,
                              answers: res.answers
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
