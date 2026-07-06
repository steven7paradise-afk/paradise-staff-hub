import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { DownloadInvoicePdfButton } from "@/components/download-invoice-pdf-button";
import { InvoiceStatusSelector } from "@/components/invoice-status-selector";
import {
  CircleDollarSign,
  FileText,
  Building2,
  UserRound,
  Calendar,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ClipboardList
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

export default async function InvoicesPage(props: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
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

  // Fetch responses for "Richiesta Fattura Italiana" form template created within this month range
  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      created_at: { gte: start, lt: end },
      form: {
        name: { contains: "fattura", mode: "insensitive" },
      },
    },
    include: {
      user: { select: { id: true, name: true } },
      form: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  const invoiceCount = responses.length;
  const invoiceTotal = responses.reduce((sum, res) => {
    const val = parseFloat(String(answer(res, "invoice_amount") || "0").replace(",", "."));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <AppShell
      title="Registro Fatture"
      subtitle="Visualizzazione e download delle richieste di fattura elettronica compilate dallo staff."
      role={role}
      hideHeader
    >
      <div className="space-y-6">
        {/* Header Band Premium styling */}
        <section className="relative overflow-hidden -mx-4 rounded-none sm:mx-0 sm:rounded-[36px] bg-[#050608] pt-12 pb-5 px-5 text-white shadow-2xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,116,144,0.36),transparent_32%),radial-gradient(circle_at_70%_20%,rgba(94,116,255,0.25),transparent_30%),linear-gradient(135deg,#050608,#0f172a_62%,#0f172a)]" />
          <div className="absolute -left-24 top-8 size-80 rounded-full border border-white/10" />
          <div className="absolute -left-12 top-16 size-64 rounded-full border border-white/10" />
          
          <div className="relative flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-400">
                <FileText className="size-4 text-cyan-300" />
                Fatturazione Elettronica
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Registro Richieste Fatture
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
                Elenco completo e strumenti di esportazione per le richieste di fatture italiane emesse dal personale nei saloni.
              </p>
              
              {/* Month Selector */}
              <div className="mt-6 flex items-center gap-2">
                <Link
                  href={`/invoices?month=${monthKey(prevMonth)}`}
                  className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
                >
                  <ChevronLeft className="size-4" />
                </Link>
                <span className="rounded-2xl bg-white px-4 py-2 text-xs font-black capitalize text-black min-w-[120px] text-center shadow-md">
                  {monthLabel}
                </span>
                <Link
                  href={`/invoices?month=${monthKey(nextMonth)}`}
                  className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/10 to-cyan-500/2 text-cyan-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Importo totale</span>
                  <CircleDollarSign className="size-4 opacity-80" />
                </div>
                <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                  {formatMoney(invoiceTotal)}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-blue-500/10 to-blue-500/2 text-blue-200 p-5 flex flex-col justify-between transition hover:scale-[1.02] duration-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">Totale richieste</span>
                  <ClipboardList className="size-4 opacity-80" />
                </div>
                <p className="mt-3 text-2xl font-black text-white tracking-tight leading-none">
                  {invoiceCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Invoices List Table */}
        <Card className="-mx-4 rounded-none sm:mx-0 sm:rounded-[24px] overflow-hidden bg-white p-0 shadow-xl border border-black/5 dark:bg-[#121212] dark:border-white/5">
          <div className="flex flex-col gap-3 border-b border-black/5 dark:border-white/5 p-5 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#121212]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0e7490] dark:text-cyan-400">Richieste registrate</p>
              <h2 className="mt-1 text-2xl font-black text-black dark:text-white">Dettaglio mensile</h2>
              <p className="mt-1 text-sm text-black/45 dark:text-white/45">Firme, anagrafiche e metodi di pagamento.</p>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[#FAF7F9] dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.14em] text-black/45 dark:text-white/45 border-b border-black/5 dark:border-white/5">
                <tr>
                  <th className="px-5 py-4">Data Compilazione</th>
                  <th className="px-5 py-4">Sede / Operatore</th>
                  <th className="px-5 py-4">Cliente</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Codice Fiscale / P.IVA</th>
                  <th className="px-5 py-4">PEC / Codice SDI</th>
                  <th className="px-5 py-4 text-right">Importo</th>
                  <th className="px-5 py-4">Pagamento</th>
                  <th className="px-5 py-4 text-center">Stato</th>
                  <th className="px-5 py-4 text-center">Esporta</th>
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

                  const clientType = answer(res, "invoice_client_type") || "";
                  const clientName = answer(res, "invoice_client_name") || "-";
                  const fiscalCode = answer(res, "invoice_fiscal_code") || "-";
                  const vatNumber = answer(res, "invoice_vat_number") || "-";
                  const sdiCode = answer(res, "invoice_sdi_code") || "-";
                  const pec = answer(res, "invoice_pec") || "-";
                  const amount = parseFloat(String(answer(res, "invoice_amount") || "0").replace(",", "."));
                  const paymentMethod = answer(res, "invoice_payment_method") || "-";

                  const isCompany = clientType.includes("Azienda");

                  return (
                    <tr key={res.id} className="align-middle hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-4 font-bold text-black dark:text-white">{dateStr}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold flex items-center gap-1 text-black dark:text-white">
                            <Building2 className="size-3 text-cyan-600 dark:text-cyan-400" />
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
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isCompany 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {isCompany ? "Azienda" : "Privato"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-black dark:text-white">
                        {isCompany ? vatNumber : fiscalCode.toUpperCase()}
                      </td>
                      <td className="px-5 py-4 text-xs text-black/60 dark:text-white/60">
                        {isCompany ? (
                          <div className="flex flex-col gap-0.5">
                            <span>SDI: <strong className="font-mono text-black dark:text-white">{sdiCode.toUpperCase()}</strong></span>
                            {pec !== "-" && <span className="truncate max-w-[150px]">PEC: {pec}</span>}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-[#0e7490] dark:text-cyan-400">
                        {formatMoney(isNaN(amount) ? 0 : amount)}
                      </td>
                      <td className="px-5 py-4 text-xs text-black/60 dark:text-white/60">{paymentMethod}</td>
                      <td className="px-5 py-4 text-center">
                        <InvoiceStatusSelector responseId={res.id} initialStatus={res.status} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <DownloadInvoicePdfButton invoice={res as any} />
                      </td>
                    </tr>
                  );
                })}

                {responses.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center text-sm font-semibold text-black/40 dark:text-white/30">
                      Nessuna richiesta di fattura registrata nel mese selezionato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile List View (lg:hidden) */}
          <div className="lg:hidden p-4 space-y-4 divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-[#121212]">
            {responses.map((res, idx) => {
              const dateStr = new Date(res.created_at).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Rome"
              });

              const clientType = answer(res, "invoice_client_type") || "";
              const clientName = answer(res, "invoice_client_name") || "-";
              const fiscalCode = answer(res, "invoice_fiscal_code") || "-";
              const vatNumber = answer(res, "invoice_vat_number") || "-";
              const sdiCode = answer(res, "invoice_sdi_code") || "-";
              const pec = answer(res, "invoice_pec") || "-";
              const amount = parseFloat(String(answer(res, "invoice_amount") || "0").replace(",", "."));
              const paymentMethod = answer(res, "invoice_payment_method") || "-";

              const isCompany = clientType.includes("Azienda");

              return (
                <div key={res.id} className={`pt-4 ${idx === 0 ? "pt-0" : ""}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-black/40 dark:text-white/45">{dateStr}</p>
                      <h3 className="text-base font-black text-black dark:text-white mt-0.5">{clientName}</h3>
                      <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">{res.user_location_name || "Sede non indicata"}</p>
                    </div>
                    <span className="text-sm font-black text-[#0e7490] dark:text-cyan-400">
                      {formatMoney(isNaN(amount) ? 0 : amount)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-black/60 dark:text-white/60">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-black/35">Tipo</span>
                      <span className="font-semibold text-black dark:text-white">{isCompany ? "Azienda" : "Privato"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-black/35">{isCompany ? "P.IVA" : "Codice Fiscale"}</span>
                      <span className="font-mono text-black dark:text-white">{isCompany ? vatNumber : fiscalCode.toUpperCase()}</span>
                    </div>
                    {isCompany && (
                      <>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-black/35">Codice SDI</span>
                          <span className="font-mono text-black dark:text-white">{sdiCode.toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-black/35">PEC</span>
                          <span className="truncate block max-w-[120px] text-black dark:text-white">{pec}</span>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-black/35">Pagamento</span>
                      <span className="text-black dark:text-white">{paymentMethod}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-black/35">Stato</span>
                      <InvoiceStatusSelector responseId={res.id} initialStatus={res.status} />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-black/35">Operatore</span>
                      <span className="text-black dark:text-white">{res.user?.name || "-"}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <DownloadInvoicePdfButton invoice={res as any} />
                  </div>
                </div>
              );
            })}

            {responses.length === 0 && (
              <div className="py-12 text-center text-sm font-semibold text-black/40 dark:text-white/30">
                Nessuna richiesta di fattura registrata nel mese selezionato.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
