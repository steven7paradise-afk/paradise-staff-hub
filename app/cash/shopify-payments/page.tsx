import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Coins,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { canAccessForUser, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getShopifyPaymentRegister } from "@/lib/shopify-payment-register";
import { PaymentControlButton } from "./payment-control-button";

export const dynamic = "force-dynamic";

function monthRange(value?: string) {
  const parsed = value && /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T00:00:00`) : new Date();
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
  return { start, end };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function romeDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function methodLabel(method: string) {
  if (method === "CASHMATIC") return "Cashmatic";
  if (method === "CONTANTI") return "Contanti";
  if (method === "CARTA") return "Carta";
  return "Da verificare";
}

function gatewayLabel(gateway: string) {
  const value = gateway.trim();
  if (!value) return "Gateway non rilevato";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ShopifyPaymentsPage(props: {
  searchParams: Promise<{ month?: string; date?: string; q?: string; method?: string; status?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  const canAccess = accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : role !== "DIPENDENTE";
  if (!canAccess) redirect("/dashboard");

  const { start, end } = monthRange(searchParams.month);
  const selectedMonth = monthKey(start);
  const previousMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const query = String(searchParams.q || "").trim().toLowerCase();
  const dateFilter = /^\d{4}-\d{2}-\d{2}$/.test(String(searchParams.date || ""))
    ? String(searchParams.date)
    : "";
  const method = ["CARTA", "CONTANTI", "DA_VERIFICARE"].includes(String(searchParams.method))
    ? String(searchParams.method)
    : "TUTTI";
  const status = searchParams.status === "DA_CONTROLLARE" ? "DA_CONTROLLARE" : "VERIFICATI";

  const rows = await getShopifyPaymentRegister({ start, end });
  const verifiedCashTotal = rows
    .filter((payment) => payment.verified && payment.method === "CONTANTI")
    .reduce((total, payment) => total + payment.amount, 0);
  const todayKey = dateFilter || romeDateKey(new Date());
  const todayVerifiedRows = rows.filter((payment) => payment.verified && romeDateKey(payment.createdAt) === todayKey);
  const todayCashTotal = todayVerifiedRows
    .filter((payment) => payment.method === "CONTANTI")
    .reduce((total, payment) => total + payment.amount, 0);
  const scopedRows = dateFilter
    ? rows.filter((payment) => romeDateKey(payment.createdAt) === dateFilter)
    : rows;
  const pendingPayments = scopedRows
    .filter((payment) => payment.order && (
      !payment.verified ||
      (payment.method === "CASHMATIC" && payment.gateway.includes(","))
    ))
    .map((payment) => ({ id: payment.id, order: payment.order }));
  const verifiedCount = scopedRows.filter((payment) => payment.verified).length;
  const pendingCount = scopedRows.filter((payment) => !payment.verified).length;
  const filteredRows = scopedRows.filter((payment) => {
    const matchesStatus = status === "DA_CONTROLLARE" ? !payment.verified : payment.verified;
    const matchesMethod = method === "TUTTI"
      || (method === "DA_VERIFICARE" ? !payment.verified || payment.method === "DA_VERIFICARE" : payment.method === method);
    const searchable = `${payment.clientName} ${payment.order} ${payment.locationName || ""} ${payment.gateway}`.toLowerCase();
    return matchesStatus && matchesMethod && (!query || searchable.includes(query));
  });

  const pageSize = 40;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const requestedPage = Math.max(1, Number.parseInt(searchParams.page || "1", 10) || 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(start);
  const summaryDate = dateFilter ? new Date(`${dateFilter}T12:00:00+02:00`) : new Date();
  const todayLabel = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(summaryDate);
  const dayCardSuffix = dateFilter ? "giorno" : "oggi";
  const persistentParams = new URLSearchParams({ month: selectedMonth });
  persistentParams.set("status", status);
  if (dateFilter) persistentParams.set("date", dateFilter);
  if (query) persistentParams.set("q", query);
  if (method !== "TUTTI") persistentParams.set("method", method);
  const verifiedTabParams = new URLSearchParams({ month: selectedMonth, status: "VERIFICATI" });
  const pendingTabParams = new URLSearchParams({ month: selectedMonth, status: "DA_CONTROLLARE" });
  if (dateFilter) {
    verifiedTabParams.set("date", dateFilter);
    pendingTabParams.set("date", dateFilter);
  }
  if (query) {
    verifiedTabParams.set("q", query);
    pendingTabParams.set("q", query);
  }
  if (method !== "TUTTI") {
    verifiedTabParams.set("method", method);
    pendingTabParams.set("method", method);
  }

  return (
    <AppShell
      title="Registro pagamenti Shopify"
      subtitle="Controllo separato dei pagamenti finali rilevati dagli ordini."
      role={role}
      hideHeader
    >
      <div className="space-y-5">
        <section className="relative -mx-4 overflow-hidden bg-[#0D0C12] px-5 py-8 text-white sm:mx-0 sm:rounded-[28px] sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(167,71,88,0.34),transparent_34%),linear-gradient(135deg,#0D0C12,#15192A)]" />
          <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link href={`/cash?month=${selectedMonth}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/60 hover:text-white">
                <ArrowLeft className="size-4" />
                Torna alla cassa
              </Link>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#F0A1AF]">
                <ShieldCheck className="size-4" />
                Registro separato
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-5xl">Pagamenti Shopify</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                Qui trovi tutti i pagamenti letti dal secondo ordine finale. Nessun importo di questa pagina viene sommato alla cassa.
              </p>
            </div>
            <div className="w-full space-y-4 xl:max-w-[690px]">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F7DFA7]">{dateFilter ? "Giorno selezionato" : "Oggi"} · {todayLabel}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#F0A1AF]/40 bg-[#F0A1AF]/15 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Contanti {dayCardSuffix}</p>
                      <Coins className="size-4 text-[#F0A1AF]" />
                    </div>
                    <p className="mt-2 text-2xl font-black">{formatMoney(todayCashTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Verificati {dayCardSuffix}</p>
                      <CheckCircle2 className="size-4 text-emerald-300" />
                    </div>
                    <p className="mt-2 text-2xl font-black">{todayVerifiedRows.length}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Totale mese · {monthLabel}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Contanti mese</p>
                    <p className="mt-2 text-xl font-black">{formatMoney(verifiedCashTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Movimenti mese</p>
                    <p className="mt-2 text-xl font-black">{rows.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em]">Controllo automatico Shopify</p>
              <p className="mt-1 text-xs text-white/45">Verifica gli ordini {dateFilter ? "del giorno selezionato" : "del mese"} ancora senza metodo confermato.</p>
            </div>
            <PaymentControlButton payments={pendingPayments} />
          </div>
        </section>

        <section className="-mx-4 bg-white px-4 py-5 sm:mx-0 sm:rounded-[24px] sm:border sm:border-black/5 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/cash/shopify-payments?month=${monthKey(previousMonth)}&status=${status}`} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black hover:bg-black/5">Mese prima</Link>
            <span className="rounded-xl bg-[#F6E8EC] px-4 py-2 text-xs font-black capitalize text-[#873647]">{monthLabel}</span>
              <Link href={`/cash/shopify-payments?month=${monthKey(nextMonth)}&status=${status}`} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black hover:bg-black/5">Mese dopo</Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[420px]">
              <Link
                href={`/cash/shopify-payments?${verifiedTabParams.toString()}`}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-xs font-black transition ${status === "VERIFICATI" ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/10 bg-white text-black hover:bg-emerald-50"}`}
              >
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" /> Verificati</span>
                <span className={`rounded-full px-2 py-1 text-[10px] ${status === "VERIFICATI" ? "bg-white/20" : "bg-emerald-50 text-emerald-700"}`}>{verifiedCount}</span>
              </Link>
              <Link
                href={`/cash/shopify-payments?${pendingTabParams.toString()}`}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-xs font-black transition ${status === "DA_CONTROLLARE" ? "border-amber-500 bg-amber-500 text-black" : "border-black/10 bg-white text-black hover:bg-amber-50"}`}
              >
                <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" /> Da controllare</span>
                <span className={`rounded-full px-2 py-1 text-[10px] ${status === "DA_CONTROLLARE" ? "bg-black/10" : "bg-amber-50 text-amber-700"}`}>{pendingCount}</span>
              </Link>
            </div>
          </div>
          <form action="/cash/shopify-payments" method="get" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_220px_auto]">
            <input type="hidden" name="month" value={selectedMonth} />
            <input type="hidden" name="status" value={status} />
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-black/10 bg-[#FAF8F9] px-4 focus-within:border-[#A74758]">
              <Search className="size-4 text-black/35" />
              <input name="q" defaultValue={searchParams.q || ""} placeholder="Cerca cliente, ordine, sede..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-black/30" />
            </label>
            <label className="flex min-h-12 flex-col justify-center rounded-2xl border border-black/10 bg-[#FAF8F9] px-4 focus-within:border-[#A74758]">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-black/35">Data pagamento</span>
              <input
                type="date"
                name="date"
                defaultValue={dateFilter}
                min={`${selectedMonth}-01`}
                max={`${selectedMonth}-${String(new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()).padStart(2, "0")}`}
                className="mt-0.5 w-full bg-transparent text-sm font-bold outline-none"
              />
            </label>
            <select name="method" defaultValue={method} className="min-h-12 rounded-2xl border border-black/10 bg-[#FAF8F9] px-4 text-sm font-bold outline-none focus:border-[#A74758]">
              <option value="TUTTI">Tutti i metodi</option>
              <option value="CARTA">Carta</option>
              <option value="CONTANTI">Contanti</option>
              <option value="DA_VERIFICARE">Da verificare</option>
            </select>
            <button type="submit" className="min-h-12 rounded-2xl bg-[#111017] px-6 text-sm font-black text-white hover:bg-black">Filtra</button>
          </form>
          {dateFilter ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-[#F6E8EC] px-3 py-2 text-[#873647]">
                Giorno selezionato: {new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${dateFilter}T12:00:00+02:00`))}
              </span>
              <Link href={`/cash/shopify-payments?month=${selectedMonth}&status=${status}`} className="rounded-full border border-black/10 px-3 py-2 text-black/55 hover:bg-black/5">
                Mostra tutto il mese
              </Link>
            </div>
          ) : null}
        </section>

        <section className="-mx-4 overflow-hidden bg-white sm:mx-0 sm:rounded-[24px] sm:border sm:border-black/5">
          <div className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-5">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${status === "DA_CONTROLLARE" ? "text-amber-700" : "text-emerald-700"}`}>
                {status === "DA_CONTROLLARE" ? "Coda di controllo" : "Registro confermato"}
              </p>
              <h2 className="mt-1 text-xl font-black">{status === "DA_CONTROLLARE" ? "Pagamenti da controllare" : "Pagamenti verificati"}</h2>
            </div>
            <span className={`rounded-full px-3 py-2 text-xs font-black ${status === "DA_CONTROLLARE" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {filteredRows.length}
            </span>
          </div>
          <div className="hidden grid-cols-[110px_minmax(180px,1.4fr)_150px_150px_120px] gap-4 border-b border-black/5 bg-[#F9F5F7] px-5 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-black/40 md:grid">
            <span>Data</span>
            <span>Cliente e ordine</span>
            <span>Sede</span>
            <span>Metodo e gateway</span>
            <span className="text-right">Importo</span>
          </div>
          {visibleRows.length ? (
            <div className="divide-y divide-black/5">
              {visibleRows.map((payment) => {
                const isCashmatic = payment.method === "CASHMATIC";
                const isCash = payment.method === "CONTANTI";
                const isVerified = payment.verified && payment.method !== "DA_VERIFICARE";
                const PaymentIcon = isCashmatic ? Banknote : isCash ? Coins : CreditCard;
                return (
                  <article key={payment.id} className="grid gap-3 px-5 py-4 md:grid-cols-[110px_minmax(180px,1.4fr)_150px_150px_120px] md:items-center md:gap-4">
                    <div>
                      <p className="text-sm font-black">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(payment.createdAt)}</p>
                      <p className="mt-1 text-xs font-semibold text-black/40">{new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(payment.createdAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{payment.clientName}</p>
                      <p className="mt-1 text-xs font-bold text-black/40">Ordine {payment.order ? `#${payment.order}` : "mancante"}</p>
                      {payment.reference ? <p className="mt-1 truncate text-[10px] font-semibold text-black/30">Rif. {payment.reference}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/service-forms/responses/${payment.id.split(":")[0]}?from=cash`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#F6E8EC] px-3 text-[10px] font-black uppercase text-[#873647] transition hover:bg-[#EFD7DE]"
                        >
                          <ClipboardList className="size-3.5" /> Vedi dettagli
                        </Link>
                      </div>
                    </div>
                    <p className="truncate text-xs font-bold text-black/50">{payment.locationName || "Sede non indicata"}</p>
                    <div className="flex items-center gap-2">
                      <span className={`flex size-9 items-center justify-center rounded-xl ${isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        <PaymentIcon className="size-4" />
                      </span>
                      <div>
                        <p className="text-xs font-black">{methodLabel(payment.method)}</p>
                        <p className="mt-0.5 max-w-[150px] truncate text-[10px] font-bold text-black/45">
                          {gatewayLabel(payment.gateway)}
                        </p>
                        <p className={`mt-0.5 inline-flex items-center gap-1 text-[9px] font-black uppercase ${isVerified ? "text-emerald-700" : "text-amber-700"}`}>
                          {isVerified ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                          {isVerified ? "Verificato" : "Da verificare"}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-black md:text-right">{formatMoney(payment.amount)}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-16 text-center">
              <Search className="mx-auto size-6 text-black/20" />
              <p className="mt-3 text-sm font-black text-black/45">Nessun pagamento corrisponde ai filtri.</p>
            </div>
          )}
        </section>

        {totalPages > 1 ? (
          <nav className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black">
            {currentPage > 1 ? (
              <Link href={`/cash/shopify-payments?${persistentParams.toString()}&page=${currentPage - 1}`} className="inline-flex items-center gap-2"><ArrowLeft className="size-4" /> Precedente</Link>
            ) : <span />}
            <span className="text-black/45">Pagina {currentPage} di {totalPages}</span>
            {currentPage < totalPages ? (
              <Link href={`/cash/shopify-payments?${persistentParams.toString()}&page=${currentPage + 1}`} className="inline-flex items-center gap-2">Successiva <ArrowRight className="size-4" /></Link>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </AppShell>
  );
}
