"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Phone, PhoneOff, Mic, MicOff, LogOut, Search, Volume2 } from "lucide-react";
import styles from "./web-calls.module.css";
import { staffPhotoSource } from "@/lib/web-staff-photo";
import { WebChat } from "./web-chat";
import { WebQRLogin } from "./web-qr-login";

type Person = { id: string; name: string; photo_url?: string | null; location?: { name: string } | null };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
type Call = { id: string; callerId: string; calleeId: string; callerName: string; calleeName: string; callerPhoto?: string | null; calleePhoto?: string | null; status: string; expiresAt: number };
async function api(path: string, body?: object) {
  const response = await fetch(`/api/mobile/web-calls/${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || "Connessione non disponibile. Riprova.", response.status);
  return data;
}
function Portrait({ person, large = false }: { person: Pick<Person, "name" | "photo_url"> & { id?: string }; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person.photo_url]);
  return <span className={large ? styles.portraitLarge : styles.portrait}>{person.photo_url && !failed ? <img src={staffPhotoSource(person)} alt="" onError={() => setFailed(true)} /> : person.name.split(" ").slice(0, 2).map(n => n[0]).join("")}</span>;
}
export function WebCalls() {
  const [section, setSection] = useState<"chat" | "calls">("chat");
  const [user, setUser] = useState<Person | null>(null);
  const [checking, setChecking] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [call, setCall] = useState<Call | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [healthy, setHealthy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connection, setConnection] = useState("");
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const tone = useRef<AudioContext | null>(null);
  const revision = useRef(0);
  const acting = useRef(false);
  const releaseLock = useRef<(() => void) | null>(null);


  useEffect(() => { let cancelled = false; api("session").then(d => { if (!cancelled) setUser(d.user); }).catch(() => {}).finally(() => { if (!cancelled) setChecking(false); }); return () => { cancelled = true; }; }, []);
  useEffect(() => { if (!user) return; let cancelled = false; api("directory").then(d => { if (!cancelled) setPeople(d.users); }).catch(e => { if (!cancelled) setError(e.message); }); return () => { cancelled = true; }; }, [user]);
  useEffect(() => {
    if (!user || !ready) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const observed = revision.current;
      try { if (acting.current) return; const data = await api("calls"); if (cancelled || acting.current || observed !== revision.current) return; setEnabled(data.enabled); setHealthy(true); setCall(data.call); }
      catch (e) { if (!cancelled) { setHealthy(false); setError((e as Error).message); if (e instanceof ApiError && e.status === 401) { releaseLock.current?.(); setReady(false); setCall(null); setPeople([]); setUser(null); } } }
      finally { if (!cancelled) timer = setTimeout(poll, 2000); }
    };
    void poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, [user, ready]);

  const callId = call?.id;
  const callStatus = call?.status;
  useEffect(() => {
    if (!callId || callStatus !== "active" || !ready) return;
    const id = callId;
    const audioHost = audio.current; let cancelled = false;
    const activeRoom = new Room(); room.current = activeRoom; setConnection("Connessione audio…"); setMuted(false);
    activeRoom.on(RoomEvent.TrackSubscribed, track => { if (track.kind === Track.Kind.Audio && !cancelled) audioHost?.appendChild(track.attach()); });
    activeRoom.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => el.remove()));
    activeRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!cancelled) setAudioBlocked(!activeRoom.canPlaybackAudio); });
    activeRoom.on(RoomEvent.Reconnecting, () => { if (!cancelled) setConnection("Riconnessione…"); });
    activeRoom.on(RoomEvent.Reconnected, () => { if (!cancelled) setConnection("In chiamata"); });
    activeRoom.on(RoomEvent.Disconnected, () => { if (!cancelled) setConnection("Audio disconnesso. Chiudi e riprova."); });
    void (async () => {
      try {
        const data = await api("calls", { action: "join", id });
        if (cancelled) return;
        await activeRoom.connect(data.url, data.token);
        if (cancelled) { await activeRoom.disconnect(); return; }
        await activeRoom.localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) { setConnection("In chiamata"); setAudioBlocked(!activeRoom.canPlaybackAudio); }
      } catch (e) { if (!cancelled) { setError((e as Error).message); setConnection("Audio non disponibile"); } }
    })();
    return () => { cancelled = true; void activeRoom.disconnect(); if (room.current === activeRoom) room.current = null; audioHost?.replaceChildren(); };
  }, [callId, callStatus, ready]);

  useEffect(() => {
    if (!callId || callStatus !== "ringing" || !ready) return;
    const ring = () => {
      const ctx = tone.current; if (!ctx || ctx.state !== "running") return;
      for (const offset of [0, .28]) {
        const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
        oscillator.frequency.value = 660; gain.gain.value = .12;
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(ctx.currentTime + offset); oscillator.stop(ctx.currentTime + offset + .18);
      }
    };
    ring(); const interval = setInterval(ring, 2200); return () => clearInterval(interval);
  }, [callId, callStatus, ready]);
  useEffect(() => () => { releaseLock.current?.(); void tone.current?.close(); }, []);
  useEffect(() => {
    if (!callId || !ready || (callStatus === "ringing" && call?.callerId !== user?.id)) return;
    const leave = () => { navigator.sendBeacon("/api/mobile/web-calls/calls", new Blob([JSON.stringify({ action: "end", id: callId })], { type: "application/json" })); };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [callId, callStatus, call?.callerId, ready, user?.id]);

  async function run(operation: () => Promise<void>) { if (acting.current) return; acting.current = true; revision.current++; setBusy(true); setError(""); try { await operation(); } catch (e) { setError((e as Error).message); } finally { acting.current = false; revision.current++; setBusy(false); } }
  async function activate() {
    if (!navigator.locks) throw new Error("Usa una versione aggiornata di Safari, Chrome o Edge.");
    const ctx = tone.current ?? new AudioContext(); tone.current = ctx; await ctx.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop());
    await new Promise<void>((resolve, reject) => {
      void navigator.locks.request("myparadise-web-calls", { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error("Le chiamate sono già attive in un’altra scheda. Chiudila e riprova.")); return; }
        setReady(true); resolve(); await new Promise<void>(release => { releaseLock.current = release; });
      }).catch(reject);
    });
  }
  async function action(action: string) {
    if (!call) return;
    if (action === "accept") await tone.current?.resume();
    const data = await api("calls", { action, id: call.id }); setCall(data.call);
  }
  async function start(person: Person) {
    const conversation = await api("directory", { action: "create", kind: "direct", members: [person.id] });
    const data = await api("calls", { action: "start", roomId: conversation.id, id: crypto.randomUUID() }); setCall(data.call);
  }
  const incoming = call?.calleeId === user?.id;
  const peer = call ? { id: incoming ? call.callerId : call.calleeId, name: incoming ? call.callerName : call.calleeName, photo_url: incoming ? call.callerPhoto : call.calleePhoto } : null;
  return <main className={styles.shell}>
    <header className={styles.header}><a href="/my-staff" className={styles.brand}><img src="/logo.png" alt="Paradise Beauty" /><span>MyParadise<small>Il tuo team, anche dal computer</small></span></a>{user && <div className={styles.account}><span>{user.name}</span><button aria-label="Esci" disabled={busy || !!call} onClick={() => void run(async () => { await api("logout", {}); releaseLock.current?.(); setReady(false); setUser(null); setPeople([]); })}><LogOut size={19} /></button></div>}</header>
    {checking ? <p className={styles.loading}>Verifica accesso…</p> : !user ? <WebQRLogin onLogin={setUser} /> : <><nav className={styles.tabs} aria-label="Sezioni"><button aria-pressed={section === "chat" && !call} onClick={() => setSection("chat")}>Chat</button><button aria-pressed={section === "calls" || !!call} onClick={() => setSection("calls")}>Chiamate</button></nav><div hidden={section !== "chat" || !!call}><WebChat active={section === "chat" && !call} userId={user.id} people={people} onExpired={() => { releaseLock.current?.(); setReady(false); setUser(null); }} /></div><div hidden={section !== "calls" && !call}><div className={styles.workspace}>
      <aside className={styles.directory}><h1>Il personale</h1><label className={styles.search}><Search size={19} /><input aria-label="Cerca un collega" placeholder="Cerca un collega" value={search} onChange={e => setSearch(e.target.value)} /></label><div className={styles.people}>{people.filter(p => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(person => <button key={person.id} className={styles.person} disabled={!ready || !healthy || !enabled || busy || !!call} onClick={() => void run(() => start(person))}><Portrait person={person} /><span><strong>{person.name}</strong><small>{person.location?.name || "Paradise Beauty"}</small></span><Phone size={18} aria-label="Chiama" /></button>)}{!people.length && <p className={styles.hint}>Nessun collega disponibile.</p>}</div></aside>
      <section className={styles.stage} aria-label="Chiamate"><div className={styles.status}><span className={ready && healthy && enabled ? styles.online : styles.offline} />{ready ? healthy ? enabled ? "Pronto a ricevere" : "Servizio chiamate non attivo" : "Connessione al servizio…" : "Ricezione non attiva"}</div>
      {peer && call ? <div className={styles.call} aria-live="polite"><Portrait person={peer} large /><h2>{peer.name}</h2><p>{call.status === "ringing" ? incoming ? "Chiamata in arrivo" : "Chiamata in corso…" : connection}</p><div className={styles.controls}>{call.status === "ringing" && incoming && <button className={styles.answer} disabled={busy} onClick={() => void run(() => action("accept"))}><Phone /><span>Rispondi</span></button>}{call.status === "active" && <button disabled={busy || !room.current} onClick={() => void run(async () => { await room.current?.localParticipant.setMicrophoneEnabled(muted); setMuted(!muted); })}>{muted ? <MicOff /> : <Mic />}<span>{muted ? "Attiva microfono" : "Silenzia"}</span></button>}<button className={styles.end} disabled={busy} onClick={() => void run(() => action(incoming && call.status === "ringing" ? "decline" : "end"))}><PhoneOff /><span>{incoming && call.status === "ringing" ? "Rifiuta" : "Termina"}</span></button></div>{audioBlocked && <button className={styles.primary} onClick={() => void run(async () => { await room.current?.startAudio(); setAudioBlocked(false); })}>Attiva audio della chiamata</button>}</div> : <div className={styles.empty}><div className={styles.phoneMark}><Phone size={42} /></div><h2>{ready ? "Siamo in ascolto." : "Le chiamate, qui."}</h2><p>{ready ? "Scegli un collega per chiamare oppure attendi una chiamata in arrivo." : "Attiva audio e microfono per chiamare e ricevere dal computer."}</p>{!ready && <button className={styles.primary} disabled={busy} onClick={() => void run(activate)}><Volume2 size={19} />Attiva le chiamate</button>}<small>Tieni aperta questa pagina. Se chiudi il browser, riceverai sull’app del telefono.</small></div>}
      </section></div></div></>}
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")} aria-label="Chiudi avviso">×</button></div>}<div ref={audio} className={styles.audio} />
  </main>;
}
