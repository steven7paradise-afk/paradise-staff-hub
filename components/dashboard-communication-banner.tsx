"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, Pause, Play } from "lucide-react";
type Item = { id: string; title: string; message: string; backgroundUrl?: string | null };
export function DashboardCommunicationBanner({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const selected = items.find((item) => item.id === activeId);
  const index = selected ? items.indexOf(selected) + 1 : 0;
  const total = items.length + 1;
  function move(direction: number) { const next = (index + direction + total) % total; setActiveId(next ? items[next - 1].id : null); }
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updatePreference(); updateVisibility();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (total <= 1 || paused || interacting || !visible || reducedMotion) return;
    const timer = window.setTimeout(() => {
      const next = (index + 1) % total;
      setActiveId(next ? items[next - 1].id : null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [index, total, items, paused, interacting, visible, reducedMotion]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/notifications/latest", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setItems(Array.isArray(data.communications) ? data.communications : []);
      } catch { /* Preserve loaded banners during temporary outages. */ }
    }
    void load(); const timer = window.setInterval(load, 30000); window.addEventListener("focus", load);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);
  return <div className="relative" role="region" aria-roledescription="carosello" aria-label="Benvenuto e comunicazioni"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest("[data-autoplay-control]")) setPaused(true); }}
    onTouchStart={(event) => { if (!(event.target as HTMLElement).closest("[data-autoplay-control]")) setPaused(true); }}>
    <div hidden={Boolean(selected)}>{children}</div>
    {selected && <section className="relative isolate flex min-h-56 flex-col justify-center overflow-hidden rounded-[28px] bg-[#68233f] px-6 pb-16 pt-7 text-white sm:px-10" aria-label={`Slide ${index + 1} di ${total}`}>
      <img src={selected.backgroundUrl || "/beta-login-hero.png"} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(44,11,28,.96),rgba(65,18,40,.85)_65%,rgba(65,18,40,.5))]" />
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#ffd0e2]"><Megaphone className="size-4" /> Comunicazione allo staff</p>
      <h2 className="mt-3 line-clamp-2 max-w-3xl break-words text-2xl font-semibold sm:text-3xl">{selected.title}</h2>
      <p className="mt-2 line-clamp-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-white/85">{selected.message.split("📄 ALLEGATO DRIVE:")[0]}</p>
      <Link href={`/notifications?communication=${encodeURIComponent(selected.id)}`} className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20">Leggi comunicazione <ArrowRight className="size-4" /></Link>
    </section>}
    {items.length > 0 && <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-full bg-black/45 px-2 py-1 text-white backdrop-blur-sm">
      <button type="button" onClick={() => move(-1)} aria-label="Banner precedente" className="grid size-10 place-items-center rounded-full hover:bg-white/15"><ChevronLeft className="size-4" /></button>
      {total <= 5 && Array.from({ length: total }, (_, position) => <button key={position} type="button" onClick={() => setActiveId(position ? items[position - 1].id : null)} aria-label={position ? `Comunicazione ${position}` : "Benvenuto"} aria-pressed={index === position} className="grid size-8 place-items-center"><span className={`h-2 rounded-full ${index === position ? "w-5 bg-white" : "w-2 bg-white/45"}`} /></button>)}
      <span className="px-1 text-xs tabular-nums" aria-live={paused || reducedMotion ? "polite" : "off"}>{index + 1} / {total}</span>
      <button type="button" onClick={() => move(1)} aria-label="Banner successivo" className="grid size-10 place-items-center rounded-full hover:bg-white/15"><ChevronRight className="size-4" /></button>
      {!reducedMotion && <button data-autoplay-control type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Riprendi scorrimento" : "Metti in pausa lo scorrimento"} className="grid size-10 place-items-center rounded-full hover:bg-white/15">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</button>}
    </div>}
  </div>;
}
