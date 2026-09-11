"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  NotebookPen,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { ShopifyDashboardOrder, ShopifyOrderAddress, ShopifyOrderDetail, ShopifyOrdersPage } from "@/lib/shopify-orders-dashboard";
import { cn } from "@/lib/utils";

type Filter = "all" | "paid" | "pending" | "fulfilled" | "unfulfilled";

const financialLabels: Record<string, string> = {
  PAID: "Pagato",
  PENDING: "Pagamento in attesa",
  AUTHORIZED: "Autorizzato",
  PARTIALLY_PAID: "Parzialmente pagato",
  PARTIALLY_REFUNDED: "Parzialmente rimborsato",
  REFUNDED: "Rimborsato",
  VOIDED: "Annullato",
  EXPIRED: "Scaduto",
};

const fulfillmentLabels: Record<string, string> = {
  FULFILLED: "Evaso",
  UNFULFILLED: "Inevaso",
  PARTIALLY_FULFILLED: "Parzialmente evaso",
  IN_PROGRESS: "In preparazione",
  ON_HOLD: "In sospeso",
  SCHEDULED: "Programmato",
  OPEN: "Aperto",
  RESTOCKED: "Restituito",
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: currency || "EUR" }).format(value);
}

function dateLabel(value: string) {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (isToday) return `Oggi alle ${time}`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function sourceLabel(source: string) {
  const clean = source.toLowerCase();
  if (clean === "pos") return "Point of Sale";
  if (clean === "5822535") return "Cowlendar Booking";
  if (clean.includes("cow") || clean.includes("calendar")) return "Cowlendar Booking";
  if (clean === "web" || clean.includes("online_store")) return "Negozio online";
  return source.replaceAll("_", " ");
}

function addressLines(address: ShopifyOrderAddress | null) {
  if (!address) return [];
  return [address.name, address.company, address.address1, address.address2, [address.zip, address.city].filter(Boolean).join(" "), address.province, address.country, address.phone].filter(Boolean);
}

function eventText(event: ShopifyOrderDetail["events"][number]) {
  if (event.message) return event.message;
  if (event.description) return event.description;
  const labels: Record<string, string> = {
    confirmed: "Ordine confermato",
    closed: "Ordine archiviato",
    placed: "Ordine creato",
    fulfilled: "Articoli contrassegnati come evasi",
    payment_processed: "Pagamento elaborato",
    mail_sent: "Email inviata al cliente",
  };
  return labels[event.verb] || event.verb.replaceAll("_", " ") || "Aggiornamento ordine";
}

function DetailCard({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)]", className)}>
      <div className="flex items-center gap-2 border-b border-black/[0.07] px-5 py-4 text-[#202223]">{icon}<h3 className="font-bold">{title}</h3></div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusPill({ kind, value }: { kind: "financial" | "fulfillment"; value: string }) {
  const positive = kind === "financial" ? value === "PAID" : value === "FULFILLED";
  const warning = kind === "financial"
    ? ["PENDING", "AUTHORIZED", "PARTIALLY_PAID"].includes(value)
    : value !== "FULFILLED";
  const label = kind === "financial"
    ? financialLabels[value] || value
    : fulfillmentLabels[value] || value;

  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none",
      positive && "bg-[#e3f1e7] text-[#315c3e]",
      warning && "bg-[#fff0c7] text-[#7a5513]",
      !positive && !warning && "bg-[#ececef] text-[#56565b]",
    )}>
      <span className="size-2 shrink-0 rounded-full bg-current opacity-70" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ShopifyOrdersConsole({ initialData, initialError }: { initialData: ShopifyOrdersPage; initialError?: string }) {
  const [orders, setOrders] = useState(initialData.orders);
  const [cursor, setCursor] = useState(initialData.endCursor);
  const [hasNextPage, setHasNextPage] = useState(initialData.hasNextPage);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<ShopifyDashboardOrder | null>(null);
  const [detail, setDetail] = useState<ShopifyOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(initialError || "");

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setDetailError("");
  };

  const openOrder = async (order: ShopifyDashboardOrder) => {
    setSelected(order);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/shopify-orders-dashboard/${order.legacyId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare il dettaglio dell'ordine.");
      setDetail(payload);
    } catch (detailLoadError) {
      setDetailError(detailLoadError instanceof Error ? detailLoadError.message : "Impossibile caricare il dettaglio dell'ordine.");
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("it");
    return orders.filter((order) => {
      const matchesQuery = !normalized || [order.name, order.customerName, order.email, order.phone]
        .some((value) => value.toLocaleLowerCase("it").includes(normalized));
      const matchesFilter = filter === "all"
        || (filter === "paid" && order.financialStatus === "PAID")
        || (filter === "pending" && order.financialStatus !== "PAID")
        || (filter === "fulfilled" && order.fulfillmentStatus === "FULFILLED")
        || (filter === "unfulfilled" && order.fulfillmentStatus !== "FULFILLED");
      return matchesQuery && matchesFilter;
    });
  }, [filter, orders, query]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/shopify-orders-dashboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile aggiornare gli ordini.");
      setOrders(payload.orders);
      setCursor(payload.endCursor);
      setHasNextPage(payload.hasNextPage);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Impossibile aggiornare gli ordini.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/shopify-orders-dashboard?after=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossibile caricare altri ordini.");
      setOrders((current) => {
        const known = new Set(current.map((order) => order.id));
        return [...current, ...payload.orders.filter((order: ShopifyDashboardOrder) => !known.has(order.id))];
      });
      setCursor(payload.endCursor);
      setHasNextPage(payload.hasNextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossibile caricare altri ordini.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f1f1f1] text-[#303030]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f7f7]/95 shadow-[0_1px_0_rgba(0,0,0,.04)] backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/service-forms" className="grid size-9 shrink-0 place-items-center rounded-xl text-[#4a4a4a] transition hover:bg-black/5" aria-label="Torna al Terminale operativo">
              <ArrowLeft className="size-5" />
            </Link>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#95bf47] text-white shadow-sm">
              <ShoppingBag className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-[-0.02em] text-[#202223]">Ordini Shopify</p>
              <p className="hidden text-xs text-[#6d7175] sm:block">Gestione integrata in Paradise</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold shadow-sm transition hover:bg-[#fafafa] disabled:opacity-50">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Aggiorna</span>
            </button>
            <a href="https://admin.shopify.com/store/c1uzax-u0/orders" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#303030] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black">
              <Store className="size-4" />
              <span className="hidden sm:inline">Apri Shopify</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1700px] px-3 py-4 sm:px-6 sm:py-6">
        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <div className="border-b border-black/10 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-[-0.025em] text-[#202223]">Ordini</h1>
                <p className="mt-0.5 text-sm text-[#6d7175]">{orders.length} ordini caricati direttamente dal negozio</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6d7175]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca ordine, cliente, email o telefono" className="h-10 w-full rounded-xl border border-[#8c9196] bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-[#8c9196] focus:border-[#008060] focus:ring-2 focus:ring-[#aee9d1]" />
                  {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg hover:bg-black/5" aria-label="Cancella ricerca"><X className="size-4" /></button> : null}
                </label>
                <label className="relative block sm:w-52">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6d7175]" />
                  <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-10 w-full appearance-none rounded-xl border border-[#8c9196] bg-white pl-9 pr-9 text-sm font-semibold outline-none focus:border-[#008060] focus:ring-2 focus:ring-[#aee9d1]">
                    <option value="all">Tutti gli ordini</option>
                    <option value="paid">Pagati</option>
                    <option value="pending">Pagamento da controllare</option>
                    <option value="fulfilled">Evasi</option>
                    <option value="unfulfilled">Da evadere</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#6d7175]" />
                </label>
              </div>
            </div>
          </div>

          {error ? (
            <div className="m-4 flex items-start justify-between gap-4 rounded-xl border border-[#ffc4c4] bg-[#fff4f4] p-4 text-sm text-[#8e1f0b]">
              <div><p className="font-bold">Impossibile aggiornare gli ordini</p><p className="mt-1 opacity-80">{error}</p></div>
              <button type="button" onClick={refresh} className="shrink-0 font-bold underline">Riprova</button>
            </div>
          ) : null}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-[#fafafa] text-xs font-semibold text-[#616161]">
                <tr>
                  <th className="w-10 border-b border-black/10 px-4 py-3"><span className="sr-only">Apri</span></th>
                  <th className="border-b border-black/10 px-3 py-3">Ordine</th>
                  <th className="border-b border-black/10 px-3 py-3">Data</th>
                  <th className="border-b border-black/10 px-3 py-3">Cliente</th>
                  <th className="border-b border-black/10 px-3 py-3">Canale</th>
                  <th className="border-b border-black/10 px-3 py-3 text-right">Totale</th>
                  <th className="border-b border-black/10 px-3 py-3">Pagamento</th>
                  <th className="border-b border-black/10 px-3 py-3">Evasione</th>
                  <th className="border-b border-black/10 px-3 py-3">Articoli</th>
                  <th className="border-b border-black/10 px-3 py-3">Consegna</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id} onClick={() => openOrder(order)} className="cursor-pointer border-b border-black/[0.07] transition hover:bg-[#f6f6f7] last:border-b-0">
                    <td className="px-4 py-3 text-[#8c9196]"><ChevronRight className="size-4" /></td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-[#202223]">{order.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[#616161]">{dateLabel(order.createdAt)}</td>
                    <td className="max-w-60 truncate px-3 py-3 font-medium">{order.customerName}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[#616161]">{sourceLabel(order.sourceName)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{money(order.total, order.currency)}</td>
                    <td className="px-3 py-3"><StatusPill kind="financial" value={order.financialStatus} /></td>
                    <td className="px-3 py-3"><StatusPill kind="fulfillment" value={order.fulfillmentStatus} /></td>
                    <td className="whitespace-nowrap px-3 py-3">{order.itemCount} {order.itemCount === 1 ? "articolo" : "articoli"}</td>
                    <td className="max-w-48 truncate px-3 py-3 text-[#616161]">{order.destination || (order.sourceName.toLowerCase() === "pos" ? "In negozio" : "Da verificare")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-black/[0.07] lg:hidden">
            {visibleOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => openOrder(order)} className="block w-full px-4 py-4 text-left transition active:bg-[#f6f6f7]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold text-[#202223]">{order.name}</p><p className="mt-0.5 truncate text-sm text-[#616161]">{order.customerName}</p></div>
                  <p className="shrink-0 font-bold">{money(order.total, order.currency)}</p>
                </div>
                <p className="mt-2 text-xs text-[#6d7175]">{dateLabel(order.createdAt)} · {sourceLabel(order.sourceName)}</p>
                <div className="mt-3 flex flex-wrap gap-2"><StatusPill kind="financial" value={order.financialStatus} /><StatusPill kind="fulfillment" value={order.fulfillmentStatus} /></div>
              </button>
            ))}
          </div>

          {visibleOrders.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-5 py-10 text-center">
              <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f1f1f1] text-[#6d7175]"><Search className="size-6" /></span><p className="mt-4 font-bold">Nessun ordine trovato</p><p className="mt-1 text-sm text-[#6d7175]">Modifica la ricerca o il filtro selezionato.</p></div>
            </div>
          ) : null}

          {hasNextPage && !query && filter === "all" ? (
            <div className="border-t border-black/10 p-4 text-center">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/15 bg-white px-5 text-sm font-bold shadow-sm transition hover:bg-[#fafafa] disabled:opacity-50">
                {loadingMore ? <RefreshCw className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                Carica altri ordini
              </button>
            </div>
          ) : null}
        </section>
      </main>

      {selected ? (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f1f1f1]" role="dialog" aria-modal="true" aria-label={`Dettaglio ordine ${selected.name}`}>
          <header className="shrink-0 border-b border-black/10 bg-white shadow-sm">
            <div className="mx-auto flex min-h-[72px] w-full max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={closeDetail} className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white transition hover:bg-[#f6f6f7]" aria-label="Torna agli ordini"><ArrowLeft className="size-5" /></button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold tracking-[-0.03em] text-[#202223] sm:text-2xl">{selected.name}</h2>{detail?.closedAt ? <span className="rounded-full bg-[#ececef] px-2.5 py-1 text-xs font-bold text-[#56565b]">Archiviato</span> : null}</div>
                  <p className="truncate text-xs text-[#6d7175] sm:text-sm">{dateLabel(detail?.createdAt || selected.createdAt)} · {sourceLabel(detail?.sourceName || selected.sourceName)}{detail?.locationName ? ` · ${detail.locationName}` : ""}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`https://admin.shopify.com/store/c1uzax-u0/orders/${selected.legacyId}`} target="_blank" rel="noreferrer" className="hidden h-10 items-center gap-2 rounded-xl bg-[#303030] px-4 text-sm font-bold text-white shadow-sm hover:bg-black sm:inline-flex">Apri su Shopify <ExternalLink className="size-4" /></a>
                <button type="button" onClick={closeDetail} className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white hover:bg-[#f6f6f7]" aria-label="Chiudi dettaglio"><X className="size-5" /></button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <main className="mx-auto w-full max-w-[1540px] px-3 py-4 sm:px-6 sm:py-6">
              {detailLoading ? (
                <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto size-8 animate-spin text-[#008060]" /><p className="mt-3 font-semibold text-[#616161]">Carico tutte le informazioni dell’ordine…</p></div></div>
              ) : detailError ? (
                <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-[#ffc4c4] bg-white p-6 text-center shadow-sm"><p className="font-bold text-[#8e1f0b]">Dettaglio non disponibile</p><p className="mt-2 text-sm text-[#616161]">{detailError}</p><button type="button" onClick={() => openOrder(selected)} className="mt-5 h-10 rounded-xl bg-[#303030] px-5 text-sm font-bold text-white">Riprova</button></div>
              ) : detail ? (
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
                  <div className="space-y-5">
                    <DetailCard title={detail.fulfillmentStatus === "FULFILLED" ? "Evaso" : "Evasione"} icon={<Truck className="size-5 text-[#008060]" />}>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#fafafa] p-4">
                        <div><p className="font-bold">{detail.fulfillments[0]?.name || detail.name}</p><p className="mt-1 text-sm text-[#616161]">{detail.fulfillments[0]?.createdAt ? dateLabel(detail.fulfillments[0].createdAt) : "In attesa di evasione"}</p></div>
                        <div className="text-left sm:text-right"><StatusPill kind="fulfillment" value={detail.fulfillmentStatus} /><p className="mt-2 text-sm text-[#616161]">{detail.fulfillments[0]?.locationName || detail.locationName || (detail.sourceName.toLowerCase() === "pos" ? "In negozio" : "Sede non indicata")}</p></div>
                      </div>
                      <div className="mt-4 divide-y divide-black/[0.07] rounded-xl border border-black/[0.08]">
                        {detail.lineItems.map((item) => (
                          <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div><p className="font-bold text-[#202223]">{item.title}</p>{item.variantTitle ? <p className="mt-1 text-sm text-[#616161]">{item.variantTitle}</p> : null}{item.sku ? <p className="mt-1 text-xs text-[#8c9196]">SKU {item.sku}</p> : null}{item.staff.length ? <p className="mt-1 text-xs font-semibold text-[#008060]">Staff: {item.staff.join(", ")}</p> : null}{item.properties.length ? <div className="mt-2 flex flex-wrap gap-1.5">{item.properties.map((property) => <span key={`${property.name}-${property.value}`} className="rounded-lg bg-[#f1f1f1] px-2 py-1 text-xs">{property.name}: {property.value}</span>)}</div> : null}</div>
                            <p className="whitespace-nowrap font-semibold">{money(item.unitPrice, detail.currency)} <span className="text-[#8c9196]">× {item.quantity}</span> <span className="ml-4 text-[#202223]">{money(item.lineTotal, detail.currency)}</span></p>
                          </div>
                        ))}
                      </div>
                    </DetailCard>

                    <DetailCard title={detail.financialStatus === "PAID" ? "Pagato" : "Pagamento"} icon={<ReceiptText className="size-5 text-[#008060]" />}>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4"><span className="text-[#616161]">Subtotale · {detail.lineItems.reduce((sum, item) => sum + item.quantity, 0)} articoli</span><span>{money(detail.subtotal, detail.currency)}</span></div>
                        {detail.discounts ? <div className="flex justify-between gap-4"><span className="text-[#616161]">Sconti</span><span>− {money(detail.discounts, detail.currency)}</span></div> : null}
                        <div className="flex justify-between gap-4"><span className="text-[#616161]">Imposte{detail.taxesIncluded ? " incluse" : ""}{detail.taxLines.length ? ` · ${detail.taxLines.map((tax) => `${tax.title} ${Math.round(tax.rate * 100)}%`).join(", ")}` : ""}</span><span>{money(detail.tax, detail.currency)}</span></div>
                        <div className="flex justify-between gap-4 border-t border-black/10 pt-3 text-base font-bold"><span>Totale</span><span>{money(detail.total, detail.currency)}</span></div>
                        <div className="flex justify-between gap-4 border-t border-black/10 pt-3 font-bold text-[#315c3e]"><span>Pagato</span><span>{money(detail.paid, detail.currency)}</span></div>
                        {detail.outstanding > 0 ? <div className="flex justify-between gap-4 rounded-xl bg-[#fff0c7] p-3 font-bold text-[#7a5513]"><span>Da pagare</span><span>{money(detail.outstanding, detail.currency)}</span></div> : null}
                      </div>
                    </DetailCard>

                    {detail.metafields.length ? <DetailCard title="Campi personalizzati Shopify" icon={<FileText className="size-5 text-[#6d7175]" />}><div className="grid gap-3 md:grid-cols-2">{detail.metafields.map((field) => <div key={field.id} className="rounded-xl bg-[#f6f6f7] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#6d7175]">{field.key.replaceAll("_", " ")}</p><p className="mt-2 break-words text-sm font-medium">{field.value || "—"}</p><p className="mt-2 text-[11px] text-[#8c9196]">{field.namespace}</p></div>)}</div></DetailCard> : null}

                    <DetailCard title="Timeline" icon={<Clock3 className="size-5 text-[#6d7175]" />}>
                      {detail.events.length ? <div className="space-y-0">{detail.events.map((event, index) => <div key={event.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"><div className="relative"><span className="relative z-10 mt-1 block size-3 rounded-full border-[3px] border-white bg-[#6d7175] ring-1 ring-black/10" />{index < detail.events.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+4px)] w-px bg-black/10" /> : null}</div><div><p className="text-sm font-medium leading-6 text-[#303030]">{eventText(event)}</p><p className="mt-1 text-xs text-[#8c9196]">{dateLabel(event.createdAt)}{event.author ? ` · ${event.author}` : ""}</p></div></div>)}</div> : <p className="text-sm text-[#6d7175]">Nessun evento disponibile.</p>}
                    </DetailCard>
                  </div>

                  <aside className="space-y-5 xl:sticky xl:top-0">
                    <DetailCard title="Riepilogo" icon={<CircleDollarSign className="size-5 text-[#008060]" />}>
                      <p className="text-3xl font-bold tracking-[-0.04em] text-[#202223]">{money(detail.total, detail.currency)}</p><div className="mt-4 flex flex-wrap gap-2"><StatusPill kind="financial" value={detail.financialStatus} /><StatusPill kind="fulfillment" value={detail.fulfillmentStatus} /></div>
                      <dl className="mt-5 space-y-3 border-t border-black/10 pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-[#6d7175]">Canale</dt><dd className="font-semibold">{sourceLabel(detail.sourceName)}</dd></div>{detail.confirmationNumber ? <div className="flex justify-between gap-3"><dt className="text-[#6d7175]">Conferma</dt><dd className="font-semibold">#{detail.confirmationNumber}</dd></div> : null}<div className="flex justify-between gap-3"><dt className="text-[#6d7175]">Ordine</dt><dd className="font-semibold">{detail.name}</dd></div></dl>
                    </DetailCard>

                    <DetailCard title="Note" icon={<NotebookPen className="size-5 text-[#7a5513]" />}>
                      {detail.note ? <p className="whitespace-pre-wrap text-sm leading-6">{detail.note}</p> : <p className="text-sm text-[#8c9196]">Nessuna nota sull’ordine.</p>}
                      {detail.noteAttributes.length ? <dl className="mt-4 space-y-2 border-t border-black/10 pt-4 text-sm">{detail.noteAttributes.map((attribute) => <div key={`${attribute.name}-${attribute.value}`}><dt className="text-xs font-bold uppercase tracking-wide text-[#6d7175]">{attribute.name}</dt><dd className="mt-1 break-words">{attribute.value}</dd></div>)}</dl> : null}
                    </DetailCard>

                    <DetailCard title="Cliente" icon={<UserRound className="size-5 text-[#6d7175]" />}>
                      <p className="font-bold text-[#202223]">{detail.customer.name}</p><div className="mt-3 space-y-2 text-sm">{detail.customer.email ? <a href={`mailto:${detail.customer.email}`} className="flex items-center gap-2 break-all text-[#005bd3] hover:underline"><Mail className="size-4 shrink-0" />{detail.customer.email}</a> : null}{detail.customer.phone ? <a href={`tel:${detail.customer.phone}`} className="flex items-center gap-2 text-[#005bd3] hover:underline"><Phone className="size-4 shrink-0" />{detail.customer.phone}</a> : null}</div>
                      <div className="mt-5 space-y-4 border-t border-black/10 pt-4">{detail.shippingAddress ? <div><p className="text-xs font-bold uppercase tracking-wide text-[#6d7175]">Indirizzo di spedizione</p><div className="mt-2 text-sm leading-6">{addressLines(detail.shippingAddress).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></div> : null}{detail.billingAddress ? <div><p className="text-xs font-bold uppercase tracking-wide text-[#6d7175]">Indirizzo di fatturazione</p><div className="mt-2 text-sm leading-6">{addressLines(detail.billingAddress).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></div> : null}{!detail.shippingAddress && !detail.billingAddress ? <p className="text-sm text-[#8c9196]">Nessun indirizzo fornito.</p> : null}</div>
                    </DetailCard>

                    <DetailCard title="Pagamenti" icon={<CreditCard className="size-5 text-[#6d7175]" />}>
                      {detail.transactions.length ? <div className="space-y-3">{detail.transactions.map((transaction) => <div key={transaction.id} className="rounded-xl bg-[#f6f6f7] p-3"><div className="flex justify-between gap-3"><p className="font-bold capitalize">{transaction.kind.replaceAll("_", " ")}</p><p className="font-bold">{money(transaction.amount, transaction.currency)}</p></div><p className="mt-1 text-xs text-[#616161]">{transaction.paymentMethod || transaction.gateway.replaceAll("_", " ")}{transaction.cardBrand ? ` · ${transaction.cardBrand}` : ""}{transaction.last4 ? ` •••• ${transaction.last4}` : ""}</p><p className="mt-1 text-xs text-[#8c9196]">{dateLabel(transaction.createdAt)} · {transaction.status}</p></div>)}</div> : <p className="text-sm text-[#8c9196]">Dettagli pagamento non disponibili.</p>}
                    </DetailCard>

                    {detail.invoices.length ? <DetailCard title="Fatture IVA" icon={<FileText className="size-5 text-[#005bd3]" />}><div className="space-y-2">{detail.invoices.map((invoice) => <a key={invoice.url} href={invoice.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f6f7] p-3 text-sm font-bold text-[#005bd3] hover:underline"><span>{invoice.label}</span><ExternalLink className="size-4 shrink-0" /></a>)}</div></DetailCard> : null}

                    <DetailCard title="Tag" icon={<Tag className="size-5 text-[#6d7175]" />}>
                      {detail.tags.length ? <div className="flex flex-wrap gap-2">{detail.tags.map((tag) => <span key={tag} className="rounded-full bg-[#ececef] px-3 py-1.5 text-xs font-semibold">{tag}</span>)}</div> : <p className="text-sm text-[#8c9196]">Nessun tag.</p>}
                    </DetailCard>

                    <a href={`https://admin.shopify.com/store/c1uzax-u0/orders/${selected.legacyId}`} target="_blank" rel="noreferrer" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#303030] px-5 text-sm font-bold text-white shadow-sm hover:bg-black sm:hidden">Apri su Shopify <ExternalLink className="size-4" /></a>
                  </aside>
                </div>
              ) : null}
            </main>
          </div>
        </div>
      ) : null}
    </div>
  );
}
