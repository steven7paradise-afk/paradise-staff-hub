"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  Mail,
  MailPlus,
  Megaphone,
  MessageSquareText,
  PencilLine,
  Pin,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  page: number;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
};

type Recipient = { id: string; name: string; locationId: string | null; locationName: string };
type LocationOption = { id: string; name: string };
type Filter = "ALL" | "IMPORTANT" | "UNREAD";

const typeStyles: Record<string, { icon: typeof Megaphone; bg: string; pill: string }> = {
  COMUNICAZIONE: { icon: Megaphone, bg: "bg-pink-100 text-[#C66170]", pill: "bg-pink-100 text-[#C66170]" },
  TASK: { icon: CheckCircle2, bg: "bg-violet-100 text-violet-700", pill: "bg-violet-100 text-violet-700" },
  RICHIESTA: { icon: FileCheck2, bg: "bg-amber-100 text-amber-700", pill: "bg-amber-100 text-amber-700" },
  DOCUMENTO: { icon: Mail, bg: "bg-blue-100 text-blue-700", pill: "bg-blue-100 text-blue-700" },
  TIMBRATURA: { icon: BellRing, bg: "bg-rose-100 text-rose-700", pill: "bg-rose-100 text-rose-700" },
  CONTRACT_EXPIRY: { icon: AlertTriangle, bg: "bg-red-100 text-red-700", pill: "bg-red-100 text-red-700" },
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function isImportant(item: NotificationItem) {
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return item.page === 1 || /importante|urgent|scadenza|rifiutat|approvat|firma|task|timbratura|contratto/.test(text);
}

function isUrgent(item: NotificationItem) {
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return /urgent|scadenza|mancat|rifiutat|blocc|contratto/.test(text);
}

function needsSignature(item: NotificationItem) {
  const text = `${item.title} ${item.message}`.toLowerCase();
  return /firma|firmare|confermare|regolamento|documento/.test(text);
}

function notificationStatus(item: NotificationItem) {
  if (item.read) return { label: "Letta", className: "bg-emerald-100 text-emerald-700" };
  if (needsSignature(item)) return { label: "Da confermare", className: "bg-amber-100 text-amber-700" };
  if (item.type === "DOCUMENTO") return { label: "Documento", className: "bg-violet-100 text-violet-700" };
  return { label: "Nuova", className: "bg-pink-100 text-[#C66170]" };
}

export function NotificationManager({
  role,
  notifications,
  recipients,
  locations,
}: {
  role: Role;
  notifications: NotificationItem[];
  recipients: Recipient[];
  locations: LocationOption[];
}) {
  const canSend = role === "ADMIN" || role === "SUPER_ADMIN" || role === "RESPONSABILE";
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(role === "RESPONSABILE" ? "location" : "all");
  const [targetId, setTargetId] = useState(locations[0]?.id ?? recipients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState(notifications);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const router = useRouter();

  const recipientsByLocation = locations.map((location) => ({
    ...location,
    recipients: recipients.filter((recipient) => recipient.locationId === location.id),
  }));
  const recipientsWithoutLocation = recipients.filter((recipient) => !recipient.locationId);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.read).length,
      sign: items.filter(needsSignature).length,
      urgent: items.filter(isUrgent).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => filter === "IMPORTANT" ? isImportant(item) : filter === "UNREAD" ? !item.read : true)
      .filter((item) => !q || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, items, query]);

  const importantItems = items.filter(isImportant).slice(0, 3);
  const unreadItems = items.filter((item) => !item.read).slice(0, 4);
  const eventItems = items.filter((item) => /riunione|evento|calendar|scadenza|appuntamento/i.test(`${item.title} ${item.message}`)).slice(0, 1);

  async function markRead(notification: NotificationItem) {
    if (notification.read) return;
    setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    });
    router.refresh();
  }

  async function deleteNotification(notification: NotificationItem) {
    const ok = window.confirm("Eliminare questa notifica?");
    if (!ok) return;
    setItems((current) => current.filter((item) => item.id !== notification.id));
    await fetch(`/api/notifications/${notification.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function openNotification(notification: NotificationItem) {
    await markRead(notification);
    const href = notification.actionUrl ?? (notification.type === "RICHIESTA" ? "/requests" : notification.type === "DOCUMENTO" ? "/documents" : notification.type === "TIMBRATURA" ? "/attendance" : "");
    if (!href || href === "/notifications" || notification.type === "COMUNICAZIONE") {
      setSelected({ ...notification, read: true });
      return;
    }
    router.push(href);
  }

  async function send() {
    setSending(true);
    setStatus("Invio comunicazione in corso...");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, targetId, title, message, type: "COMUNICAZIONE" }),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      setStatus(data.error ?? "Comunicazione non inviata.");
      return;
    }
    setTitle("");
    setMessage("");
    setStatus(`Comunicazione inviata a ${data.sent} destinatari.`);
    setTimeout(() => setOpen(false), 900);
    router.refresh();
  }

  return (
    <>
      <div className="w-full max-w-none space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#E13D81]">Paradise Beauty</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Comunicazioni</h2>
            <p className="mt-2 text-black/55">Messaggi, avvisi e comunicazioni interne.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-2xl border border-black/10 bg-white p-1 text-sm font-semibold shadow-sm">
              {[
                ["ALL", "Tutte"],
                ["IMPORTANT", "Importanti"],
                ["UNREAD", "Non lette"],
              ].map(([value, label]) => (
                <button key={value} onClick={() => setFilter(value as Filter)} className={cn("rounded-xl px-6 py-3 transition", filter === value ? "bg-white text-[#E13D81] shadow-sm ring-1 ring-[#E13D81]/20" : "text-black/65")}>
                  {label}
                </button>
              ))}
            </div>
            {canSend ? (
              <Button onClick={() => setOpen(true)} className="min-h-14 rounded-xl bg-[#DD2C72] px-8 text-white shadow-lg shadow-pink-200">
                <MailPlus className="size-5" /> Nuova comunicazione
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Totali comunicazioni", value: stats.total, icon: MessageSquareText, bg: "bg-pink-100 text-[#C66170]" },
            { label: "Non lette", value: stats.unread, icon: Mail, bg: "bg-violet-100 text-violet-700" },
            { label: "Da firmare", value: stats.sign, icon: PencilLine, bg: "bg-amber-100 text-amber-700" },
            { label: "Urgenti", value: stats.urgent, icon: AlertTriangle, bg: "bg-rose-100 text-rose-700" },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="flex items-center gap-5">
                <div className={cn("grid size-14 place-items-center rounded-2xl", metric.bg)}>
                  <Icon className="size-6" />
                </div>
                <div>
                  <p className="text-3xl font-semibold">{metric.value}</p>
                  <p className="text-sm text-black/55">{metric.label}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="p-0">
            <div className="flex flex-col gap-4 border-b border-black/5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-semibold">{filter === "IMPORTANT" ? "Comunicazioni importanti" : filter === "UNREAD" ? "Comunicazioni non lette" : "Tutte le comunicazioni"}</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button className="inline-flex items-center gap-1 text-sm font-medium text-black/60">
                  Ordina: Più recenti <ChevronDown className="size-4" />
                </button>
                <label className="relative block sm:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/40" />
                  <Field value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca comunicazione..." className="pl-11" />
                </label>
              </div>
            </div>
            <div className="divide-y divide-black/5">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-sm text-black/50">Nessuna comunicazione trovata.</div>
              ) : filteredItems.map((notification) => {
                const style = typeStyles[notification.type] ?? typeStyles.COMUNICAZIONE;
                const Icon = style.icon;
                const statusInfo = notificationStatus(notification);
                return (
                  <button
                    key={notification.id}
                    className="grid w-full gap-4 p-6 text-left transition hover:bg-[#FAF7F9] md:grid-cols-[72px_1fr_auto] md:items-center"
                    onClick={() => openNotification(notification)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      void deleteNotification(notification);
                    }}
                    title="Click per aprire. Click destro per eliminare."
                  >
                    <div className={cn("grid size-16 place-items-center rounded-[20px]", style.bg)}>
                      <Icon className="size-7" />
                    </div>
                    <div className="min-w-0">
                      {isImportant(notification) ? <span className="rounded-full bg-pink-100 px-2 py-1 text-[10px] font-bold uppercase text-[#E13D81]">Importante</span> : null}
                      <p className="mt-2 text-lg font-semibold">{notification.title}</p>
                      <p className="mt-1 text-sm text-black/55">{notification.type.toLowerCase()} <span className="mx-2">•</span> {dateLabel(notification.createdAt)}</p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/60">{notification.message}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-bold", statusInfo.className)}>{statusInfo.label}</span>
                      <Bookmark className="size-4 text-black/60" />
                      <ChevronRight className="size-5 text-black/45" />
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredItems.length > 0 ? (
              <div className="border-t border-black/5 p-5 text-center">
                <button className="inline-flex items-center gap-2 text-sm font-bold text-[#E13D81]">
                  Carica altre comunicazioni <ChevronDown className="size-4" />
                </button>
              </div>
            ) : null}
          </Card>

          <aside className="space-y-5">
            <SideCard title="Comunicazioni importanti" icon={Pin} items={importantItems} empty="Nessuna comunicazione importante." onOpen={openNotification} />
            <SideCard title="Da leggere" count={stats.unread} items={unreadItems} empty="Tutto letto." onOpen={openNotification} />
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="size-5 text-violet-600" />
                <h3 className="font-semibold">Prossimi eventi</h3>
              </div>
              {eventItems.length === 0 ? (
                <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/50">Nessun evento in arrivo.</p>
              ) : eventItems.map((item) => (
                <button key={item.id} onClick={() => openNotification(item)} className="w-full rounded-2xl bg-violet-50 p-4 text-left">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-violet-700">{dateLabel(item.createdAt)}</p>
                  <p className="mt-1 text-xs text-black/50">Apri comunicazione</p>
                </button>
              ))}
            </Card>
          </aside>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">{selected.type.toLowerCase()}</p>
                <h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2>
                <p className="mt-1 text-sm text-black/45">{dateLabel(selected.createdAt)}</p>
              </div>
              <button className="grid size-10 place-items-center rounded-xl border border-black/10" onClick={() => setSelected(null)}><X className="size-5" /></button>
            </div>
            <p className="whitespace-pre-line text-sm leading-7 text-black/65">{selected.message}</p>
            <Button className="mt-6 w-full" onClick={() => setSelected(null)}>Ho letto</Button>
          </Card>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Comunicazione</p>
                <h2 className="mt-2 text-2xl font-semibold">Nuova comunicazione</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-xl border border-black/10" onClick={() => setOpen(false)}><X className="size-5" /></button>
            </div>
            <div className="grid gap-4">
              {role !== "RESPONSABILE" ? (
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Destinatari</span>
                  <Select value={target} onChange={(event) => { setTarget(event.target.value); setTargetId(event.target.value === "location" ? locations[0]?.id ?? "" : recipients[0]?.id ?? ""); }}>
                    <option value="all">Tutti</option>
                    <option value="location">Salone</option>
                    <option value="user">Persona</option>
                  </Select>
                </label>
              ) : null}
              {target === "location" ? (
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Salone</span>
                  <Select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </Select>
                </label>
              ) : null}
              {target === "user" ? (
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Persona</span>
                  <Select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    {recipientsByLocation.map((location) =>
                      location.recipients.length > 0 ? (
                        <optgroup key={location.id} label={location.name}>
                          {location.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
                        </optgroup>
                      ) : null,
                    )}
                    {recipientsWithoutLocation.length > 0 ? (
                      <optgroup label="Senza salone">
                        {recipientsWithoutLocation.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
                      </optgroup>
                    ) : null}
                  </Select>
                </label>
              ) : null}
              <label className="space-y-2">
                <span className="text-sm font-semibold">Titolo</span>
                <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Esempio: Riunione staff" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Messaggio</span>
                <textarea className="min-h-32 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Scrivi la comunicazione..." />
              </label>
              {status ? <p className="rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium">{status}</p> : null}
              <Button onClick={send} disabled={sending}><Send className="size-4" /> {sending ? "Invio..." : "Invia"}</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function SideCard({ title, icon: Icon, count, items, empty, onOpen }: { title: string; icon?: typeof Pin; count?: number; items: NotificationItem[]; empty: string; onOpen: (item: NotificationItem) => void }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        {Icon ? <Icon className="size-5 text-[#E13D81]" /> : null}
        <h3 className="font-semibold">{title}</h3>
        {typeof count === "number" ? <Badge tone="pink">{count}</Badge> : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/50">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button key={item.id} onClick={() => onOpen(item)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-pink-50 p-4 text-left transition hover:bg-pink-100/70">
              <div>
                <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-black/50">{dateLabel(item.createdAt)}</p>
              </div>
              <ChevronRight className="size-4 text-black/45" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
