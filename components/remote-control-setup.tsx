"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, Loader2, Monitor, Radio, X } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Target = { id: string; name: string; locationName: string; salone: string; active: boolean; mode?: "control" | "observe" | null; online: boolean; controllerName: string | null; current?: boolean };
type Observation = {
  pathname: string;
  search: string;
  pointer: { x: number; y: number } | null;
  scroll: { x: number; y: number } | null;
  lastAction: string | null;
  events: Array<{ kind: string; label: string; at: string }>;
  snapshot: string | null;
  viewport: { width: number; height: number } | null;
  updatedAt: string;
};
type ActiveView = { target: Target; mode: "control" | "observe"; src: string };

export function RemoteControlSetup() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState("");
  const [requested, setRequested] = useState("");
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [observedWorker, setObservedWorker] = useState<{ name: string | null; photo_url: string | null } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let active = true;
    const loadTargets = () => {
      fetch("/api/remote-control", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Impossibile caricare i PC.");
          if (active) setTargets(Array.isArray(data.targets) ? data.targets.map((target: Target) => ({ ...target, current: target.id === data.currentDeviceId })) : []);
        })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Impossibile caricare i PC."); })
        .finally(() => { if (active) setLoading(false); });
    };
    loadTargets();
    const interval = window.setInterval(loadTargets, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!activeView || activeView.mode !== "observe") return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch(`/api/remote-control?mode=observe&targetCode=${encodeURIComponent(activeView.target.id)}`, { cache: "no-store" }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || !data?.session) return;
      const nextObservation = (data.session.observation || null) as Observation | null;
      setObservation(nextObservation);
      setObservedWorker(data.worker || null);
      if (nextObservation?.scroll && iframeRef.current?.contentWindow) {
        const frameWindow = iframeRef.current.contentWindow;
        const frameDocument = frameWindow.document.documentElement;
        frameWindow.scrollTo({
          left: nextObservation.scroll.x * Math.max(0, frameDocument.scrollWidth - frameWindow.innerWidth),
          top: nextObservation.scroll.y * Math.max(0, frameDocument.scrollHeight - frameWindow.innerHeight),
          behavior: "auto",
        });
      }
    };
    void poll();
    const interval = window.setInterval(poll, 650);
    const heartbeat = window.setInterval(() => {
      void fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "observe_heartbeat", targetCode: activeView.target.id }),
      });
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearInterval(heartbeat);
    };
  }, [activeView]);

  useEffect(() => {
    if (!activeView || activeView.mode !== "observe" || !observation) return;
    const params = new URLSearchParams(observation.search || "");
    params.delete("remoteTarget");
    params.delete("observeTarget");
    params.set("remotePreview", "1");
    params.set("remoteTarget", activeView.target.id);
    const src = `${observation.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    setActiveView((current) => current && current.src !== src ? { ...current, src } : current);
  }, [observation]);

  async function openDevice(target: Target) {
    if (starting) return;
    if (!target.online) {
      setError(`“${target.name}” non è collegato. Apri Paradise personale su quel dispositivo e attendi che qui compaia Online.`);
      return;
    }
    setStarting(target.id);
    setError("");
    try {
      const pathname = `/appointments/${target.salone}`;
      const search = `?choose=1&remoteTarget=${encodeURIComponent(target.id)}`;
      const response = await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", targetCode: target.id, workerId: null, pathname, search }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile collegarsi al dispositivo.");
      setActiveView({ target, mode: "control", src: `${pathname}${search}&remoteEmbedded=1` });
      setStarting("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile collegarsi al dispositivo.");
      setStarting("");
    }
  }

  async function observeDevice(target: Target) {
    if (starting) return;
    if (!target.online) {
      setError(`“${target.name}” non è collegato. Apri Paradise personale su quel dispositivo e attendi che qui compaia Online.`);
      return;
    }
    setStarting(target.id);
    setError("");
    try {
      const pathname = `/appointments/${target.salone}`;
      const response = await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "observe_start", targetCode: target.id, workerId: null, pathname, search: "?choose=1" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile avviare l’osservazione.");
      setObservation(null);
      setObservedWorker(null);
      setActiveView({ target, mode: "observe", src: `${pathname}?choose=1&remotePreview=1&remoteTarget=${encodeURIComponent(target.id)}` });
      setStarting("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile avviare l’osservazione.");
      setStarting("");
    }
  }

  async function closeActiveView() {
    if (!activeView) return;
    const targetCode = activeView.target.id;
    setStarting(targetCode);
    await fetch("/api/remote-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", targetCode }),
    }).catch(() => null);
    setActiveView(null);
    setObservation(null);
    setObservedWorker(null);
    setStarting("");
  }

  async function reconnectCurrentDevice(target: Target) {
    if (starting) return;
    setStarting(target.id);
    setError("");
    try {
      const response = await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", targetCode: target.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile ricollegare questo PC.");
      window.location.href = data?.appointmentUrl || `/appointments/${target.salone}?choose=1`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile ricollegare questo PC.");
      setStarting("");
    }
  }

  async function requestReconnect(target: Target) {
    if (starting) return;
    setStarting(target.id);
    setError("");
    try {
      const response = await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_reconnect", targetCode: target.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile inviare la richiesta.");
      setRequested(target.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile inviare la richiesta.");
    } finally {
      setStarting("");
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      {activeView ? (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-[#F5F3F4]">
          <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-neutral-950 px-4 text-white shadow-lg sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`size-2.5 shrink-0 rounded-full ${activeView.target.online ? "bg-emerald-400" : "bg-red-500"}`} />
              {observedWorker?.photo_url ? <img src={resolveDrivePhotoUrl(observedWorker.photo_url)} alt="" className="size-9 rounded-full object-cover" /> : <Monitor className="size-6 shrink-0" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{observedWorker?.name || activeView.target.name}</p>
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">{activeView.mode === "observe" ? "Osservazione" : "Controllo"} · {activeView.target.locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeView.mode === "observe" && observation?.lastAction ? <span className="hidden max-w-md truncate text-xs font-semibold text-white/65 md:block">{observation.lastAction}</span> : null}
              <button type="button" onClick={() => void closeActiveView()} className="grid size-12 place-items-center rounded-2xl border border-white/20 bg-white/10 transition hover:bg-white/20" aria-label="Chiudi e termina sessione"><X className="size-6" /></button>
            </div>
          </header>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
            {activeView.mode === "observe" && observation?.snapshot ? (
              <img src={observation.snapshot} alt={`Schermata di ${observedWorker?.name || activeView.target.name}`} className="size-full select-none object-fill" draggable={false} />
            ) : (
              <iframe ref={iframeRef} key={activeView.src} src={activeView.src} title={`${activeView.mode === "observe" ? "Osservazione" : "Controllo"} ${activeView.target.name}`} className={`size-full border-0 ${activeView.mode === "observe" ? "pointer-events-none select-none" : ""}`} />
            )}
            {activeView.mode === "observe" && observation?.pointer ? (
              <span className="pointer-events-none absolute z-20 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white bg-[#F12D83] shadow-[0_2px_12px_rgba(0,0,0,0.45)]" style={{ left: `${observation.pointer.x * 100}%`, top: `${observation.pointer.y * 100}%` }} />
            ) : null}
            {activeView.mode === "observe" && !observation ? (
              <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm"><div className="flex items-center gap-3 rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white shadow-xl"><Loader2 className="size-5 animate-spin" /> Collegamento…</div></div>
            ) : null}
          </div>
        </div>
      ) : null}
      <header className="rounded-[30px] border border-black/5 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white"><Radio className="size-6" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C23976]">Solo amministratori</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-950 md:text-4xl">Quale dispositivo vuoi aprire?</h1>
            <p className="mt-2 text-sm font-semibold text-neutral-500">Puoi osservare il flusso di lavoro oppure intervenire con il controllo remoto.</p>
          </div>
        </div>
      </header>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
        {loading ? <div className="flex items-center gap-3 py-8 text-sm font-bold text-neutral-500"><Loader2 className="size-5 animate-spin" /> Caricamento dispositivi…</div> : targets.length === 0 ? <p className="rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Non risultano dispositivi attivati.</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((item) => (
              <article key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 transition hover:border-[#C23976] hover:bg-[#FFF2F7]">
                <div className="w-full p-2 text-left">
                  <div className="flex items-start justify-between gap-3"><Monitor className="size-6 text-neutral-900" />{starting === item.id ? <Loader2 className="size-5 animate-spin text-[#C23976]" /> : item.active ? <CheckCircle2 className="size-5 text-amber-500" /> : <span className={`size-2.5 rounded-full ${item.online ? "bg-emerald-400" : "bg-neutral-300"}`} />}</div>
                  <p className="mt-4 text-base font-black text-neutral-950">{item.name}</p>
                  <p className="mt-1 text-xs font-bold text-neutral-500">{item.locationName}</p>
                  {item.current ? <p className="mt-2 inline-flex rounded-full bg-[#FCE6EF] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#A93469]">Questo dispositivo</p> : null}
                  <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${item.online ? "text-emerald-600" : "text-red-500"}`}>{item.online ? "Online" : "Non collegato"}</p>
                  {item.active ? <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-amber-700">{item.mode === "observe" ? "Osservazione" : "Controllo"} attivo · {item.controllerName}</p> : null}
                </div>
                {item.online ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={Boolean(starting)} onClick={() => void observeDevice(item)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:opacity-50">
                      <Eye className="size-4" /> Osserva
                    </button>
                    <button type="button" disabled={Boolean(starting)} onClick={() => void openDevice(item)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-neutral-800 transition hover:border-[#C23976] disabled:opacity-50">
                      <Monitor className="size-4" /> Controlla
                    </button>
                  </div>
                ) : null}
                {!item.online && item.current ? (
                  <button type="button" disabled={Boolean(starting)} onClick={() => void reconnectCurrentDevice(item)} className="mt-2 w-full rounded-xl border border-[#F0C4D7] bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#A93469] disabled:opacity-50">
                    Sono su questo PC · Ricollega
                  </button>
                ) : null}
                {!item.online && !item.current ? (
                  <button type="button" disabled={Boolean(starting)} onClick={() => void requestReconnect(item)} className="mt-2 w-full rounded-xl border border-[#F0C4D7] bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#A93469] disabled:opacity-50">
                    {requested === item.id ? "Richiesta inviata" : "Invia pop-up di ricollegamento"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
