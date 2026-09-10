"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  Nfc,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  nextSequentialAttendanceAction,
  type AttendanceActionType,
  type AttendanceStateType,
} from "@/lib/attendance-state";

type TabletDevice = { id: string; name: string; locationName: string };
type ViewState = "loading" | "success" | "complete" | "error";

const actionDetails: Record<AttendanceActionType, { label: string; Icon: typeof LogIn }> = {
  ENTRATA: { label: "Entrata", Icon: LogIn },
  PAUSA: { label: "Pausa", Icon: Coffee },
  RIENTRO: { label: "Rientro", Icon: RefreshCw },
  USCITA: { label: "Uscita", Icon: LogOut },
};

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Timbratura non registrata. Avvicina nuovamente il badge.";
}

export function TabletNfcClock({
  badgeToken,
  device,
}: {
  badgeToken: string;
  device: TabletDevice | null;
}) {
  const startedRef = useRef(false);
  const [state, setState] = useState<ViewState>("loading");
  const [employeeName, setEmployeeName] = useState("");
  const [action, setAction] = useState<AttendanceActionType | null>(null);
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("Lettura del badge in corso…");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (badgeToken) window.history.replaceState({}, "", "/tablet-clock/nfc");

    if (!device) {
      setState("error");
      setMessage("Questo tablet non è autorizzato. Apri prima il link di attivazione sul tablet.");
      return;
    }
    if (!badgeToken) {
      setState("error");
      setMessage("Badge non rilevato. Avvicinalo nuovamente al tablet.");
      return;
    }
    const authorizedDevice = device;

    let active = true;
    let returnTimer: number | undefined;

    async function clockAutomatically() {
      try {
        const identifyResponse = await fetch("/api/attendance/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": authorizedDevice.id },
          body: JSON.stringify({ nfcSerial: badgeToken }),
        });
        const identified = await identifyResponse.json();
        if (!identifyResponse.ok) throw new Error(identified.error || "Badge non riconosciuto.");
        if (!active) return;

        const name = String(identified.employeeName || "");
        setEmployeeName(name);
        const nextAction = nextSequentialAttendanceAction(
          Array.isArray(identified.todayLogs) ? identified.todayLogs : [],
          (identified.status || "OUT") as AttendanceStateType,
        );

        if (!nextAction) {
          setState("complete");
          setMessage("Il turno di oggi risulta già completato.");
          returnTimer = window.setTimeout(() => {
            window.location.replace(`/tablet-clock?device=${encodeURIComponent(authorizedDevice.id)}`);
          }, 3500);
          return;
        }

        setAction(nextAction);
        setMessage(`Registrazione ${actionDetails[nextAction].label.toLowerCase()}…`);
        const clockResponse = await fetch("/api/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": authorizedDevice.id },
          body: JSON.stringify({
            deviceId: authorizedDevice.id,
            employeeId: identified.employeeId,
            nfcSerial: badgeToken,
            type: nextAction,
            note: "Timbratura automatica NFC",
          }),
        });
        const result = await clockResponse.json();
        if (!clockResponse.ok) throw new Error(result.error || "Timbratura non registrata.");
        if (!active) return;

        setTime(String(result.time || ""));
        setState("success");
        setMessage(
          result.lateRequest?.approvalRequired
            ? `Entrata registrata. Il ritardo è stato inviato all’amministrazione.`
            : `${actionDetails[nextAction].label} registrata correttamente.`,
        );
        navigator.vibrate?.([70, 35, 70]);
        returnTimer = window.setTimeout(() => {
          window.location.replace(`/tablet-clock?device=${encodeURIComponent(authorizedDevice.id)}`);
        }, 3500);
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(safeMessage(error));
        navigator.vibrate?.([180, 60, 180]);
      }
    }

    void clockAutomatically();
    return () => {
      active = false;
      if (returnTimer) window.clearTimeout(returnTimer);
    };
  }, [badgeToken, device]);

  const actionInfo = action ? actionDetails[action] : null;
  const MainIcon = state === "success"
    ? CheckCircle2
    : state === "complete"
      ? Clock3
      : state === "error"
        ? ShieldAlert
        : actionInfo?.Icon ?? Nfc;

  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[#fff8fb] px-5 py-8 text-[#241b20]">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-pink-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-rose-100/70 blur-3xl" />

      <section className="relative w-full max-w-md rounded-[32px] border border-pink-100 bg-white p-7 text-center shadow-[0_24px_70px_rgba(116,46,79,0.14)] sm:p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#b33f77]">Paradise Beauty</p>
        <p className="mt-2 text-sm font-medium text-black/45">{device?.locationName ?? "Timbratura NFC"}</p>

        <div className={`mx-auto mt-8 grid size-24 place-items-center rounded-full ${
          state === "success"
            ? "bg-emerald-100 text-emerald-700"
            : state === "complete"
              ? "bg-sky-100 text-sky-700"
              : state === "error"
                ? "bg-red-100 text-red-700"
                : "bg-pink-100 text-[#b33f77]"
        }`}>
          <MainIcon className={`size-11 ${state === "loading" ? "animate-pulse" : ""}`} />
        </div>

        <div className="mt-6 min-h-28" aria-live="polite" aria-atomic="true">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {state === "loading"
              ? actionInfo?.label ?? "Riconoscimento…"
              : state === "error"
                ? "Controlla il badge"
                : employeeName || "Timbratura completata"}
          </h1>
          {employeeName && state === "loading" ? <p className="mt-2 font-semibold text-black/55">{employeeName}</p> : null}
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/55">{message}</p>
          {time ? <p className="mt-3 text-2xl font-black tabular-nums text-[#b33f77]">{time}</p> : null}
        </div>

        {state === "loading" ? (
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-pink-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#c64d87]" />
          </div>
        ) : null}

        {state !== "loading" && device ? (
          <button
            type="button"
            onClick={() => window.location.replace(`/tablet-clock?device=${encodeURIComponent(device.id)}`)}
            className="mt-6 h-12 w-full rounded-2xl bg-[#241b20] px-5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
          >
            Torna alla timbratura
          </button>
        ) : null}

        {state === "error" ? (
          <p className="mt-4 text-xs font-medium text-black/40">Per riprovare, avvicina di nuovo il badge NFC.</p>
        ) : null}
      </section>
    </main>
  );
}
