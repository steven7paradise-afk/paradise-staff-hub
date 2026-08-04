"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, LockKeyhole } from "lucide-react";
import { appointmentSalonUrl, type AppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type ActiveWorker = {
  id: string;
  name: string;
  photo_url?: string | null;
  status: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppointmentsKioskEntry({ salone }: { salone: AppointmentSalonSlug }) {
  const [workers, setWorkers] = useState<ActiveWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingWorkerId, setSelectingWorkerId] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWorkers() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/appointments/pc/active-staff?salone=${salone}`, { cache: "no-store" });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Impossibile recuperare il personale attivo.");
        }
        const data = await response.json();
        if (active) setWorkers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Impossibile caricare il personale attivo.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkers();
    const interval = window.setInterval(loadWorkers, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [salone]);

  async function enter(worker: ActiveWorker) {
    setSelectingWorkerId(worker.id);
    setError("");
    try {
      const response = await fetch("/api/appointments/pc/select-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: worker.id, salone }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile accedere con questo profilo.");
      window.location.href = data?.appointmentUrl || appointmentSalonUrl(salone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accedere con questo profilo.");
      setSelectingWorkerId("");
    }
  }

  return (
    <main className="relative h-dvh max-h-dvh overflow-hidden bg-[#FFFBF6] text-neutral-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.96),rgba(255,251,246,0.86)_42%,rgba(246,229,214,0.38))]" />
      <div className="pointer-events-none absolute -right-32 bottom-[-36%] h-[78vh] w-[52vw] rounded-full border border-[#D8B7A7]/30 shadow-[inset_22px_28px_45px_rgba(195,159,139,0.10)]" />
      <section className="relative flex h-full flex-col items-center px-5 py-8 md:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl space-y-4 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full border border-[#D8B7A7]/40 bg-white/35 text-neutral-950 shadow-[0_14px_40px_rgba(120,82,64,0.08)]">
            <LockKeyhole className="size-7" strokeWidth={1.45} />
          </div>
          <h1 className="font-serif text-5xl font-light leading-tight tracking-normal text-neutral-950 md:text-6xl xl:text-7xl">
            Chi vuole usare il gestionale?
          </h1>
          <p className="text-sm font-medium uppercase tracking-[0.36em] text-neutral-700 md:text-base">
            Seleziona il tuo profilo per continuare.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="size-8 animate-spin text-[#F12D83]" />
            <span className="mt-4 text-xs font-black uppercase tracking-wider text-neutral-400">
              Caricamento personale attivo...
            </span>
          </div>
        ) : error ? (
          <div className="mt-12 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm font-bold text-red-800">
            {error}
          </div>
        ) : workers.length === 0 ? (
          <div className="mt-12 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm font-bold text-amber-900">
            Nessun membro dello staff risulta timbrato. Effettua prima la timbratura dal tablet.
          </div>
        ) : (
          <>
          <div className="mt-12 grid w-full max-w-7xl grid-cols-2 justify-items-center gap-x-7 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {workers.map((worker) => {
              const photoUrl = resolveDrivePhotoUrl(worker.photo_url || "");
              const firstName = worker.name.split(" ")[0] || worker.name;
              const selected = selectedWorkerId === worker.id;

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => setSelectedWorkerId(worker.id)}
                  disabled={Boolean(selectingWorkerId)}
                  className="group flex w-36 min-w-0 flex-col items-center text-center transition hover:-translate-y-1 disabled:pointer-events-none disabled:opacity-70 2xl:w-40"
                >
                  <div className={`relative grid size-36 place-items-center rounded-full border p-2 shadow-[0_18px_42px_rgba(95,58,45,0.08)] transition 2xl:size-40 ${selected ? "border-[#C96F70] bg-[#F8E3DE] ring-4 ring-[#D98A88]/30" : "border-[#E6CEC4] bg-white/50 group-hover:border-[#D9A69A]"}`}>
                    {photoUrl ? (
                      <span className="block size-full overflow-hidden rounded-full">
                        <img src={photoUrl} alt={worker.name} className="size-full scale-125 object-cover object-[50%_24%]" />
                      </span>
                    ) : (
                      <div className="grid size-full place-items-center rounded-full bg-[#FCE6EF] font-serif text-3xl font-semibold text-[#F12D83]">
                        {initials(worker.name)}
                      </div>
                    )}
                    <span className="absolute right-4 top-3 size-4 rounded-full border-2 border-white bg-emerald-400 shadow-2xs" />
                    {selected ? (
                      <span className="absolute -right-2 top-4 grid size-11 place-items-center rounded-full bg-[#C96F70] text-white shadow-[0_10px_25px_rgba(201,111,112,0.28)]">
                        <Check className="size-5" strokeWidth={2} />
                      </span>
                    ) : null}
                    {selectingWorkerId === worker.id ? (
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
                        <Loader2 className="size-7 animate-spin text-[#F12D83]" />
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-4 max-w-full break-words text-sm font-semibold uppercase leading-tight tracking-[0.22em] md:text-base ${selected ? "text-[#C96F70]" : "text-neutral-800"}`}>
                    {firstName}
                  </p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!selectedWorkerId || Boolean(selectingWorkerId)}
            onClick={() => {
              const worker = workers.find((item) => item.id === selectedWorkerId);
              if (worker) void enter(worker);
            }}
            className="mt-10 inline-flex h-20 min-w-[min(92vw,520px)] items-center justify-center gap-8 rounded-2xl bg-neutral-950 px-8 text-sm font-semibold uppercase tracking-[0.28em] text-white shadow-[0_22px_45px_rgba(0,0,0,0.20)] transition hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-35"
          >
            {selectingWorkerId ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <span>
                  {selectedWorkerId
                    ? `Continua come ${workers.find((item) => item.id === selectedWorkerId)?.name.split(" ")[0] || ""}`
                    : "Seleziona un profilo"}
                </span>
                <ArrowRight className="size-7" strokeWidth={1.4} />
              </>
            )}
          </button>
          </>
        )}
      </section>
    </main>
  );
}
