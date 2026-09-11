"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export function BetaLoginExperience({
  logoSrc,
  documentAccessExpired = false,
}: {
  logoSrc: string;
  documentAccessExpired?: boolean;
}) {
  const [loginOpen, setLoginOpen] = useState(documentAccessExpired);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setLoginOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#d98fa6] text-white">
      <Image
        src="/beta-login-hero.png"
        alt="Paradise Beauty"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 size-full object-cover object-[56%_center] sm:object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(54,17,29,0.16)_0%,rgba(54,17,29,0.02)_38%,rgba(44,12,23,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_0%,transparent_34%,rgba(49,13,25,0.16)_100%)]" />

      <section
        aria-hidden={loginOpen}
        className={`relative z-10 flex min-h-[100svh] flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] transition duration-500 sm:px-8 lg:px-12 ${
          loginOpen ? "pointer-events-none scale-[1.015] opacity-0" : "opacity-100"
        }`}
      >
        <header className="flex items-center justify-between">
          <div className="rounded-full border border-white/30 bg-black/10 px-3 py-2 backdrop-blur-md">
            <img
              src={logoSrc}
              alt="Paradise"
              className="h-8 w-auto max-w-[150px] object-contain brightness-0 invert sm:h-10"
            />
          </div>
          <span className="rounded-full border border-white/25 bg-black/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] backdrop-blur-md sm:text-xs">
            Staff Hub · Beta
          </span>
        </header>

        <div className="mt-auto w-full max-w-lg pb-3 sm:pb-6 lg:max-w-xl">
          <div className="mb-6 space-y-3 drop-shadow-[0_3px_18px_rgba(0,0,0,0.28)]">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-white/80">
              Il tuo spazio di lavoro
            </p>
            <h1 className="max-w-xl text-4xl font-black leading-[0.96] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Tutto Paradise, in un solo posto.
            </h1>
            <p className="max-w-md text-sm font-medium leading-relaxed text-white/85 sm:text-base">
              Turni, appuntamenti, task e strumenti operativi sempre con te.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="group flex min-h-14 w-full items-center justify-between rounded-full bg-white px-6 text-base font-black text-[#24181c] shadow-[0_18px_45px_rgba(30,8,17,0.3)] transition hover:scale-[1.01] hover:bg-[#fff7fa] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/55 active:scale-[0.98] sm:max-w-sm"
          >
            Accedi
            <span className="grid size-9 place-items-center rounded-full bg-[#f7d9e3] text-[#9b365c] transition-transform group-hover:translate-x-1">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>

      <section
        aria-hidden={!loginOpen}
        className={`absolute inset-0 z-20 flex items-end bg-[#2f0f1a]/45 p-2 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[3px] transition duration-500 sm:items-center sm:justify-end sm:p-6 lg:p-10 ${
          loginOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Accesso Paradise Staff Hub"
          className={`max-h-[calc(100svh-1rem)] w-full overflow-y-auto overscroll-contain rounded-[30px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-[#251b1f] shadow-[0_28px_90px_rgba(36,8,19,0.38)] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-h-[calc(100svh-3rem)] sm:max-w-[500px] sm:rounded-[36px] sm:px-8 sm:py-8 lg:mr-[4vw] lg:px-10 ${
            loginOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-[105%] scale-[0.98] opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setLoginOpen(false)}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-[#fff7fa] px-4 text-sm font-bold text-black/65 transition hover:border-[#eeb6c9] hover:text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f8c8d8]/70"
            aria-label="Torna alla schermata iniziale"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Indietro
          </button>

          <div className="mb-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <img src={logoSrc} alt="Paradise" className="h-11 w-auto max-w-[170px] object-contain" />
              <span className="rounded-full bg-[#ffe9f0] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-[#b5416f]">
                Beta
              </span>
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#bc4772]">
              Login staff
            </p>
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">Bentornata</h2>
            <p className="mt-2 text-sm leading-relaxed text-black/55">
              Accedi con Face ID, impronta, PIN personale oppure email e password.
            </p>
          </div>

          <LoginForm documentAccessExpired={documentAccessExpired} />

          <p className="mt-6 border-t border-black/5 pt-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-black/30">
            Paradise Beauty · Area riservata allo staff
          </p>
        </div>
      </section>
    </div>
  );
}
