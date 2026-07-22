import { LoginForm } from "@/components/login-form";
import { getBrandingTheme, brandingCss } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const branding = await getBrandingTheme();
  const themeStyles = brandingCss(branding);

  return (
    <main
      className="paradise-theme-root relative min-h-screen overflow-hidden bg-[#FFC5D3] px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-10 transition-colors duration-500"
      style={themeStyles}
    >
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center">
        <div
          className="w-full overflow-hidden rounded-[32px] border border-black/5 bg-[color:var(--card)] shadow-luxury dark:border-white/5 animate-fade-in-up opacity-0"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative flex min-h-[320px] flex-col justify-between overflow-hidden px-5 pb-8 pt-7 text-white sm:min-h-[420px] sm:px-8 sm:pb-10 sm:pt-8 lg:min-h-[720px] lg:px-12 lg:pb-12 lg:pt-10">
              <img
                src="/login-banner.jpg"
                alt="Paradise Extensions"
                className="absolute inset-0 size-full object-cover object-center login-banner-motion"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/80" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#FFB7C9]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/85">
                    Paradise Beauty
                  </span>
                </div>
              </div>

              <div className="relative z-10 mt-auto max-w-md space-y-4 sm:space-y-5">
                <img
                  src={branding.logo_url ?? "/logo.png"}
                  alt="Paradise Logo"
                  className="h-14 w-auto object-contain drop-shadow-md dark:invert sm:h-16"
                />
                <div className="space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.42em] text-[#FFB7C9] sm:text-xs">
                    Staff Hub
                  </p>
                  <h1 className="text-4xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Accedi al tuo spazio Paradise
                  </h1>
                  <p className="max-w-sm text-sm leading-relaxed text-white/80 sm:text-base">
                    Entra con il tuo PIN personale oppure con email e password.
                    La schermata si adatta bene anche da telefono, cosi l&apos;accesso
                    resta semplice e veloce.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2 text-white/90 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Accesso rapido
                    </p>
                    <p className="mt-2 text-sm font-semibold">PIN personale</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Accesso completo
                    </p>
                    <p className="mt-2 text-sm font-semibold">Email e password</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Dispositivi
                    </p>
                    <p className="mt-2 text-sm font-semibold">Desktop e mobile</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-[400px] items-center bg-[color:var(--card)] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-xl">
                <div className="rounded-[28px] border border-black/5 bg-white/92 p-5 shadow-[0_24px_80px_rgba(17,17,17,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/80 sm:p-7 lg:p-9">
                  <div className="mb-6 space-y-3">
                    <div className="inline-flex items-center rounded-full bg-[#FFE7EF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#E684A0]">
                      Login staff
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-extrabold tracking-tight text-[color:var(--text)] sm:text-4xl">
                        Bentornata
                      </h2>
                      <p className="max-w-md text-sm leading-relaxed text-black/55 dark:text-white/55 sm:text-[15px]">
                        Scegli come vuoi entrare. Con PIN vai veloce, con email
                        e password hai l&apos;accesso classico completo.
                      </p>
                    </div>
                  </div>

                  <LoginForm />

                  <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/10">
                    <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35 sm:text-left">
                      Copyright © 2026 Paradise Beauty. Tutti i diritti riservati.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
