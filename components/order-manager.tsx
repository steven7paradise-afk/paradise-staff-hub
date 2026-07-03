"use client";

import Papa from "papaparse";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Eye, LinkIcon, Loader2, PackageCheck, Search, ShoppingCart, Truck, X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ResponseComments } from "@/components/response-comments";

type OrderResponse = {
  id: string;
  status: string;
  priority?: string | null;
  answers: Record<string, any>;
  comments?: any[] | null;
  activity_log?: any[] | null;
  created_at: string;
  updated_at: string;
  user_location_name?: string | null;
  user?: { name?: string | null };
  form?: { name?: string | null; fields?: Array<{ id: string; label: string; type: string }> };
};

const ORDER_COLUMNS = [
  { id: "NEW", label: "Nuovo ordine", icon: ShoppingCart, color: "bg-pink-50 text-[#C66170] border-pink-100" },
  { id: "PREPARING", label: "Preparando ordine", icon: Clock3, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "ORDERED", label: "Ordinato", icon: Truck, color: "bg-violet-50 text-violet-700 border-violet-100" },
  { id: "READY", label: "Arrivato / pronto", icon: PackageCheck, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "COMPLETED", label: "Completato", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
];

const monthsList = [
  { value: 1, label: "Gennaio" },
  { value: 2, label: "Febbraio" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Aprile" },
  { value: 5, label: "Maggio" },
  { value: 6, label: "Giugno" },
  { value: 7, label: "Luglio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Settembre" },
  { value: 10, label: "Ottobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Dicembre" },
];

const currentYear = new Date().getFullYear();
const yearsList = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

function parseCustomDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.toLowerCase().replace(/\s+/g, " ").trim();
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) return new Date(parsed);

  const normalized = clean.replace(/\b(de|di)\b/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10);
    
    let hour = 12;
    let min = 0;
    if (parts[3] && parts[3].includes(":")) {
      const timeParts = parts[3].split(":");
      hour = parseInt(timeParts[0], 10) || 12;
      min = parseInt(timeParts[1], 10) || 0;
    }
    
    const months: Record<string, number> = {
      gen: 0, gennaio: 0, ene: 0, enero: 0, jan: 0, january: 0,
      feb: 1, febbraio: 1, febr: 1, febrero: 1, february: 1,
      mar: 2, marzo: 2, march: 2,
      apr: 3, aprile: 3, abr: 3, abril: 3, april: 3,
      mag: 4, maggio: 4, may: 4, mayo: 4,
      giu: 5, giugno: 5, jun: 5, junio: 5, june: 5,
      lug: 6, luglio: 6, jul: 6, julio: 6, july: 6,
      ago: 7, agosto: 7, aug: 7, august: 7,
      set: 8, settembre: 8, sep: 8, sept: 8, septiembre: 8, september: 8,
      ott: 9, ottobre: 9, oct: 9, ottobre: 9, october: 9,
      nov: 10, novembre: 10, noviembre: 10, november: 10,
      dic: 11, dicembre: 11, dicembre: 11, december: 11
    };
    
    let monthIdx = -1;
    for (const [key, idx] of Object.entries(months)) {
      if (monthStr.startsWith(key) || key.startsWith(monthStr)) {
        monthIdx = idx;
        break;
      }
    }
    
    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      return new Date(year, monthIdx, day, hour, min);
    }
  }
  
  return new Date();
}

function mapCsvStatus(statusStr: string): string {
  const s = statusStr.toLowerCase();
  if (s.includes("completat")) return "COMPLETED";
  if (s.includes("arrivat") || s.includes("pront")) return "READY"; // Wait, in ORDER_COLUMNS it's READY ("Arrivato / pronto"), not ARRIVED!
  if (s.includes("ordinat")) return "ORDERED";
  if (s.includes("prepar")) return "PREPARING";
  return "NEW";
}

