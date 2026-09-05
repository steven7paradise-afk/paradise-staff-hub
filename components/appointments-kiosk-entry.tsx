"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LockKeyhole, X } from "lucide-react";
import { appointmentSalonUrl, type AppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { RemoteControlBridge } from "@/components/remote-control-bridge";

type ActiveWorker = {
  id: string;
  name: string;
  photo_url?: string | null;
  status: string;
  breakStartedAt?: string | null;
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

function formatBreakTimer(startedAt?: string | null, now: number = Date.now()) {
  if (!startedAt) return "00:00";
  const startTime = new Date(startedAt).getTime();
  if (isNaN(startTime)) return "00:00";
  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function AppointmentsKioskEntry({ salone, pcName, remoteTarget }: { salone: AppointmentSalonSlug; pcName?: string; remoteTarget?: string }) {
  const router = useRouter();
  const [workers, setWorkers] = useState<ActiveWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingWorkerId, setSelectingWorkerId] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [pinPrefix, setPinPrefix] = useState("");
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedWorker = workers.find((item) => item.id === selectedWorkerId) || null;

  function addPinDigit(digit: string) {
    if (!selectedWorkerId || selectingWorkerId) return;
    const nextPinPrefix = `${pinPrefix}${digit}`.replace(/\D/g, "").slice(0, 2);
    setPinPrefix(nextPinPrefix);
    setError("");
    if (nextPinPrefix.length === 2 && selectedWorker) {
      // On a two-digit kiosk PIN there is no extra decision to make: submit as
      // soon as the second digit is entered so the user cannot remain stuck on
      // an apparently enabled "Continua" button.
      setSelectingWorkerId(selectedWorker.id);
      window.setTimeout(() => void enter(selectedWorker, nextPinPrefix), 120);
    }
  }

  async function enter(worker: ActiveWorker, enteredPinPrefix = pinPrefix) {
    if (remoteTarget) {
      setSelectingWorkerId(worker.id);
      setError("");
      try {
        const search = `?salone=${encodeURIComponent(salone)}&worker=${encodeURIComponent(worker.name)}&remoteTarget=${encodeURIComponent(remoteTarget)}`;
        const response = await fetch("/api/remote-control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", targetCode: remoteTarget, workerId: worker.id, pathname: "/appointments", search }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Impossibile selezionare il profilo remoto.");
        router.replace(`/appointments${search}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossibile selezionare il profilo remoto.");
        setSelectingWorkerId("");
      }
      return;
    }
    const cleanPinPrefix = enteredPinPrefix.replace(/\D/g, "").slice(0, 2);
    if (!/^\d{2}$/.test(cleanPinPrefix)) {
      setError("Inserisci le prime 2 cifre del PIN.");
      return;
    }
    setSelectingWorkerId(worker.id);
    setError("");
    try {
      const response = await fetch("/api/appointments/pc/select-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: worker.id, salone, pinPrefix: cleanPinPrefix }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Impossibile accedere con questo profilo.");
      const destination = data?.appointmentUrl || appointmentSalonUrl(salone);
      // Keep the root layout mounted so an active screen-share stream survives
      // the transition from profile selection to the appointments board.
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accedere con questo profilo.");
      setSelectingWorkerId("");
    }
  }

  return (
    <main className="relative h-dvh max-h-dvh overflow-hidden bg-[#FFFBF6] text-neutral-900">
      <RemoteControlBridge pcMode={!remoteTarget} />
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
          {pcName ? (
            <div className="mx-auto inline-flex items-center rounded-full border border-[#D8B7A7]/50 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-700 shadow-sm">
              Dispositivo: {pcName}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="size-8 animate-spin text-[#F12D83]" />
            <span className="mt-4 text-xs font-black uppercase tracking-wider text-neutral-400">
              Caricamento personale attivo...
            </span>
          </div>
        ) : workers.length === 0 ? (
          <div className={`mt-12 max-w-xl rounded-2xl border p-5 text-center text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {error || "Nessun membro dello staff risulta timbrato. Effettua prima la timbratura dal tablet."}
          </div>
        ) : (
          <>
          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-bold text-red-800">
              {error}
            </div>
          ) : null}
          <div className="mt-12 grid w-full max-w-7xl grid-cols-2 justify-items-center gap-x-7 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {workers.map((worker) => {
              const photoUrl = resolveDrivePhotoUrl(worker.photo_url || "");
              const firstName = worker.name.split(" ")[0] || worker.name;
              const selected = selectedWorkerId === worker.id;
              const isOnBreak = worker.status === "BREAK" && Boolean(worker.breakStartedAt);

              return (
                <button
                  key={worker.id}
                  type="button"
                  data-remote-worker-choice={remoteTarget ? "true" : undefined}
                  onClick={() => {
                    if (remoteTarget) {
                      void enter(worker);
                      return;
                    }
                    setSelectedWorkerId(worker.id);
                    setPinPrefix("");
                    setError("");
                  }}
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
                    <span className={`absolute right-4 top-3 size-4 rounded-full border-2 border-white shadow-2xs ${isOnBreak ? "bg-amber-400" : "bg-emerald-400"}`} />
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
                  <div className="mt-2 h-6">
                    {isOnBreak ? (
                      <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Pausa {formatBreakTimer(worker.breakStartedAt!, now)}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedWorker ? (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black/28 px-5 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] border border-[#E6CEC4] bg-[#FFFBF6] p-5 text-center shadow-[0_28px_90px_rgba(60,38,28,0.24)]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorkerId("");
                    setPinPrefix("");
                    setError("");
                  }}
                  disabled={Boolean(selectingWorkerId)}
                  className="ml-auto grid size-10 place-items-center rounded-full border border-[#E6CEC4] bg-white/75 text-neutral-700 transition active:scale-95 disabled:opacity-45"
                  aria-label="Chiudi tastierino PIN"
                >
                  <X className="size-5" />
                </button>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
                  Prime 2 cifre PIN
                </p>
                <h3 className="mt-2 font-serif text-3xl font-light text-neutral-950">
                  {selectedWorker.name.split(" ")[0] || selectedWorker.name}
                </h3>
                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-800" role="alert" aria-live="polite">
                    {error}
                  </div>
                ) : null}
                <div className="mx-auto mt-5 grid h-14 w-32 grid-cols-2 items-center gap-3 rounded-2xl border border-[#D8B7A7]/70 bg-white/75 px-4">
                  {[0, 1].map((index) => (
                    <span
                      key={index}
                      className={`mx-auto size-5 rounded-full border-2 ${pinPrefix.length > index ? "border-[#C96F70] bg-[#C96F70]" : "border-neutral-300"}`}
                    />
                  ))}
                </div>
                <div className="mx-auto mt-5 grid w-[252px] grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                      onClick={() => addPinDigit(digit)}
                      className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!pinPrefix || Boolean(selectingWorkerId)}
                    onClick={() => {
                      setPinPrefix((current) => current.slice(0, -1));
                      setError("");
                    }}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                    aria-label="Cancella una cifra"
                  >
                    <X className="size-5" />
                  </button>
                  <button
                    type="button"
                    disabled={pinPrefix.length >= 2 || Boolean(selectingWorkerId)}
                    onClick={() => addPinDigit("0")}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-xl font-black text-neutral-950 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={!pinPrefix || Boolean(selectingWorkerId)}
                    onClick={() => {
                      setPinPrefix("");
                      setError("");
                    }}
                    className="grid h-14 place-items-center rounded-2xl border border-[#D8B7A7]/65 bg-white text-[10px] font-black uppercase tracking-[0.14em] text-neutral-700 shadow-[0_10px_22px_rgba(120,82,64,0.07)] transition active:scale-95 disabled:opacity-35"
                  >
                    Cancella
                  </button>
                </div>
                <button
                  type="button"
                  disabled={pinPrefix.length !== 2 || Boolean(selectingWorkerId)}
                  onClick={() => void enter(selectedWorker)}
                  className="mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-neutral-950 px-6 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                >
                  {selectingWorkerId ? <Loader2 className="size-5 animate-spin" /> : "Continua"}
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </main>
  );
}
