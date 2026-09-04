"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import type { ShopifyDashboardOrder, ShopifyOrdersPage } from "@/lib/shopify-orders-dashboard";
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
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(initialError || "");

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
                  <tr key={order.id} onClick={() => setSelected(order)} className="cursor-pointer border-b border-black/[0.07] transition hover:bg-[#f6f6f7] last:border-b-0">
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
              <button key={order.id} type="button" onClick={() => setSelected(order)} className="block w-full px-4 py-4 text-left transition active:bg-[#f6f6f7]">
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
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={`Dettaglio ordine ${selected.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside className="flex h-full w-full max-w-xl flex-col bg-[#f1f1f1] shadow-[-20px_0_70px_rgba(0,0,0,.22)]">
            <header className="flex items-start justify-between gap-4 border-b border-black/10 bg-white px-5 py-5 sm:px-6">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6d7175]">Ordine Shopify</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#202223]">{selected.name}</h2><p className="mt-1 text-sm text-[#6d7175]">{dateLabel(selected.createdAt)}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white transition hover:bg-[#f6f6f7]" aria-label="Chiudi dettaglio"><X className="size-5" /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#6d7175]">Totale ordine</p><p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[#202223]">{money(selected.total, selected.currency)}</p></div><CircleDollarSign className="size-7 text-[#008060]" /></div>
                <div className="mt-4 flex flex-wrap gap-2"><StatusPill kind="financial" value={selected.financialStatus} /><StatusPill kind="fulfillment" value={selected.fulfillmentStatus} /></div>
              </section>

              <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><ShoppingBag className="size-5 text-[#6d7175]" /><h3 className="font-bold text-[#202223]">Articoli</h3><span className="ml-auto rounded-full bg-[#f1f1f1] px-2.5 py-1 text-xs font-bold">{selected.itemCount}</span></div>
                <div className="mt-4 divide-y divide-black/[0.07]">
                  {selected.items.length ? selected.items.map((item, index) => <div key={`${item.title}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-medium">{item.title}</span><span className="shrink-0 text-[#6d7175]">× {item.quantity}</span></div>) : <p className="py-3 text-sm text-[#6d7175]">Dettaglio articoli non disponibile.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#202223]">Cliente</h3>
                <p className="mt-3 font-semibold">{selected.customerName}</p>
                <div className="mt-3 space-y-2 text-sm text-[#616161]">
                  {selected.email ? <a href={`mailto:${selected.email}`} className="flex items-center gap-2 hover:text-[#008060]"><Mail className="size-4" />{selected.email}</a> : null}
                  {selected.phone ? <a href={`tel:${selected.phone}`} className="flex items-center gap-2 hover:text-[#008060]"><Phone className="size-4" />{selected.phone}</a> : null}
                  {selected.destination ? <p className="flex items-center gap-2"><MapPin className="size-4" />{selected.destination}</p> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#202223]">Informazioni operative</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#f6f6f7] p-3"><Clock3 className="size-4 text-[#6d7175]" /><p className="mt-2 text-xs text-[#6d7175]">Canale</p><p className="mt-0.5 text-sm font-bold">{sourceLabel(selected.sourceName)}</p></div>
                  <div className="rounded-xl bg-[#f6f6f7] p-3"><PackageCheck className="size-4 text-[#6d7175]" /><p className="mt-2 text-xs text-[#6d7175]">Consegna</p><p className="mt-0.5 text-sm font-bold">{selected.destination || (selected.sourceName.toLowerCase() === "pos" ? "In negozio" : "Da verificare")}</p></div>
                </div>
                {selected.note ? <div className="mt-4 rounded-xl border border-[#e1b878] bg-[#fff8eb] p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#7a5513]">Nota ordine</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.note}</p></div> : null}
              </section>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-black/10 bg-white p-4 sm:px-6">
              <button type="button" onClick={() => setSelected(null)} className="h-11 rounded-xl border border-black/15 bg-white px-5 text-sm font-bold">Chiudi</button>
              <a href={`https://admin.shopify.com/store/c1uzax-u0/orders/${selected.legacyId}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#303030] px-5 text-sm font-bold text-white shadow-sm hover:bg-black">Apri su Shopify <ExternalLink className="size-4" /></a>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
