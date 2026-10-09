"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, MessageCircle, Plus, Search, Send, Users } from "lucide-react";
import { staffPhotoSource } from "@/lib/web-staff-photo";
import s from "./web-chat.module.css";
type Person = { id: string; name: string; photo_url?: string | null };
type Room = { id: string; title: string; kind: string; members: Person[]; lastMessage: string | null; unread: number; archived: boolean; updatedAt: string };
type Message = { id: string; body: string; userId: string; user: Person; createdAt: string; deletedAt?: string | null; readByAll?: boolean; attachment?: { id: string; filename: string; mediaType: string } | null; replyTo?: { body: string; deletedAt?: string | null; user: Person } | null };
async function request(path: string, body?: object) {
  const res = await fetch(`/api/mobile/web-calls/${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || "Chat non disponibile. Riprova."), { status: res.status });
  return data;
}
function Avatar({ people }: { people: Person[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  return <span className={s.avatar}>{people.slice(0, 3).map(p => { const src = staffPhotoSource(p); return <span key={p.id}>{src && !failed.includes(src) ? <img src={src} alt={p.name} onError={() => setFailed(old => [...old, src])} /> : p.name.split(" ").slice(0, 2).map(n => n[0]).join("")}</span>; })}{!people.length && <Users size={22} />}</span>;
}
const time = (value: string) => new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export function WebChat({ userId, people, active, onExpired }: { userId: string; people: Person[]; active: boolean; onExpired: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]), [draft, setDraft] = useState("");
  const [search, setSearch] = useState(""), [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null), nearBottom = useRef(true), seen = useRef("");
  const current = useRef(selected); current.current = selected;
  const expire = useRef(onExpired); expire.current = onExpired;
  const pending = useRef<{ roomId: string; body: string; clientId: string } | null>(null);
  const room = rooms.find(r => r.id === selected);
  function failure(e: unknown) { const err = e as Error & { status?: number }; setError(err.message); if (err.status === 401) expire.current(); }
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const data = await request("chat"); if (!cancelled) { setRooms(data.rooms); setLoading(false); } }
      catch (e) { if (!cancelled) { failure(e); setLoading(false); } }
      finally { if (!cancelled) timer = setTimeout(refresh, 4000); }
    }
    void refresh(); return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);
  useEffect(() => {
    if (!selected || !active) return;
    let cancelled = false; let first = true; let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const data = await request(`chat?roomId=${encodeURIComponent(selected!)}`);
        if (cancelled) return;
        setMessages(old => { const ids = new Set(data.messages.map((m: Message) => m.id)); return [...old.filter(m => !ids.has(m.id) && m.createdAt < (data.messages[0]?.createdAt ?? "")), ...data.messages]; });
        setLoaded(true); if (first) { setMore(data.hasMore); first = false; }
        const last = data.messages.at(-1);
        if (last && document.visibilityState === "visible" && nearBottom.current && seen.current !== last.id) {
          await request("chat", { action: "read", roomId: selected, messageId: last.id });
          if (!cancelled) { seen.current = last.id; setRooms(old => old.map(r => r.id === selected ? { ...r, unread: 0 } : r)); }
        }
      } catch (e) { if (!cancelled) failure(e); }
      finally { if (!cancelled) timer = setTimeout(refresh, 2500); }
    }
    void refresh(); return () => { cancelled = true; clearTimeout(timer); };
  }, [selected, active]);
  useEffect(() => { if (nearBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages]);
  function open(id: string) { if (busy) return; if (id === selected) { setCreating(false); return; } setSelected(id); setMessages([]); setLoaded(false); setMore(false); setDraft(""); setError(""); seen.current = ""; nearBottom.current = true; pending.current = null; setCreating(false); }
  async function send() {
    const body = draft.trim(); if (!selected || !body || busy) return;
    const roomId = selected; setBusy(true); setError("");
    if (pending.current?.roomId !== roomId || pending.current.body !== body) pending.current = { roomId, body, clientId: crypto.randomUUID() };
    try { const data = await request("chat", { action: "send", ...pending.current }); if (current.current === roomId) { nearBottom.current = true; setMessages(old => [...old.filter(m => m.id !== data.message.id), data.message]); setDraft(""); } pending.current = null; }
    catch (e) { failure(e); } finally { setBusy(false); }
  }
  async function older() {
    if (!selected || !messages.length || busy) return;
    const id = selected; setBusy(true);
    try { const data = await request(`chat?roomId=${encodeURIComponent(id)}&before=${encodeURIComponent(messages[0].id)}`); if (current.current !== id) return; const height = list.current?.scrollHeight ?? 0; nearBottom.current = false; setMessages(old => { const ids = new Set(old.map(m => m.id)); return [...data.messages.filter((m: Message) => !ids.has(m.id)), ...old]; }); setMore(data.hasMore); requestAnimationFrame(() => { if (list.current) list.current.scrollTop += list.current.scrollHeight - height; }); }
    catch (e) { failure(e); } finally { setBusy(false); }
  }
  return <div className={`${s.layout} ${selected ? s.hasSelection : ""}`}>
    <aside className={s.sidebar}><div className={s.title}><h1>{creating ? "Nuova chat" : "Chat"}</h1><button aria-label={creating ? "Mostra conversazioni" : "Nuova chat"} onClick={() => setCreating(!creating)}>{creating ? <ArrowLeft /> : <Plus />}</button></div><label className={s.search}><Search size={18} /><input aria-label="Cerca chat o collega" placeholder={creating ? "Cerca un collega" : "Cerca una conversazione"} value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className={s.rooms}>{creating ? people.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button className={s.row} key={p.id} disabled={busy} onClick={async () => { setBusy(true); try { const data = await request("directory", { action: "create", kind: "direct", members: [p.id] }); const updated = await request("chat"); setRooms(updated.rooms); setBusy(false); open(data.id); setSearch(""); } catch (e) { failure(e); } finally { setBusy(false); } }}><Avatar people={[p]} /><strong>{p.name}</strong></button>) : rooms.filter(r => r.title.toLowerCase().includes(search.toLowerCase())).map(r => <button key={r.id} className={`${s.row} ${r.id === selected ? s.selected : ""}`} disabled={busy} onClick={() => open(r.id)}><Avatar people={r.members.filter(p => p.id !== userId)} /><span className={s.summary}><strong>{r.title}</strong><small>{r.lastMessage || "Inizia la conversazione"}</small></span><span className={s.meta}><time>{time(r.updatedAt)}</time>{r.unread > 0 && <b aria-label={`${r.unread} messaggi non letti`}>{r.unread}</b>}</span></button>)}{!creating && !rooms.length && <p className={s.hint}>{loading ? "Caricamento conversazioni…" : "Nessuna conversazione. Premi + per scrivere a un collega."}</p>}</div></aside>
    <section className={s.conversation} aria-label="Conversazione">{room ? <><header className={s.chatHeader}><button aria-label="Torna alle chat" onClick={() => { if (!busy) setSelected(null); }}><ArrowLeft /></button><Avatar people={room.members.filter(p => p.id !== userId)} /><div><h2>{room.title}</h2><small>{room.archived ? "Conversazione archiviata" : room.kind === "direct" ? "Chat privata" : `${room.members.length} partecipanti`}</small></div></header>
      <div ref={list} className={s.messages} onScroll={() => { const el = list.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
        {more && <button className={s.older} disabled={busy} onClick={() => void older()}>Messaggi precedenti</button>}{!loaded && !messages.length && <p className={s.hint}>Apertura conversazione…</p>}{loaded && !messages.length && <p className={s.hint}>Scrivi il primo messaggio.</p>}
        {messages.map((m, index) => <div key={m.id}>{(index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()) && <div className={s.date}>{new Date(m.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</div>}<article className={`${s.bubble} ${m.userId === userId ? s.mine : ""}`}>{room.kind !== "direct" && m.userId !== userId && <strong className={s.sender}>{m.user.name}</strong>}{m.replyTo && <blockquote>{m.replyTo.user.name}<br />{m.replyTo.deletedAt ? "Messaggio eliminato" : m.replyTo.body}</blockquote>}{m.deletedAt ? <i>Messaggio eliminato</i> : m.attachment ? <a href={`/api/mobile/web-calls/files?id=${encodeURIComponent(m.attachment.id)}`} target="_blank" rel="noreferrer">{m.attachment.mediaType.startsWith("image/") && <img loading="lazy" className={s.attachment} src={`/api/mobile/web-calls/files?id=${encodeURIComponent(m.attachment.id)}`} alt={m.attachment.filename} />}{m.attachment.filename}</a> : <p>{m.body}</p>}<footer><time dateTime={m.createdAt}>{time(m.createdAt)}</time>{m.userId === userId && (m.readByAll ? <CheckCheck size={15} aria-label="Letto" className={s.read} /> : <Check size={15} aria-label="Inviato" />)}</footer></article></div>)}
      </div><form className={s.composer} onSubmit={e => { e.preventDefault(); void send(); }}><textarea aria-label="Messaggio" placeholder={room.archived ? "Chat archiviata" : "Scrivi un messaggio…"} maxLength={4000} disabled={busy || room.archived} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} rows={1} /><button aria-label="Invia messaggio" disabled={busy || room.archived || !draft.trim()}><Send size={21} /></button></form></> : <div className={s.empty}><MessageCircle size={48} /><h2>Le tue conversazioni</h2><p>Scegli una chat o un gruppo per leggere e scrivere al tuo team.</p></div>}{error && <div role="alert" className={s.error}>{error}<button onClick={() => setError("")} aria-label="Chiudi avviso">×</button></div>}</section>
  </div>;
}
