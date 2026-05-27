"use client";

import { useEffect, useState } from "react";
import { BellRing, FileCheck2, MailPlus, Megaphone, Send, X } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
};

type Recipient = { id: string; name: string; locationId: string | null };
type LocationOption = { id: string; name: string };

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

  useEffect(() => {
    if (!notifications.some((notification) => !notification.read)) return;
    fetch("/api/notifications/read", { method: "PATCH" }).then((response) => {
      if (response.ok) setItems((current) => current.map((notification) => ({ ...notification, read: true })));
    });
  }, [notifications]);

  async function send() {
    setSending(true);
    setStatus("");
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
    setOpen(false);
    setStatus(`Comunicazione inviata a ${data.sent} destinatari.`);
  }

  return (
    <>
      {canSend ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => setOpen(true)}><MailPlus className="size-4" /> Invia comunicazione</Button>
          {status ? <span className="rounded-full bg-paradise-nude px-4 py-2 text-sm font-semibold">{status}</span> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {items.length === 0 ? <Card className="text-sm text-black/50">Non hai nuove comunicazioni o avvisi.</Card> : null}
        {items.map((notification) => {
          const Icon = notification.type === "COMUNICAZIONE" ? Megaphone : notification.type === "RICHIESTA" ? FileCheck2 : BellRing;
          return (
          <Card key={notification.id} className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-paradise-softPink">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="font-semibold">{notification.title}</p>
              <p className="mt-1 text-sm text-black/55">{notification.message}</p>
            </div>
            <Badge tone={notification.read ? "green" : "pink"}>{notification.read ? "Letta" : "Nuova"}</Badge>
          </Card>
          );
        })}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Comunicazione</p>
                <h2 className="mt-2 text-2xl font-semibold">Invia avviso</h2>
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
                    {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
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