function answerById(order: OrderResponse, id: string) {
  const value = order.answers?.[id];
  if (!value) return "";
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

function fieldValue(order: OrderResponse, includes: string[]) {
  const fields = order.form?.fields ?? [];
  const field = fields.find((item) => includes.some((needle) => item.label.toLowerCase().includes(needle)));
  if (!field) return "";
  return answerById(order, field.id);
}

function orderTitle(order: OrderResponse) {
  const title = answerById(order, "order_title") || fieldValue(order, ["nome ordine", "ordine", "titolo"]);
  if (title) return title;
  const clientName = fieldValue(order, ["cliente", "nome cliente", "nome del cliente", "nome"]);
  if (clientName) return clientName;
  return "Ordine senza titolo";
}

function orderItems(order: OrderResponse) {
  return answerById(order, "order_items") || fieldValue(order, ["cosa", "prodot", "material", "ordinare"]);
}

function orderPriority(order: OrderResponse) {
  return answerById(order, "order_priority") || order.priority || "Normale";
}

function orderDate(order: OrderResponse) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.created_at));
}

function statusLabel(status: string) {
  return ORDER_COLUMNS.find((column) => column.id === status)?.label ?? status;
}

export function OrderManager({
  initialOrders,
  canManage,
  currentUserName,
  currentUserRole,
}: {
  initialOrders: OrderResponse[];
  canManage: boolean;
  currentUserName: string;
  currentUserRole: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selected, setSelected] = useState<OrderResponse | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState("ALL");
  const [changingStatusTo, setChangingStatusTo] = useState<string | null>(null);
  const [statusNoteText, setStatusNoteText] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const filteredOrders = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean) {
      // Search is active on ALL orders in the list, bypassing the month filter.
      return orders.filter((order) => {
        const haystack = [
          orderTitle(order),
          orderItems(order),
          order.user?.name ?? "",
          order.user_location_name ?? "",
          JSON.stringify(order.answers ?? {}),
        ].join(" ").toLowerCase();
        return haystack.includes(clean);
      });
    }

    // Default board view: active columns show all active orders, completed column only shows those of selected month/year.
    return orders.filter((order) => {
      const status = order.status || "NEW";
      if (status !== "COMPLETED") return true;
      const d = new Date(order.created_at);
      return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    });
  }, [orders, query, selectedMonth, selectedYear]);

  const mobileOrders = useMemo(() => {
    if (mobileStatus === "ALL") return filteredOrders;
    return filteredOrders.filter((order) => (order.status || "NEW") === mobileStatus);
  }, [filteredOrders, mobileStatus]);

  async function moveOrder(order: OrderResponse, status: string, note?: string) {
    setSavingId(order.id);
    const response = await fetch(`/api/service-forms/responses/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, statusNote: note }),
    });
    setSavingId(null);
    if (!response.ok) return;
    const updated = await response.json();
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
    setSelected((current) => current?.id === order.id ? { ...current, ...updated } : current);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setUploadError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          
          const clientKey = results.meta.fields?.find(f => f.toLowerCase().includes("cliente")) || "CLIENTE";
          const grouped = new Map<string, any[]>();
          
          for (const row of rows) {
            const clientName = row[clientKey] || "Senza Nome";
            if (!grouped.has(clientName)) {
              grouped.set(clientName, []);
            }
            grouped.get(clientName)?.push(row);
          }

          const ordersToImport = Array.from(grouped.entries()).map(([clientName, clientRows]) => {
            const notes = clientRows.map((r, index) => {
              const details = Object.entries(r)
                .filter(([k, v]) => k !== clientKey && typeof v === "string" && v.trim() !== "")
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n");
              return `--- RIGA ${index + 1} ---\n${details}`;
            }).join("\n\n");

            // Extract status
            const statuses = clientRows.map(r => {
              const statusKey = Object.keys(r).find(k => k.toLowerCase() === "stato" || k.toLowerCase().includes("stato"));
              return mapCsvStatus(statusKey ? r[statusKey] || "" : "");
            });
            let finalStatus = "NEW";
            if (statuses.includes("NEW")) finalStatus = "NEW";
            else if (statuses.includes("PREPARING")) finalStatus = "PREPARING";
            else if (statuses.includes("ORDERED")) finalStatus = "ORDERED";
            else if (statuses.includes("READY")) finalStatus = "READY";
            else if (statuses.includes("COMPLETED")) finalStatus = "COMPLETED";

            // Extract date
            let finalDate = new Date();
            const dates = clientRows.map(r => {
              const creatoKey = Object.keys(r).find(k => k.toLowerCase().includes("creato il") || k.toLowerCase().includes("creato_il"));
              if (creatoKey && r[creatoKey]) return parseCustomDate(r[creatoKey]);
              const dataKey = Object.keys(r).find(k => k.toLowerCase().includes("data") || k.toLowerCase() === "date");
              if (dataKey && r[dataKey]) return parseCustomDate(r[dataKey]);
              return null;
            }).filter(Boolean) as Date[];

            if (dates.length > 0) {
              // Take oldest date to represent creation time
              finalDate = new Date(Math.min(...dates.map(d => d.getTime())));
            }

            return { 
              clientName, 
              rows: clientRows,
              status: finalStatus,
              createdAt: finalDate.toISOString()
            };
          });

          const res = await fetch("/api/orders/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orders: ordersToImport }),
          });

          if (!res.ok) {
            throw new Error(await res.text());
          }

          setShowCsvUpload(false);
          window.location.reload();
        } catch (err: any) {
          setUploadError("Errore durante l'elaborazione del CSV: " + err.message);
        } finally {
          setUploadingCsv(false);
        }
      },
      error: (error) => {
        setUploadError("Errore di lettura del CSV: " + error.message);
        setUploadingCsv(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Paradise Operations</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Ordini</h1>
            <p className="mt-2 text-sm text-black/50">{canManage ? "Gestisci" : "Controlla"} gli ordini creati dal modulo ordine: nuovi, in preparazione, ordinati e completati.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-black/40">Mese:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-black/5 border border-black/10 text-black text-xs font-bold rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/10 transition"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-black/5 border border-black/10 text-black text-xs font-bold rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/10 transition"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 w-full lg:w-72">
              <Search className="size-4 text-black/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca ordine, salone, prodotto..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            
            {canManage && (
              <Button onClick={() => setShowCsvUpload(true)} variant="soft" className="rounded-2xl border-black/10">
                Importa CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMobileStatus("ALL")}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition",
              mobileStatus === "ALL" ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white text-black/50"
            )}
          >
            Tutti {filteredOrders.length}
          </button>
          {ORDER_COLUMNS.map((column) => {
            const count = filteredOrders.filter((order) => (order.status || "NEW") === column.id).length;
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setMobileStatus(column.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition",
                  mobileStatus === column.id ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white text-black/50"
                )}
              >
                {column.label} {count}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3">
          {mobileOrders.length === 0 ? (
            <Card className="bg-white p-6 text-center text-sm font-semibold text-black/40">Nessun ordine in questo stato.</Card>
          ) : null}
          {mobileOrders.map((order) => {
            const currentStatus = order.status || "NEW";
            const status = ORDER_COLUMNS.find((column) => column.id === currentStatus) ?? ORDER_COLUMNS[0];
            const Icon = status.icon;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelected(order)}
                className="w-full rounded-[24px] border border-black/5 bg-white p-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/35">Stato ordine</p>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#FAF7F9] px-3 py-1.5 text-xs font-extrabold text-[#C66170]">
                      <Icon className="size-4" />
                      {status.label}
                    </div>
                  </div>
                  <Eye className="size-4 shrink-0 text-black/30" />
                </div>
                <h3 className="mt-3 line-clamp-2 text-lg font-extrabold leading-6 text-black">{orderTitle(order)}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-black/40">
                  <span>{order.user_location_name ?? "Salone non indicato"}</span>
                  <span>·</span>
                  <span>{order.user?.name ?? "Staff"}</span>
                  <span>·</span>
                  <span>{orderDate(order)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-5">
        {ORDER_COLUMNS.map((column) => {
          const columnOrders = filteredOrders.filter((order) => (order.status || "NEW") === column.id);
          const Icon = column.icon;
          return (
            <Card key={column.id} className={cn("min-h-[26rem] border p-4", column.color)}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-5" />
                  <h2 className="font-semibold">{column.label}</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/55">{columnOrders.length}</span>
              </div>
              <div className="grid gap-3">
                {columnOrders.length === 0 ? (
                  <p className="rounded-2xl bg-white/70 p-4 text-sm text-black/40">Nessun ordine.</p>
                ) : null}
                {columnOrders.map((order) => (
                  <button key={order.id} onClick={() => setSelected(order)} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-semibold leading-5 text-black">{orderTitle(order)}</h3>
                      <Eye className="size-4 shrink-0 text-black/35" />
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-black/50">{orderItems(order) || "Nessun dettaglio prodotti."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone={orderPriority(order).toLowerCase().includes("urgent") || orderPriority(order).toLowerCase().includes("bloc") ? "pink" : "gold"}>{orderPriority(order)}</Badge>
                      {order.user_location_name ? <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/45">{order.user_location_name}</span> : null}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold text-black/35">{order.user?.name ?? "Staff"} · {orderDate(order)}</p>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {showCsvUpload ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Importa Ordini da CSV</h3>
              <button onClick={() => !uploadingCsv && setShowCsvUpload(false)} disabled={uploadingCsv} className="text-black/50 hover:text-black">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-black/60">
              Carica il file CSV scaricato dal modulo. Il sistema leggerà automaticamente i dati e raggrupperà le righe con lo stesso nome "CLIENTE" in un unico ordine.
            </p>
            {uploadError && <div className="text-red-500 text-sm p-3 bg-red-50 rounded-xl">{uploadError}</div>}
            
            <div className="flex justify-center border-2 border-dashed border-black/20 rounded-2xl p-6 hover:bg-black/5 transition cursor-pointer relative">
              <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploadingCsv} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <div className="text-center">
                {uploadingCsv ? <Loader2 className="size-6 animate-spin mx-auto text-paradise-pink" /> : <PackageCheck className="size-6 mx-auto text-black/30 mb-2" />}
                <span className="text-sm font-semibold">{uploadingCsv ? "Elaborazione in corso..." : "Clicca o trascina qui il file CSV"}</span>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 backdrop-blur-sm lg:place-items-center lg:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-[#F8F3F6] p-4 shadow-2xl lg:max-w-4xl lg:rounded-[32px] lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button onClick={() => setSelected(null)} className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm"><ArrowLeft className="size-5" /></button>
              <Button variant="soft" onClick={() => setSelected(null)}><X className="size-4" /> Chiudi</Button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <Card className="bg-white">
                <Badge tone="dark">{statusLabel(selected.status || "NEW")}</Badge>
                <h2 className="mt-4 text-3xl font-semibold">{orderTitle(selected)}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/60">{orderItems(selected)}</p>
                <div className="mt-5 grid gap-3">
                  {(selected.form?.fields ?? []).map((field) => {
                    const value = selected.answers?.[field.id];
                    if (!value) return null;
                    const isFile = typeof value === "object" && value.storagePath;
                    return (
                      <div key={field.id} className="rounded-2xl bg-[#FAF7F9] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/35">{field.label}</p>
                        {isFile ? (
                          <a href={`/api/service-forms/responses/file?path=${encodeURIComponent(value.storagePath)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#8064D8]">
                            <LinkIcon className="size-4" /> {value.name ?? "Apri file"}
                          </a>
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">{String(value)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Log attività / cambi di stato */}
                {Array.isArray(selected.activity_log) && (selected.activity_log as any[]).length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-black/5 pt-6">
                    <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-black/40">Cronologia Stati e Note</h3>
                    <div className="grid gap-3">
                      {(selected.activity_log as any[]).map((log: any, idx: number) => {
                        const logDate = log.at || log.date;
                        let formattedDate = "";
                        if (logDate) {
                          try {
                            formattedDate = new Intl.DateTimeFormat("it-IT", { 
                              day: "2-digit", 
                              month: "short", 
                              hour: "2-digit", 
                              minute: "2-digit" 
                            }).format(new Date(logDate));
                          } catch (e) {
                            formattedDate = "";
                          }
                        }

                        let title = "";
                        if (log.action) {
                          title = log.action;
                        } else if (log.from !== undefined || log.to !== undefined) {
                          const colFrom = ORDER_COLUMNS.find((c) => c.id === log.from);
                          const colTo = ORDER_COLUMNS.find((c) => c.id === log.to);
                          title = `Stato cambiato da ${colFrom?.label ?? log.from ?? 'sconosciuto'} a ${colTo?.label ?? log.to ?? 'sconosciuto'}`;
                        } else {
                          title = "Attività registrata";
                        }

                        const actor = log.by || log.user || "Staff";

                        return (
                          <div key={idx} className="rounded-2xl border border-black/5 bg-[#FAF7F9] p-4 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-black/75">
                                {title}
                              </span>
                              {formattedDate && (
                                <span className="text-[11px] text-black/40">
                                  {formattedDate}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-black/45">Modificato da: {actor}</p>
                            {log.note && (
                              <div className="mt-3 rounded-xl bg-white p-3 border border-black/5">
                                <p className="text-xs font-bold text-black/35 mb-1">Nota stato:</p>
                                <p className="text-sm text-black/80 whitespace-pre-wrap">{log.note}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <ResponseComments
                  responseId={selected.id}
                  initialComments={selected.comments || []}
                  currentUserName={currentUserName}
                  currentUserRole={currentUserRole}
                  onCommentsUpdate={(updatedComments) => {
                    setOrders((current) =>
                      current.map((item) =>
                        item.id === selected.id ? { ...item, comments: updatedComments } : item
                      )
                    );
                    setSelected((current) =>
                      current?.id === selected.id ? { ...current, comments: updatedComments } : current
                    );
                  }}
                />
              </Card>
              <div className="space-y-4">
                <Card className="bg-white">
                  <h3 className="font-semibold">{canManage ? "Stato ordine" : "Avanzamento ordine"}</h3>
                  {!canManage ? <p className="mt-1 text-xs text-black/45">Puoi controllare lo stato. Le modifiche sono riservate ai responsabili.</p> : null}
                  {changingStatusTo ? (
                    <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-black/60">
                        Nota per cambio in: {statusLabel(changingStatusTo)}
                      </h4>
                      <textarea
                        value={statusNoteText}
                        onChange={(e) => setStatusNoteText(e.target.value)}
                        placeholder="Inserisci una nota facoltativa..."
                        rows={3}
                        className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm outline-none resize-none focus:border-paradise-pink"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="soft"
                          onClick={() => {
                            setChangingStatusTo(null);
                            setStatusNoteText("");
                          }}
                        >
                          Annulla
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => {
                            void moveOrder(selected, changingStatusTo, statusNoteText);
                            setChangingStatusTo(null);
                            setStatusNoteText("");
                          }}
                        >
                          Conferma
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      {ORDER_COLUMNS.map((column) => (
                        <button
                          key={column.id}
                          type="button"
                          disabled={!canManage || savingId === selected.id}
                          onClick={() => {
                            setChangingStatusTo(column.id);
                            setStatusNoteText("");
                          }}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                            (selected.status || "NEW") === column.id ? "border-paradise-pink bg-paradise-softPink text-[#C66170]" : "border-black/10 bg-white",
                            canManage && "hover:bg-[#FAF7F9]"
                          )}
                        >
                          {column.label}
                          {savingId === selected.id ? <Loader2 className="size-4 animate-spin" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
                <Card className="bg-white">
                  <h3 className="font-semibold">Dettagli</h3>
                  <div className="mt-4 grid gap-3 text-sm">
                    <p><span className="text-black/40">Creato da:</span> <b>{selected.user?.name ?? "Staff"}</b></p>
                    <p><span className="text-black/40">Salone:</span> <b>{selected.user_location_name ?? "Non indicato"}</b></p>
                    {(() => {
                      const shopifyOrderField = (selected.form?.fields ?? []).find(f => 
                        f.label?.toLowerCase().includes("ordine shopify") || 
                        f.label?.toLowerCase().includes("numero ordine") || 
                        f.label?.toLowerCase().includes("codice")
                      );
                      const shopifyOrderVal = shopifyOrderField ? selected.answers?.[shopifyOrderField.id] : null;
                      const finalOrderVal = selected.answers?.field_1782221517924 || shopifyOrderVal;
                      return (
                        <p>
                          <span className="text-black/40">Ordine Shopify:</span>{" "}
                          <b className="text-[#C66170] font-mono select-all bg-pink-50/50 px-1 py-0.5 rounded border border-pink-100/55">
                            {String(finalOrderVal || "Non inserito")}
                          </b>
                        </p>
                      );
                    })()}
                    <p><span className="text-black/40">ID Scheda:</span> <span className="font-mono text-xs text-black/60 bg-black/5 px-1.5 py-0.5 rounded select-all">{selected.id}</span></p>
                    <p className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-black/40" /> {orderDate(selected)}</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
