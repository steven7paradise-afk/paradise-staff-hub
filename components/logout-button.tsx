"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { endAppointmentWorkerSession } from "@/lib/appointment-logout";

export function LogoutButton({
  className,
  redirectTo,
  skipSignOut = false,
  label = "Esci",
  title = "Esci",
}: {
  className?: string;
  redirectTo?: string;
  skipSignOut?: boolean;
  label?: string;
  title?: string;
}) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const handleLogout = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
    const remoteTarget = new URLSearchParams(window.location.search).get("remoteTarget");
    if (remoteTarget) {
      await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", targetCode: remoteTarget }),
        keepalive: true,
      }).catch(() => undefined);
    }

    const appointmentRedirect = (skipSignOut || pathname?.startsWith("/appointments")) ? await endAppointmentWorkerSession() : null;
    if (redirectTo || appointmentRedirect) {
      if (!skipSignOut) {
        await signOut({ redirect: false });
      }
      window.location.replace(appointmentRedirect || redirectTo!);
      return;
    }

    const isTablet = pathname?.startsWith("/tablet-clock");
    await signOut({ redirect: false });
    window.location.replace(isTablet ? "/tablet-clock" : "/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logout non riuscito. Riprova.");
      inFlight.current = false; setBusy(false);
    }
  };

  return (
    <><button
      type="button"
      disabled={busy}
      data-remote-stop
      className={className || "sidebar-logout mt-5 flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white/55 px-3 py-3 text-sm font-medium text-black/68 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70"}
      onClick={handleLogout}
      title={title}
    >
      <LogOut className="size-4" />
      <span className="sidebar-label">{busy ? "Uscita…" : label}</span>
    </button>
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}</>
  );
}
