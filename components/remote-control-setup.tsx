"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Monitor, Radio } from "lucide-react";

type Target = { id: string; name: string; locationName: string; salone: string; active: boolean; online: boolean; controllerName: string | null };

export function RemoteControlSetup() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadTargets = () => {
      fetch("/api/remote-control", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Impossibile caricare i PC.");
          if (active) setTargets(Array.isArray(data.targets) ? data.targets : []);
        })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Impossibile caricare i PC."); })
        .finally(() => { if (active) setLoading(false); });
    };
    loadTargets();
    const interval = window.setInterval(loadTargets, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  async function openDevice(target: Target) {
    if (starting) return;
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
      window.location.href = `${pathname}${search}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile collegarsi al dispositivo.");
      setStarting("");
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-[30px] border border-black/5 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white"><Radio className="size-6" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C23976]">Solo amministratori</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-950 md:text-4xl">Quale dispositivo vuoi controllare?</h1>
            <p className="mt-2 text-sm font-semibold text-neutral-500">Clicca sul PC o tablet. Subito dopo entrerai nella sua schermata “Chi vuole usare il gestionale?”.</p>
          </div>
        </div>
      </header>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
        {loading ? <div className="flex items-center gap-3 py-8 text-sm font-bold text-neutral-500"><Loader2 className="size-5 animate-spin" /> Caricamento dispositivi…</div> : targets.length === 0 ? <p className="rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Non risultano dispositivi attivati.</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((item) => (
              <button key={item.id} type="button" disabled={Boolean(starting)} onClick={() => void openDevice(item)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-left transition hover:border-[#C23976] hover:bg-[#FFF2F7] disabled:opacity-55">
                <div className="flex items-start justify-between gap-3"><Monitor className="size-6 text-neutral-900" />{starting === item.id ? <Loader2 className="size-5 animate-spin text-[#C23976]" /> : item.active ? <CheckCircle2 className="size-5 text-amber-500" /> : <span className={`size-2.5 rounded-full ${item.online ? "bg-emerald-400" : "bg-neutral-300"}`} />}</div>
                <p className="mt-4 text-base font-black text-neutral-950">{item.name}</p>
                <p className="mt-1 text-xs font-bold text-neutral-500">{item.locationName}</p>
                <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${item.online ? "text-emerald-600" : "text-neutral-400"}`}>{item.online ? "Online · clicca per entrare" : "Non collegato"}</p>
                {item.active ? <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-amber-700">Controllato da {item.controllerName}</p> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
