"use client";

import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
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
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="fixed inset-y-0 left-0 hidden w-20 bg-gradient-to-b from-[#F8D7EB] via-[#FDE7F3] to-[#F4C6E6] md:block" />
      <section className="relative flex min-h-screen flex-col items-center px-5 py-14 md:ml-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#FADBEA] text-[#F12D83]">
            <LockKeyhole className="size-8" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-normal text-[#171C2A] md:text-4xl">
            Seleziona il tuo profilo per accedere alle prenotazioni
          </h1>
          <p className="text-base font-medium text-[#667085]">
            Per motivi di sicurezza, devi selezionare il tuo profilo utente per continuare.
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
          <div className="mt-12 grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {workers.map((worker) => {
              const photoUrl = resolveDrivePhotoUrl(worker.photo_url || "");
              const firstName = worker.name.split(" ")[0] || worker.name;

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => enter(worker)}
                  disabled={Boolean(selectingWorkerId)}
                  className="group flex min-w-0 flex-col items-center text-center transition hover:-translate-y-1 disabled:pointer-events-none disabled:opacity-70"
                >
                  <div className="relative grid aspect-square w-full max-w-36 place-items-center rounded-full border-[5px] border-[#F9C8DF] bg-white p-1 shadow-[0_10px_28px_rgba(241,45,131,0.12)] transition group-hover:border-[#F12D83]">
                    {photoUrl ? (
                      <img src={photoUrl} alt={worker.name} className="size-full rounded-full object-cover object-top" />
                    ) : (
                      <div className="grid size-full place-items-center rounded-full bg-[#FCE6EF] font-serif text-3xl font-semibold text-[#F12D83]">
                        {initials(worker.name)}
                      </div>
                    )}
                    <span className="absolute right-3 top-2 size-4 rounded-full border-2 border-white bg-emerald-400 shadow-2xs" />
                    {selectingWorkerId === worker.id ? (
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
                        <Loader2 className="size-7 animate-spin text-[#F12D83]" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 max-w-full break-words text-base font-black leading-tight tracking-normal text-[#F12D83] md:text-lg">
                    {firstName}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
