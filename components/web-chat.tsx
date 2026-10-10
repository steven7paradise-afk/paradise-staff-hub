"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, CheckCheck, MessageCircle, Plus, Search, Send, Users, Phone, X, Bell, BellOff, Palette } from "lucide-react";
import { staffPhotoSource } from "@/lib/web-staff-photo";
import { webRequest, connectionMessage } from "@/lib/web-api-response";
import { WebChatComposer } from "./web-chat-composer";
import landscape from "@/assets/chat/paradise-landscape.png";
import portrait from "@/assets/chat/paradise-portrait.png";
import s from "./web-chat.module.css";
type Person = { id: string; name: string; photo_url?: string | null };
type Room = { id: string; title: string; kind: string; members: Person[]; lastMessage: string | null; unread: number; archived: boolean; muted?: boolean; updatedAt: string };
type Message = { id: string; body: string; userId: string; user: Person; createdAt: string; deletedAt?: string | null; readByAll?: boolean; attachment?: { id: string; filename: string; mediaType: string } | null; replyTo?: { body: string; deletedAt?: string | null; user: Person } | null };
async function request(path: string, body?: object) {
  return webRequest(`/api/mobile/web-calls/${path}`, body);
}
function Avatar({ people }: { people: Person[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  return <span className={s.avatar}>{people.slice(0, 3).map(p => { const src = staffPhotoSource(p); return <span key={p.id}>{src && !failed.includes(src) ? <img src={src} alt={p.name} onError={() => setFailed(old => [...old, src])} /> : p.name.split(" ").slice(0, 2).map(n => n[0]).join("")}</span>; })}{!people.length && <Users size={22} />}</span>;
}
const time = (value: string) => new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export function WebChat({ userId, people, active, onExpired, onCall, callBusy }: { userId: string; people: Person[]; active: boolean; onExpired: () => void; onCall: (person: Person) => void; callBusy: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]), [draft, setDraft] = useState("");
  const [details, setDetails] = useState(false), [colorsOpen, setColorsOpen] = useState(false);
  const [chatColor, setChatColor] = useState(""), [messageSearch, setMessageSearch] = useState<string | null>(null);
  const detailsClose = useRef<HTMLButtonElement>(null), contactButton = useRef<HTMLButtonElement>(null);
  const colorKey = `myparadise-chat-color:${userId}:${selected}`;
  useEffect(() => { try { setChatColor(localStorage.getItem(colorKey) || ""); } catch { setChatColor(""); } setDetails(false); setColorsOpen(false); setMessageSearch(null); }, [colorKey]);
  useEffect(() => { if (!details) return; detailsClose.current?.focus(); const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setDetails(false); contactButton.current?.focus(); } }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [details]);
  function changeColor(color: string) { setChatColor(color); try { if (color) localStorage.setItem(colorKey, color); else localStorage.removeItem(colorKey); } catch { /* Still apply for this session. */ } }
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
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
      try { const data = await request("chat"); if (!cancelled) { setRooms(data.rooms); setLoading(false); setError(old => old === connectionMessage ? "" : old); } }
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
        setError(old => old === connectionMessage ? "" : old);
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
  async function upload(file: File, clientId: string) {
    if (!selected || busy || room?.archived) return false;
    const roomId = selected; setBusy(true); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Impossibile leggere l’allegato.")); reader.readAsDataURL(file); });
      await request("files", { roomId, clientId, filename: file.name, data });
      nearBottom.current = true;
      // Polling refreshes the messages without risking a duplicate upload if refreshing fails.
      return true;
    } catch (e) { failure(e); return false; } finally { setBusy(false); }
  }
  async function older() {
    if (!selected || !messages.length || busy) return;
    const id = selected; setBusy(true);
    try { const data = await request(`chat?roomId=${encodeURIComponent(id)}&before=${encodeURIComponent(messages[0].id)}`); if (current.current !== id) return; const height = list.current?.scrollHeight ?? 0; nearBottom.current = false; setMessages(old => { const ids = new Set(old.map(m => m.id)); return [...data.messages.filter((m: Message) => !ids.has(m.id)), ...old]; }); setMore(data.hasMore); requestAnimationFrame(() => { if (list.current) list.current.scrollTop += list.current.scrollHeight - height; }); }
    catch (e) { failure(e); } finally { setBusy(false); }
  }
  const peer = room?.members.find(p => p.id !== userId);
  const commonGroups = rooms.filter(r => r.kind !== "direct" && r.id !== selected && r.members.some(p => p.id === peer?.id));
  const shownMessages = messageSearch ? messages.filter(m => !m.deletedAt && m.body.toLocaleLowerCase().includes(messageSearch.toLocaleLowerCase())) : messages;
  async function toggleMute() { if (!room || busy) return; setBusy(true); try { await request("chat", { action: "mute", roomId: room.id, muted: !room.muted }); setRooms(old => old.map(r => r.id === room.id ? {...r, muted: !room.muted} : r)); } catch(e) { failure(e); } finally { setBusy(false); } }
  const visibleRooms = rooms.filter(r => r.title.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "unread" ? r.unread > 0 : r.kind !== "direct")));
  return <div className={`${s.layout} ${selected ? s.hasSelection : ""}`}>
    <aside className={s.sidebar}><div className={s.title}><h1>{creating ? "Nuova chat" : "MyParadise"}</h1><button aria-label={creating ? "Mostra conversazioni" : "Nuova chat"} onClick={() => setCreating(!creating)}>{creating ? <ArrowLeft /> : <Plus />}</button></div><label className={s.search}><Search size={18} /><input aria-label="Cerca chat o collega" placeholder={creating ? "Cerca un collega" : "Cerca o avvia una nuova chat"} value={search} onChange={e => setSearch(e.target.value)} /></label>
    {!creating && <div className={s.filters} aria-label="Filtra conversazioni">{([ ["all", "Tutte"], ["unread", "Da leggere"], ["groups", "Gruppi"] ] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{value === "unread" && rooms.some(r => r.unread > 0) && <span>{rooms.filter(r => r.unread > 0).length}</span>}</button>)}</div>}
    <div className={s.rooms}>{creating ? people.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button className={s.row} key={p.id} disabled={busy} onClick={async () => { setBusy(true); try { const data = await request("directory", { action: "create", kind: "direct", members: [p.id] }); const updated = await request("chat"); setRooms(updated.rooms); setBusy(false); open(data.id); setSearch(""); } catch (e) { failure(e); } finally { setBusy(false); } }}><Avatar people={[p]} /><strong>{p.name}</strong></button>) : visibleRooms.map(r => <button key={r.id} className={`${s.row} ${r.id === selected ? s.selected : ""}`} disabled={busy} onClick={() => open(r.id)}><Avatar people={r.members.filter(p => p.id !== userId)} /><span className={s.summary}><strong>{r.title}</strong><small>{r.lastMessage || "Inizia la conversazione"}</small></span><span className={s.meta}><time>{time(r.updatedAt)}</time>{r.unread > 0 && <b aria-label={`${r.unread} messaggi non letti`}>{r.unread}</b>}</span></button>)}{!creating && !visibleRooms.length && <p className={s.hint}>{loading ? "Caricamento conversazioni…" : rooms.length ? "Nessuna chat corrisponde al filtro." : "Nessuna conversazione. Premi + per scrivere a un collega."}</p>}</div></aside>
    <section className={s.conversation} aria-label="Conversazione" style={{ "--chat-landscape": `url("${landscape.src}")`, "--chat-portrait": `url("${portrait.src}")`, ...(chatColor ? { "--ownBubble": chatColor, "--customBubbleInk": "#fff", "--customBubbleMuted": "#e3dce4" } : {}) } as CSSProperties}>{room ? <><header className={s.chatHeader}><button aria-label="Torna alle chat" onClick={() => { if (!busy) setSelected(null); }}><ArrowLeft /></button><button ref={contactButton} className={s.contactButton} aria-label={`Informazioni su ${room.title}`} onClick={() => setDetails(true)}><Avatar people={room.members.filter(p => p.id !== userId)} /><span><h2>{room.title}</h2><small>{room.archived ? "Conversazione archiviata" : room.kind === "direct" ? "Chat privata" : `${room.members.length} partecipanti`}</small></span></button>{room.kind === "direct" && !room.archived && room.members.find(p => p.id !== userId) && <button className={s.callButton} aria-label={`Chiama ${room.title}`} title={`Chiama ${room.title}`} disabled={callBusy} onClick={() => onCall(room.members.find(p => p.id !== userId)!)}><Phone size={21} /></button>}</header>
      {messageSearch !== null && <div className={s.messageSearch}><Search size={18}/><input autoFocus aria-label="Cerca nei messaggi caricati" placeholder="Cerca nei messaggi caricati…" value={messageSearch} onChange={e => setMessageSearch(e.target.value)} /><button aria-label="Chiudi ricerca" onClick={() => setMessageSearch(null)}><X size={18}/></button></div>}
      <div className={s.messageArea}><div className={s.wallpaper} aria-hidden="true"/><div ref={list} className={s.messages} onScroll={() => { const el = list.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
        {more && <button className={s.older} disabled={busy} onClick={() => void older()}>Messaggi precedenti</button>}{!loaded && !messages.length && <p className={s.hint}>Apertura conversazione…</p>}{loaded && !messages.length && <p className={s.hint}>Scrivi il primo messaggio.</p>}
        {shownMessages.map((m, index) => <div key={m.id}>{(index === 0 || new Date(shownMessages[index - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()) && <div className={s.date}>{new Date(m.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</div>}<article className={`${s.bubble} ${m.userId === userId ? s.mine : ""}`}>{room.kind !== "direct" && m.userId !== userId && <strong className={s.sender}>{m.user.name}</strong>}{m.replyTo && <blockquote>{m.replyTo.user.name}<br />{m.replyTo.deletedAt ? "Messaggio eliminato" : m.replyTo.body}</blockquote>}{m.deletedAt ? <i>Messaggio eliminato</i> : m.attachment ? m.attachment.mediaType.startsWith("audio/") ? <audio className={s.audioMessage} controls preload="none" aria-label="Messaggio vocale" src={`/api/mobile/web-calls/files?id=${encodeURIComponent(m.attachment.id)}`} /> : <a href={`/api/mobile/web-calls/files?id=${encodeURIComponent(m.attachment.id)}`} target="_blank" rel="noreferrer">{m.attachment.mediaType.startsWith("image/") && <img loading="lazy" className={s.attachment} src={`/api/mobile/web-calls/files?id=${encodeURIComponent(m.attachment.id)}`} alt={m.attachment.filename} />}{m.attachment.filename}</a> : <p>{m.body}</p>}<footer><time dateTime={m.createdAt}>{time(m.createdAt)}</time>{m.userId === userId && (m.readByAll ? <CheckCheck size={15} aria-label="Letto" className={s.read} /> : <Check size={15} aria-label="Inviato" />)}</footer></article></div>)}
      </div></div><WebChatComposer key={room.id} draft={draft} setDraft={setDraft} disabled={busy || room.archived} onSend={() => void send()} onFile={upload} onError={setError} />{details && <div className={s.contactPanel} role="region" aria-label="Informazioni contatto">
        <header><button ref={detailsClose} aria-label="Chiudi informazioni" onClick={() => { setDetails(false); contactButton.current?.focus(); }}><ArrowLeft size={22}/></button><span>{room.kind === "direct" ? "Info contatto" : "Info gruppo"}</span></header>
        <div className={s.contactHero}><Avatar people={room.members.filter(p => p.id !== userId)}/><h2>{room.title}</h2><p>{room.kind === "direct" ? "Collega · MyParadise" : `${room.members.length} partecipanti`}</p></div>
        <div className={s.contactActions}>{room.kind === "direct" && peer && !room.archived && <button disabled={callBusy} onClick={() => onCall(peer)}><Phone size={22}/><span>Audio</span></button>}<button disabled={busy} onClick={() => void toggleMute()}>{room.muted ? <BellOff size={22}/> : <Bell size={22}/>}<span>{room.muted ? "Riattiva" : "Silenzia"}</span></button><button onClick={() => { setDetails(false); setMessageSearch(""); }}><Search size={22}/><span>Cerca</span></button></div>
        <div className={s.contactCard}><button className={s.detailRow} aria-expanded={colorsOpen} onClick={() => setColorsOpen(!colorsOpen)}><Palette size={20}/><span>Colore chat</span><i style={{background:chatColor || "var(--ownBubble)"}}/></button>{colorsOpen && <div className={s.colorOptions}><p>Colore dei tuoi messaggi su questo browser.</p>{[["", "Paradise"], ["#583249", "Rosa"], ["#334e68", "Blu"], ["#335548", "Verde"], ["#514167", "Viola"], ["#61513a", "Sabbia"]].map(([color,name]) => <button key={name} aria-label={name} aria-pressed={chatColor === color} onClick={() => changeColor(color)}><i style={{background:color || "#bd3269"}}/>{name}</button>)}</div>}<button className={s.detailRow} disabled={busy} onClick={() => void toggleMute()}><Bell size={20}/><span>Notifiche messaggi</span><small>{room.muted ? "Disattivate" : "Attive"}</small></button></div>
        <h3>{room.kind === "direct" ? `Gruppi in comune (${commonGroups.length})` : "Partecipanti"}</h3><div className={s.contactCard}>{room.kind === "direct" ? commonGroups.length ? commonGroups.map(group => <button className={s.detailRow} key={group.id} onClick={() => open(group.id)}><Avatar people={group.members.filter(p => p.id !== userId)}/><span>{group.title}</span></button>) : <p className={s.hint}>Nessun gruppo in comune tra le tue conversazioni.</p> : room.members.map(person => <div key={person.id} className={s.detailRow}><Avatar people={[person]}/><span>{person.name}</span></div>)}</div>
      </div>}</> : <div className={s.empty}><div className={s.emptyLogo}><img src="/logo.png" alt="Paradise Beauty" /><MessageCircle size={30} /></div><h2>Il tuo team, sempre vicino.</h2><p>Messaggi e chiamate di lavoro, in un unico posto. Scegli una conversazione per iniziare.</p><button onClick={() => { setCreating(true); setSearch(""); }}><Plus size={18} />Nuova conversazione</button><small>Collegato al tuo account MyParadise</small></div>}{error && <div role="alert" className={s.error}>{error}<button onClick={() => setError("")} aria-label="Chiudi avviso">×</button></div>}</section>
  </div>;
}
