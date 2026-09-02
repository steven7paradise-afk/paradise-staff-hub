"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Monitor, Radio, UserRound } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Target = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  salone: string;
  active: boolean;
  controllerName: string | null;
};

type Worker = { id: string; name: string; photo_url?: string | null; status: string };

export function RemoteControlSetup() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [starting, setStarting] = useState("");
  const [error, setError] = useState("");
  const target = useMemo(() => targets.find((item) => item.id === selectedTargetId) || null, [targets, selectedTargetId]);

  useEffect(() => {
    fetch("/api/remote-control", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Impossibile caricare i PC.");
        setTargets(Array.isArray(data.targets) ? data.targets : []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Impossibile caricare i PC."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!target) return;
    setLoadingWorkers(true);
    setWorkers([]);
    setError("");
    fetch(`/api/appointments/pc/active-staff?salone=${encodeURIComponent(target.salone)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Impossibile caricare i profili.");
        setWorkers(Array.isArray(data) ? data : []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Impossibile caricare i profili."))
      .finally(() => setLoadingWorkers(false));
  }, [target]);

  async function start(worker: Worker) {
    if (!target || starting) return;
    setStarting(worker.id);
    setError("");
    try {
      const search = `?salone=${encodeURIComponent(target.salone)}&remoteTarget=${encodeURIComponent(target.id)}`;
      const response = await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          targetCode: target.id,
          workerId: worker.id,
          pathname: "/appointments",
          search,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile avviare il controllo remoto.");
      window.location.href = `/appointments${search}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile avviare il controllo remoto.");
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
            <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-950 md:text-4xl">Controllo remoto Paradise</h1>
            <p className="mt-2 text-sm font-semibold text-neutral-500">Scegli prima il PC del salone e poi il profilo. Sul PC saranno visibili la pagina, i testi e il tuo puntatore.</p>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-[#FCE6EF] text-xs font-black text-[#C23976]">1</span>
          <h2 className="text-xl font-black text-neutral-950">Seleziona il PC</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-sm font-bold text-neutral-500"><Loader2 className="size-5 animate-spin" /> Caricamento PC autorizzati…</div>
        ) : targets.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Non risultano PC attivati. Attiva prima il computer dalla pagina Dispositivi.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((item) => {
              const selected = item.id === selectedTargetId;
              return (
                <button key={item.id} type="button" onClick={() => setSelectedTargetId(item.id)} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-[#C23976] bg-[#FFF2F7] ring-2 ring-[#C23976]/15" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Monitor className="size-6 text-neutral-900" />
                    {selected ? <CheckCircle2 className="size-5 text-[#C23976]" /> : <span className={`size-2.5 rounded-full ${item.active ? "bg-amber-400" : "bg-emerald-400"}`} />}
                  </div>
                  <p className="mt-4 text-base font-black text-neutral-950">{item.name}</p>
                  <p className="mt-1 text-xs font-bold text-neutral-500">{item.locationName}</p>
                  {item.active ? <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-amber-700">Sessione: {item.controllerName}</p> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {target ? (
        <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[#FCE6EF] text-xs font-black text-[#C23976]">2</span>
            <div><h2 className="text-xl font-black text-neutral-950">Seleziona il profilo</h2><p className="text-xs font-bold text-neutral-500">{target.name} · {target.locationName}</p></div>
          </div>
          {loadingWorkers ? (
            <div className="flex items-center gap-3 py-8 text-sm font-bold text-neutral-500"><Loader2 className="size-5 animate-spin" /> Caricamento personale presente…</div>
          ) : workers.length === 0 ? (
            <p className="rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Nessun lavoratore risulta timbrato in questo momento.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workers.map((worker) => (
                <button key={worker.id} type="button" disabled={Boolean(starting)} onClick={() => void start(worker)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:border-[#C23976] hover:bg-[#FFF2F7] disabled:opacity-50">
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FCE6EF] font-black text-[#C23976]">
                    {worker.photo_url ? <img src={resolveDrivePhotoUrl(worker.photo_url)} alt="" className="size-full object-cover" /> : <UserRound className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-neutral-950">{worker.name}</span><span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-emerald-600">Presente</span></span>
                  {starting === worker.id ? <Loader2 className="size-4 animate-spin" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
