import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Search,
  ShieldCheck,
  SquareArrowOutUpRight,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { canAccessForUser, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getShopifyDailyRevenue, getShopifyOrderClientNames, getShopifyPaymentRegister, shopifyOrderMatchKeys } from "@/lib/shopify-payment-register";
import { ShopifyPaymentsLiveRefresh } from "./live-refresh";

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

function gatewayLabel(gateway: string) {
  const value = gateway.trim();
  if (!value) return "Gateway non rilevato";
  if (/cashmatic|selfpay|inpay/i.test(value)) return "Contanti";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanOrderCode(value: string) {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function providerLabel(provider: string) {
  return ({
    SHOPIFY_PAYMENTS: "Shopify Payments",
    SCALAPAY: "Scalapay",
    KLARNA: "Klarna",
    SATISPAY: "Satispay",
    PAYPAL: "PayPal",
    CONTANTI: "Contanti",
    CASHMATIC: "Contanti",
    CARTA: "Altra carta / POS",
    ALTRO: "Altro / da classificare",
  } as Record<string, string>)[provider] || provider;
}

function shopifyAdminOrderUrl(orderId: string) {
  const numericId = orderId.match(/(\d+)$/)?.[1] || orderId;
  return `https://admin.shopify.com/store/c1uzax-u0/orders/${encodeURIComponent(numericId)}`;
}

export default async function ShopifyPaymentsPage(props: {
  searchParams: Promise<{ month?: string; date?: string; q?: string; method?: string; provider?: string; status?: string; page?: string; review?: string }>;
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
  const requestedProvider = searchParams.provider === "CASHMATIC" ? "CONTANTI" : String(searchParams.provider);
  const provider = ["SHOPIFY_PAYMENTS", "SCALAPAY", "KLARNA", "SATISPAY", "PAYPAL", "CONTANTI", "CARTA", "ALTRO"].includes(requestedProvider)
    ? requestedProvider
    : "TUTTI";
  const status = searchParams.status === "DA_CONTROLLARE" ? "DA_CONTROLLARE" : searchParams.status === "VERIFICATI" ? "VERIFICATI" : "TUTTI";

  const rows = await getShopifyPaymentRegister({ start, end });
  const verifiedRevenueTotal = rows
    .filter((payment) => payment.verified)
    .reduce((total, payment) => total + payment.amount, 0);
  const verifiedCashTotal = rows
    .filter((payment) => payment.verified && payment.method === "CONTANTI")
    .reduce((total, payment) => total + payment.amount, 0);
  const todayKey = dateFilter || romeDateKey(new Date());
  const liveDailyRevenue = await getShopifyDailyRevenue(todayKey);
  const clientPayments = Array.from(liveDailyRevenue.payments.reduce((groups, payment) => {
    const key = payment.orderId;
    const current = groups.get(key);
    groups.set(key, current
      ? {
          ...current,
          amount: current.amount + payment.amount,
          methods: [...new Set([...current.methods, payment.method])],
          providers: [...new Set([...current.providers, payment.provider])],
          gateways: [...new Set([...current.gateways, payment.gateway].filter(Boolean))],
        }
      : {
          orderId: payment.orderId,
          orderName: payment.orderName,
          clientName: payment.clientName,
          amount: payment.amount,
          methods: [payment.method],
          providers: [payment.provider],
          gateways: payment.gateway ? [payment.gateway] : [],
          processedAt: payment.processedAt,
        });
    return groups;
  }, new Map<string, {
    orderId: string;
    orderName: string;
    clientName: string;
    amount: number;
    methods: string[];
    providers: string[];
    gateways: string[];
    processedAt: string;
  }>()).values());
  const shopifyClientNames = clientPayments.length
    ? await getShopifyOrderClientNames(clientPayments.map((payment) => payment.orderId))
    : new Map<string, string>();
  const controlsByOrder = new Map<string, typeof rows>();
  for (const control of rows) {
    for (const key of shopifyOrderMatchKeys(control.order)) {
      controlsByOrder.set(key, [...(controlsByOrder.get(key) || []), control]);
    }
  }
  const reconciledRows = clientPayments.map((payment) => {
    const controls = shopifyOrderMatchKeys(payment.orderName)
      .flatMap((key) => controlsByOrder.get(key) || [])
      .filter((control, index, list) => list.findIndex((item) => item.id === control.id) === index);
    const control = controls[0] || null;
    const declaredAmount = control ? control.declaredAmount : 0;
    const amountMatches = Boolean(control) && Math.abs(declaredAmount - payment.amount) < 0.01;
    const state = !control
      ? "AUTOMATIC"
      : amountMatches
        ? "CONFIRMED"
        : "MISMATCH";
    return {
      ...payment,
      clientName: control?.clientName
        || shopifyClientNames.get(payment.orderId.match(/(\d+)$/)?.[1] || "")
        || shopifyClientNames.get(cleanOrderCode(payment.orderName))
        || payment.clientName,
      control,
      declaredAmount,
      amountMatches,
      state,
    };
  });
  const providerCounts = liveDailyRevenue.payments.reduce((counts, payment) => counts.set(payment.provider, (counts.get(payment.provider) || 0) + 1), new Map<string, number>());
  const visibleReconciledRows = reconciledRows.filter((payment) => {
    const matchesStatus = status === "TUTTI" || (status === "DA_CONTROLLARE" ? payment.state === "MISMATCH" : payment.state !== "MISMATCH");
    const matchesProvider = provider === "TUTTI" || payment.providers.includes(provider);
    const matchesMethod = method === "TUTTI" || payment.methods.includes(method);
    const searchable = `${payment.clientName} ${payment.orderName} ${payment.control?.clientName || ""}`.toLowerCase();
    return matchesStatus && matchesProvider && matchesMethod && (!query || searchable.includes(query));
  });
  const todayVerifiedRows = rows.filter((payment) => payment.verified && romeDateKey(payment.createdAt) === todayKey);
  const todayRevenueTotal = todayVerifiedRows.reduce((total, payment) => total + payment.amount, 0);
  const todayCardTotal = todayVerifiedRows
    .filter((payment) => payment.method === "CARTA")
    .reduce((total, payment) => total + payment.amount, 0);
  const todayCashTotal = todayVerifiedRows
    .filter((payment) => payment.method === "CONTANTI")
    .reduce((total, payment) => total + payment.amount, 0);
  const verifiedCount = reconciledRows.filter((payment) => payment.state !== "MISMATCH").length;
  const pendingCount = reconciledRows.filter((payment) => payment.state === "MISMATCH").length;
  const uniqueDeclaredTotal = (source: typeof rows) => Array.from(
    // The same Shopify order can have repeated or split control records. It
    // must contribute once to the declared total, never once per response.
    new Map(source.map((payment) => [cleanOrderCode(payment.order) || payment.responseId, payment])).values(),
  ).reduce((total, payment) => total + payment.declaredAmount, 0);
  const declaredDayTotal = uniqueDeclaredTotal(rows.filter((payment) => romeDateKey(payment.createdAt) === todayKey));
  const declaredMonthTotal = uniqueDeclaredTotal(rows);
  const workerControlCount = reconciledRows.filter((payment) => Boolean(payment.control)).length;
  const dailyIssues = reconciledRows.filter((payment) => payment.state === "MISMATCH");

  const pageSize = 40;
  const totalPages = Math.max(1, Math.ceil(visibleReconciledRows.length / pageSize));
  const requestedPage = Math.max(1, Number.parseInt(searchParams.page || "1", 10) || 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleRows = visibleReconciledRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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
  if (provider !== "TUTTI") persistentParams.set("provider", provider);
  const verifiedTabParams = new URLSearchParams({ month: selectedMonth, status: "VERIFICATI" });
  const pendingTabParams = new URLSearchParams({ month: selectedMonth, status: "DA_CONTROLLARE" });
  const allTabParams = new URLSearchParams({ month: selectedMonth, status: "TUTTI" });
  if (dateFilter) {
    verifiedTabParams.set("date", dateFilter);
    pendingTabParams.set("date", dateFilter);
    allTabParams.set("date", dateFilter);
  }
  if (query) {
    verifiedTabParams.set("q", query);
    pendingTabParams.set("q", query);
    allTabParams.set("q", query);
  }
  if (method !== "TUTTI") {
    verifiedTabParams.set("method", method);
    pendingTabParams.set("method", method);
    allTabParams.set("method", method);
  }
  if (provider !== "TUTTI") {
    verifiedTabParams.set("provider", provider);
    pendingTabParams.set("provider", provider);
    allTabParams.set("provider", provider);
  }

  return (
    <AppShell
      title="Controllo pagamenti"
      subtitle="Controllo separato dei pagamenti finali rilevati dagli ordini."
      role={role}
      hideHeader
    >
      <ShopifyPaymentsLiveRefresh />
      <div className="shopify-payments-page space-y-5">
        <section className="relative -mx-4 overflow-hidden bg-[#0D0C12] px-5 py-8 text-white sm:mx-0 sm:rounded-[28px] sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(167,71,88,0.34),transparent_34%),linear-gradient(135deg,#0D0C12,#15192A)]" />
          <div className="relative grid gap-7">
            <div className="max-w-4xl">
              <Link href={`/cash?month=${selectedMonth}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/60 hover:text-white">
                <ArrowLeft className="size-4" />
                Torna alla cassa
              </Link>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#F0A1AF]">
                <ShieldCheck className="size-4" />
                Registro separato
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-5xl">Controllo pagamenti</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                Acquisisce automaticamente gli incassi Shopify tramite codice ordine. Quando è presente anche il Controllo Cliente, confronta la registrazione del lavoratore senza duplicare gli importi in cassa.
              </p>
            </div>
            <div className="w-full space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F7DFA7]">{dateFilter ? "Giorno selezionato" : "Oggi"} · {todayLabel}</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[#F0A1AF]/40 bg-[#F0A1AF]/15 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Ricavato Shopify {dayCardSuffix}</p>
                      <WalletCards className="size-4 text-[#F0A1AF]" />
                    </div>
                    <p className="mt-2 text-2xl font-black">{formatMoney(liveDailyRevenue.available ? liveDailyRevenue.total : todayRevenueTotal)}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/40">{liveDailyRevenue.available ? "Letto direttamente da Shopify" : "Ultimi dati Shopify verificati"}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-300/30 bg-violet-300/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Dichiarato lavoratori {dayCardSuffix}</p><ClipboardList className="size-4 text-violet-200" /></div>
                    <p className="mt-2 text-2xl font-black">{formatMoney(declaredDayTotal)}</p>
                    <p className="mt-1 text-[10px] font-bold text-emerald-300">{workerControlCount} controlli lavoratore registrati</p>
                  </div>
                  <div className="rounded-2xl border border-sky-300/30 bg-sky-300/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Carta / POS Shopify</p><CreditCard className="size-4 text-sky-300" /></div>
                    <p className="mt-2 text-2xl font-black">{formatMoney(liveDailyRevenue.available ? liveDailyRevenue.card : todayCardTotal)}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/40">Contanti {formatMoney(liveDailyRevenue.available ? liveDailyRevenue.cash : todayCashTotal)}</p>
                    {liveDailyRevenue.available && liveDailyRevenue.unclassified > 0 ? <p className="mt-1 text-[10px] font-bold text-amber-300">Da classificare {formatMoney(liveDailyRevenue.unclassified)}</p> : null}
                  </div>
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60">Movimenti Shopify {dayCardSuffix}</p>
                      <CheckCircle2 className="size-4 text-emerald-300" />
                    </div>
                    <p className="mt-2 text-2xl font-black">{liveDailyRevenue.available ? liveDailyRevenue.transactions : todayVerifiedRows.length}</p>
                  </div>
                </div>
                {dailyIssues.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                          <AlertTriangle className="size-4" /> Da controllare · {dailyIssues.length}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-white/55">Clienti e ordini che spiegano la differenza del giorno.</p>
                      </div>
                      <Link href={`/cash/shopify-payments?${pendingTabParams.toString()}`} className="rounded-xl bg-amber-300 px-3 py-2 text-[10px] font-black uppercase text-black hover:bg-amber-200">
                        Vedi tutti
                      </Link>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {dailyIssues.slice(0, 6).map((payment) => {
                        const issueLabel = "Importo diverso";
                        return (
                          <a
                            key={payment.orderId}
                            href={shopifyAdminOrderUrl(payment.orderId)}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-xl border p-3 transition hover:-translate-y-0.5 ${!payment.amountMatches ? "border-rose-300/30 bg-rose-300/10" : "border-sky-300/30 bg-sky-300/10"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black">{payment.clientName}</p>
                                <p className="mt-1 text-[10px] font-bold text-white/45">Ordine {payment.orderName.startsWith("#") ? payment.orderName : `#${payment.orderName}`}</p>
                              </div>
                              <SquareArrowOutUpRight className="size-3.5 shrink-0 text-white/45" />
                            </div>
                            <div className="mt-2 flex items-end justify-between gap-3">
                              <p className="text-sm font-black">Shopify {formatMoney(payment.amount)}</p>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${!payment.amountMatches ? "bg-rose-300 text-rose-950" : "bg-sky-300 text-sky-950"}`}>{issueLabel}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-white/50">Dichiarato {formatMoney(payment.declaredAmount)}</p>
                          </a>
                        );
                      })}
                    </div>
                    {dailyIssues.length > 6 ? <p className="mt-3 text-[10px] font-bold text-white/45">Altri {dailyIssues.length - 6} ordini da controllare nell’elenco completo.</p> : null}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-xs font-black text-emerald-200">
                    <CheckCircle2 className="size-4" /> Pagamenti acquisiti automaticamente. I controlli lavoratore presenti coincidono.
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Totale mese · {monthLabel}</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Ricavato Shopify mese</p>
                    <p className="mt-2 text-xl font-black">{formatMoney(verifiedRevenueTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Dichiarato lavoratori mese</p>
                    <p className="mt-2 text-xl font-black">{formatMoney(declaredMonthTotal)}</p>
                  </div>
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
              <p className="mt-1 text-xs text-white/45">I pagamenti con codice ordine vengono acquisiti direttamente da Shopify, senza attese.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 text-xs font-black uppercase tracking-[0.12em] text-emerald-200">
                <ShieldCheck className="size-4" /> Controllo automatico attivo
              </span>
            </div>
          </div>
        </section>

        <section className="shopify-payments-solid -mx-4 bg-white px-4 py-5 sm:mx-0 sm:rounded-b-none sm:rounded-t-[24px] sm:border sm:border-b-0 sm:border-black/5 sm:px-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-black/5 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A74758]">Incassi confermati da Shopify</p>
              <h2 className="mt-1 text-xl font-black">Entrate e controllo per singolo cliente</h2>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-black/45">Ogni importo usa la transazione Shopify effettiva. Nello stesso registro trovi il cliente, l’ordine, il metodo, il Controllo Cliente e le eventuali differenze.</p>
            </div>
            <div className="rounded-2xl bg-[#111017] px-4 py-3 text-white">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">{clientPayments.length} clienti / ordini</p>
              <p className="mt-1 text-xl font-black">{formatMoney(liveDailyRevenue.available ? liveDailyRevenue.total : todayRevenueTotal)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/cash/shopify-payments?month=${monthKey(previousMonth)}&status=${status}`} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black hover:bg-black/5">Mese prima</Link>
            <span className="rounded-xl bg-[#F6E8EC] px-4 py-2 text-xs font-black capitalize text-[#873647]">{monthLabel}</span>
              <Link href={`/cash/shopify-payments?month=${monthKey(nextMonth)}&status=${status}`} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black hover:bg-black/5">Mese dopo</Link>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[620px]">
              <Link href={`/cash/shopify-payments?${allTabParams.toString()}`} className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-xs font-black transition ${status === "TUTTI" ? "border-[#111017] bg-[#111017] text-white" : "border-black/10 bg-white text-black hover:bg-black/[0.04]"}`}><span className="inline-flex items-center gap-2"><ClipboardList className="size-4" /> Tutti</span><span className={`rounded-full px-2 py-1 text-[10px] ${status === "TUTTI" ? "bg-white/20" : "bg-black/[0.04]"}`}>{reconciledRows.length}</span></Link>
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
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {["TUTTI", "SHOPIFY_PAYMENTS", "CONTANTI", "SCALAPAY", "KLARNA", "SATISPAY", "PAYPAL", "CARTA", "ALTRO"].map((item) => {
              const params = new URLSearchParams({ month: selectedMonth, status });
              if (dateFilter) params.set("date", dateFilter);
              if (query) params.set("q", query);
              if (method !== "TUTTI") params.set("method", method);
              if (item !== "TUTTI") params.set("provider", item);
              return <Link key={item} href={`/cash/shopify-payments?${params.toString()}`} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${provider === item ? "border-[#111017] bg-[#111017] text-white" : "border-black/10 bg-white text-black/60 hover:bg-black/[0.04]"}`}>{item === "TUTTI" ? "Tutti i metodi" : providerLabel(item)}<span className={`rounded-full px-2 py-0.5 text-[10px] ${provider === item ? "bg-white/15" : "bg-black/[0.04]"}`}>{item === "TUTTI" ? liveDailyRevenue.transactions : providerCounts.get(item) || 0}</span></Link>;
            })}
          </div>
          <form action="/cash/shopify-payments" method="get" className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_220px_220px_auto]">
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
            <select name="provider" defaultValue={provider} className="min-h-12 rounded-2xl border border-black/10 bg-[#FAF8F9] px-4 text-sm font-bold outline-none focus:border-[#A74758]">
              <option value="TUTTI">Tutti i gateway</option><option value="SHOPIFY_PAYMENTS">Shopify Payments</option><option value="CONTANTI">Contanti</option><option value="SCALAPAY">Scalapay</option><option value="KLARNA">Klarna</option><option value="SATISPAY">Satispay</option><option value="PAYPAL">PayPal</option><option value="CARTA">Altra carta / POS</option><option value="ALTRO">Altro / da classificare</option>
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

        <section className="shopify-payments-solid !-mt-5 -mx-4 overflow-hidden bg-white sm:mx-0 sm:rounded-b-[24px] sm:border sm:border-t-0 sm:border-black/5">
          <div className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-5">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${status === "DA_CONTROLLARE" ? "text-amber-700" : "text-emerald-700"}`}>
                {status === "DA_CONTROLLARE" ? "Coda di controllo" : status === "VERIFICATI" ? "Registro confermato" : "Riconciliazione completa"}
              </p>
              <h2 className="mt-1 text-xl font-black">{status === "DA_CONTROLLARE" ? "Solo differenze reali" : status === "VERIFICATI" ? "Pagamenti verificati" : "Shopify e Controllo Cliente"}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.08em]">
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">Verde · Controllo Cliente inserito</span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">Giallo · Controllo Cliente mancante</span>
                <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">Azzurro · Pagamento in contanti</span>
              </div>
            </div>
              <span className={`rounded-full px-3 py-2 text-xs font-black ${status === "DA_CONTROLLARE" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {visibleReconciledRows.length}
            </span>
          </div>
          <div className="hidden grid-cols-[100px_minmax(180px,1.25fr)_minmax(170px,1fr)_minmax(170px,1fr)_120px] gap-4 border-b border-black/5 bg-[#F9F5F7] px-5 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-black/40 md:grid">
            <span>Data</span>
            <span>Cliente e ordine</span>
            <span>Atteso da Shopify</span>
            <span>Controllo Cliente / automatico</span>
            <span className="text-right">Esito</span>
          </div>
          {visibleRows.length ? (
            <div className="divide-y divide-black/5">
              {visibleRows.map((payment) => {
                const isConfirmed = payment.state === "CONFIRMED";
                const isAutomatic = payment.state === "AUTOMATIC";
                const hasClientControl = Boolean(payment.control);
                const isCashPayment = payment.methods.includes("CONTANTI")
                  || payment.methods.includes("CASHMATIC")
                  || payment.providers.includes("CONTANTI")
                  || payment.providers.includes("CASHMATIC")
                  || payment.gateways.some((gateway) => /cashmatic|selfpay|inpay|contanti|cash/i.test(gateway));
                return (
                  <article
                    key={payment.orderId}
                    className={`grid gap-4 border-l-4 px-5 py-5 md:grid-cols-[100px_minmax(180px,1.25fr)_minmax(170px,1fr)_minmax(170px,1fr)_150px] md:items-center md:gap-4 ${
                      hasClientControl
                        ? "border-l-emerald-400 bg-emerald-50/70"
                        : "border-l-amber-400 bg-amber-50/70"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-black">{new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short" }).format(new Date(payment.processedAt))}</p>
                      <p className="mt-1 text-xs font-semibold text-black/40">{new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(payment.processedAt))}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{payment.clientName}</p>
                      <p className="mt-1 text-xs font-bold text-black/40">Ordine {payment.orderName.startsWith("#") ? payment.orderName : `#${payment.orderName}`}</p>
                      {payment.control ? <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/service-forms/responses/${payment.control.responseId}?from=cash`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#F6E8EC] px-3 text-[10px] font-black uppercase text-[#873647] transition hover:bg-[#EFD7DE]"
                        >
                          <ClipboardList className="size-3.5" /> Vedi dettagli
                        </Link>
                      </div> : null}
                      {payment.state === "MISMATCH" ? (
                        <a
                          href={shopifyAdminOrderUrl(payment.orderId)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#A74758]/20 bg-white px-3 text-[10px] font-black uppercase text-[#873647] transition hover:bg-[#FFF2F5]"
                        >
                          <SquareArrowOutUpRight className="size-3.5" /> Apri ordine Shopify
                        </a>
                      ) : null}
                    </div>
                    <div className={`rounded-2xl border p-3 ${isCashPayment ? "border-sky-200 bg-sky-50" : "border-black/[0.04] bg-[#F7F8FA]"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-base font-black">{formatMoney(payment.amount)}</p>
                        {isCashPayment ? <span className="rounded-full bg-sky-200 px-2.5 py-1 text-[9px] font-black uppercase text-sky-900">Contanti</span> : null}
                      </div>
                      <p className="mt-1 text-xs font-black text-[#873647]">{payment.providers.map(providerLabel).join(" + ")}</p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-black/35">{payment.gateways.map(gatewayLabel).join(" · ")}</p>
                    </div>
                    <div className={`rounded-2xl border p-3 ${isAutomatic ? "border-amber-200 bg-amber-100/70" : isConfirmed ? "border-emerald-200 bg-emerald-100/70" : "border-rose-200 bg-rose-50"}`}>
                      <p className="text-sm font-black">{isAutomatic ? "Controllo Cliente mancante" : payment.control?.clientName}</p>
                      <p className="mt-1 text-xs font-black">{isAutomatic ? "—" : formatMoney(payment.declaredAmount)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-black/45">{isAutomatic ? "Pagamento presente in Shopify" : "Controllo Cliente inserito · Metodo rilevato da Shopify"}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className="inline-flex min-h-8 items-center rounded-full bg-emerald-100 px-3 text-[9px] font-black uppercase text-emerald-800">Controllo automatico</span>
                      {payment.control ? (
                        <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-[9px] font-black uppercase ${isConfirmed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{isConfirmed ? "Controllo lavoratore" : "Differenza lavoratore"}</span>
                      ) : <span className="inline-flex min-h-8 items-center rounded-full bg-amber-100 px-3 text-[9px] font-black uppercase text-amber-800">Da inserire</span>}
                      {isCashPayment ? <span className="inline-flex min-h-8 items-center rounded-full bg-sky-100 px-3 text-[9px] font-black uppercase text-sky-800">Contanti</span> : null}
                      {payment.state === "MISMATCH" ? <p className="text-[9px] font-bold leading-4 text-rose-700">Importo diverso</p> : null}
                    </div>
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
