"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ExternalLink, LoaderCircle, MessageCircleMore, Send, Sparkles, X } from "lucide-react";

type PendingAction = { token: string; type: "SEND_COMMUNICATION"; label: string; recipient: string; title: string; message: string; expiresAt: string };
type AssistantCard = {
  id: string;
  person: string;
  photoUrl: string | null;
  status: string;
  type: string;
  location: string;
  date: string | null;
  time: string | null;
  detail: string | null;
  tone: "green" | "amber" | "red" | "violet" | "blue" | "slate";
};
type Message = { role: "user" | "assistant"; content: string; links?: Array<{ path: string; label: string }>; pendingAction?: PendingAction | null; cards?: AssistantCard[] };

const starters = ["Chi è in pausa?", "Come stanno andando le task?", "Quali richieste sono da approvare?"];

export function AdminAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ciao, sono Paradise Assistant. Posso controllare presenze, pause, task e richieste oppure preparare una bozza di comunicazione." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const userMessage: Message = { role: "user", content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      const payload = await response.json() as {
        answer?: string;
        error?: string;
        links?: Array<{ path: string; label: string }>;
        navigation?: { path: string; label: string } | null;
        pendingAction?: PendingAction | null;
        cards?: AssistantCard[];
      };
      if (!response.ok) throw new Error(payload.error || "Assistente non disponibile.");
      setMessages((current) => [...current, {
        role: "assistant",
        content: payload.answer || "Operazione completata.",
        links: payload.links,
        pendingAction: payload.pendingAction,
        cards: payload.cards,
      }]);
      if (payload.navigation?.path) router.push(payload.navigation.path);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: error instanceof Error ? error.message : "Assistente non disponibile. Riprova tra poco.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function resolveAction(messageIndex: number, action: PendingAction, mode: "confirm" | "cancel") {
    if (actionLoading) return;
    setActionLoading(action.token);
    try {
      const response = await fetch("/api/admin-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "confirm" ? { confirmActionToken: action.token } : { cancelActionToken: action.token }),
      });
      const payload = await response.json() as { answer?: string; error?: string; links?: Array<{ path: string; label: string }> };
      if (!response.ok) throw new Error(payload.error || "Operazione non completata.");
      setMessages((current) => [
        ...current.map((message, index) => index === messageIndex ? { ...message, pendingAction: null } : message),
        { role: "assistant", content: payload.answer || "Operazione completata.", links: payload.links },
      ]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Operazione non completata." }]);
    } finally {
      setActionLoading(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] sm:bottom-7 sm:right-7">
      {open ? (
        <section className="flex h-[min(680px,calc(100dvh-40px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white/95 shadow-[0_24px_90px_rgba(34,16,28,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-[#18171b]/95">
          <header className="flex items-center justify-between border-b border-black/5 bg-gradient-to-r from-[#f69bd1]/18 to-[#edd9a4]/20 px-5 py-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-[#ef93ca] text-white shadow-sm"><Sparkles className="size-5" /></div>
              <div>
                <h2 className="text-sm font-black text-black/90 dark:text-white">Paradise Assistant</h2>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" /> Solo amministrazione</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-black/5 text-black/55 transition hover:bg-black/10 dark:bg-white/10 dark:text-white/60" aria-label="Chiudi assistente"><X className="size-4" /></button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}>
                {message.role === "assistant" ? <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl bg-[#f6d7e9] text-[#a84a83] dark:bg-[#ef93ca]/15 dark:text-[#f3a9d4]"><Bot className="size-4" /></div> : null}
                <div className={message.role === "user"
                  ? "max-w-[84%] rounded-[20px] rounded-br-md bg-[#ef93ca] px-4 py-3 text-sm font-medium leading-relaxed text-white"
                  : "max-w-[86%] rounded-[20px] rounded-tl-md bg-black/[0.045] px-4 py-3 text-sm font-medium leading-relaxed text-black/75 dark:bg-white/[0.07] dark:text-white/80"}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.cards?.length ? <div className="mt-3 grid gap-2">{message.cards.map((card) => {
                    const toneClass = {
                      green: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      amber: "border-amber-200 bg-amber-50 text-amber-900",
                      red: "border-red-200 bg-red-50 text-red-800",
                      violet: "border-violet-200 bg-violet-50 text-violet-800",
                      blue: "border-blue-200 bg-blue-50 text-blue-800",
                      slate: "border-slate-200 bg-slate-50 text-slate-700",
                    }[card.tone];
                    const dateLabel = card.date ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(card.date)) : null;
                    return <div key={card.id} className={`overflow-hidden rounded-2xl border ${toneClass}`}>
                      <div className="flex items-center gap-3 p-3">
                        {card.photoUrl ? <div className="size-12 shrink-0 rounded-2xl bg-cover bg-center shadow-sm ring-2 ring-white" style={{ backgroundImage: `url(${card.photoUrl})` }} aria-label={`Foto di ${card.person}`} /> : <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-base font-black shadow-sm">{card.person.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</div>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-black">{card.person}</p>
                          <p className="mt-0.5 truncate text-[10px] font-bold text-black/50">{card.type} · {card.location}</p>
                        </div>
                        <span className="max-w-28 rounded-full bg-white/75 px-2.5 py-1 text-right text-[9px] font-black uppercase leading-tight shadow-sm">{card.status}</span>
                      </div>
                      {(dateLabel || card.time || card.detail) ? <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-current/10 px-3 py-2 text-[10px] font-bold">
                        {dateLabel ? <span>{dateLabel}</span> : null}
                        {card.time ? <span>Ore {card.time}</span> : null}
                        {card.detail ? <span className="w-full text-black/55">{card.detail}</span> : null}
                      </div> : null}
                    </div>;
                  })}</div> : null}
                  {message.links?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.links.map((link) => (
                    <button key={link.path} type="button" onClick={() => router.push(link.path)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black text-[#a84a83] shadow-sm transition hover:border-[#ef93ca]/50 dark:border-white/10 dark:bg-white/10 dark:text-[#f3a9d4]">
                      {link.label}<ExternalLink className="size-3" />
                    </button>
                  ))}</div> : null}
                  {message.pendingAction ? <div className="mt-3 overflow-hidden rounded-2xl border border-[#ef93ca]/25 bg-white text-black shadow-sm dark:bg-black/20 dark:text-white">
                    <div className="border-b border-black/5 bg-[#fff4fa] px-3 py-2 dark:border-white/10 dark:bg-[#ef93ca]/10">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#a84a83]">Conferma richiesta</p>
                      <p className="mt-0.5 text-xs font-black">A: {message.pendingAction.recipient}</p>
                    </div>
                    <div className="space-y-1.5 px-3 py-3">
                      <p className="text-xs font-black">{message.pendingAction.title}</p>
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-black/60 dark:text-white/60">{message.pendingAction.message}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-black/5 p-2 dark:border-white/10">
                      <button type="button" disabled={Boolean(actionLoading)} onClick={() => void resolveAction(index, message.pendingAction!, "cancel")} className="rounded-xl border border-black/10 px-3 py-2 text-[10px] font-black text-black/55 transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-white/55">Annulla</button>
                      <button type="button" disabled={Boolean(actionLoading)} onClick={() => void resolveAction(index, message.pendingAction!, "confirm")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#ef93ca] px-3 py-2 text-[10px] font-black text-white transition hover:bg-[#dd7eb7] disabled:opacity-50">
                        {actionLoading === message.pendingAction.token ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />} Conferma e invia
                      </button>
                    </div>
                  </div> : null}
                </div>
              </div>
            ))}
            {loading ? <div className="flex items-center gap-2.5 text-xs font-semibold text-black/45 dark:text-white/45"><div className="grid size-7 place-items-center rounded-xl bg-[#f6d7e9] text-[#a84a83]"><LoaderCircle className="size-4 animate-spin" /></div>Sto controllando i dati…</div> : null}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 ? <div className="flex flex-wrap gap-2 px-4 pb-3">{starters.map((starter) => (
            <button key={starter} type="button" onClick={() => void ask(starter)} className="rounded-full border border-[#ef93ca]/25 bg-[#ef93ca]/8 px-3 py-2 text-[11px] font-bold text-[#a84a83] transition hover:bg-[#ef93ca]/15 dark:text-[#f3a9d4]">{starter}</button>
          ))}</div> : null}

          <form onSubmit={submit} className="border-t border-black/5 p-3 dark:border-white/10">
            <div className="flex items-end gap-2 rounded-[22px] border border-black/10 bg-white p-2 shadow-inner focus-within:border-[#ef93ca]/60 dark:border-white/10 dark:bg-white/[0.04]">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(input); }
              }} rows={1} maxLength={2000} placeholder="Chiedi qualcosa sull'attività…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm font-medium text-black/80 outline-none placeholder:text-black/35 dark:text-white dark:placeholder:text-white/30" />
              <button type="submit" disabled={!input.trim() || loading} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#ef93ca] text-white shadow-sm transition hover:bg-[#dd7eb7] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Invia"><Send className="size-4" /></button>
            </div>
            <p className="mt-2 text-center text-[9px] font-semibold text-black/30 dark:text-white/25">Le azioni reali richiedono sempre la tua conferma.</p>
          </form>
        </section>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="group rounded-full bg-[#17151a] p-2.5 text-white shadow-[0_16px_45px_rgba(28,20,26,0.32)] transition hover:-translate-y-0.5 hover:bg-black dark:border dark:border-white/10" aria-label="Apri Paradise Assistant">
          <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#f3a4d2] to-[#db70ad] shadow-inner"><MessageCircleMore className="size-5" /></span>
        </button>
      )}
    </div>
  );
}
