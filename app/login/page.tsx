import { LoginForm } from "@/components/login-form";
import { getBrandingTheme, brandingCss } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ documentAccessExpired?: string }>;
}) {
  const params = await searchParams;
  const documentAccessExpired = params.documentAccessExpired === "1";
  const branding = await getBrandingTheme();
  const themeStyles = brandingCss(branding);
  const logoSrc = branding.logo_url ?? "/logo.png";

  return (
    <main
      className="paradise-theme-root relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_15%,#FFE9F0_0,transparent_34%),radial-gradient(circle_at_88%_82%,#EFB1C4_0,transparent_32%),#FFC5D3] px-3 py-3 transition-colors duration-500 sm:px-5 sm:py-5 md:px-8 md:py-8"
      style={themeStyles}
    >
      <div className="pointer-events-none absolute -left-28 top-20 size-72 rounded-full border border-white/35" />
      <div className="pointer-events-none absolute -bottom-36 -right-20 size-96 rounded-full border border-white/30" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-6xl items-center justify-center sm:min-h-[calc(100dvh-2.5rem)] md:min-h-[calc(100dvh-4rem)]">
        <section className="relative flex min-h-[calc(100dvh-1.5rem)] w-full overflow-hidden rounded-[30px] border border-white/25 shadow-[0_28px_90px_rgba(92,40,59,0.24)] sm:min-h-[calc(100dvh-2.5rem)] lg:hidden">
          <img
            src="/login-banner.jpg"
            alt="Paradise Extensions"
            className="absolute inset-0 size-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/48 via-black/62 to-black/82" />

          <div className="relative z-10 flex min-h-[calc(100vh-2rem)] w-full flex-col px-5 py-8 text-white sm:px-7">
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="w-full max-w-sm text-center">
                <img
                  src={logoSrc}
                  alt="Paradise Logo"
                  className="mx-auto mb-8 h-16 w-auto object-contain brightness-0 invert sm:h-20"
                />

                <div className="mb-6 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.38em] text-[#FFD3DF]">
                    Paradise · Staff Hub
                  </p>
                  <h1 className="text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
                    Accedi al tuo spazio
                  </h1>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/78 sm:text-base">
                    Usa Face ID o impronta dal tuo telefono. PIN ed email restano sempre disponibili.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-5">
                  <LoginForm variant="mobile-overlay" documentAccessExpired={documentAccessExpired} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          className="hidden w-full overflow-hidden rounded-[34px] border border-white/40 bg-[color:var(--card)] shadow-[0_34px_110px_rgba(92,40,59,0.22)] dark:border-white/5 lg:block animate-fade-in-up opacity-0"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="grid min-h-[720px] grid-cols-[1.05fr_0.95fr]">
            <div className="relative flex min-h-[720px] flex-col justify-between overflow-hidden px-12 pb-12 pt-10 text-white">
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

              <div className="relative z-10 mt-auto max-w-md space-y-5">
                <img
                  src={logoSrc}
                  alt="Paradise Logo"
                  className="h-16 w-auto object-contain drop-shadow-md dark:invert"
                />
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.42em] text-[#FFB7C9]">
                    Staff Hub
                  </p>
                  <h1 className="text-6xl font-extrabold leading-[0.95] tracking-tight text-white">
                    Accedi al tuo spazio Paradise
                  </h1>
                  <p className="max-w-sm text-base leading-relaxed text-white/80">
                    Dal telefono puoi entrare con Face ID o impronta. PIN ed email
                    rimangono disponibili come accesso alternativo.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 text-white/90">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Dal telefono
                    </p>
                    <p className="mt-2 text-sm font-semibold">Face ID / impronta</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Alternativa rapida
                    </p>
                    <p className="mt-2 text-sm font-semibold">PIN personale</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                      Accesso classico
                    </p>
                    <p className="mt-2 text-sm font-semibold">Email e password</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-[400px] items-center bg-[linear-gradient(145deg,#FFFFFF_0%,#FFF7FA_100%)] px-10 py-10 dark:bg-neutral-950">
              <div className="mx-auto w-full max-w-xl">
                <div className="rounded-[30px] border border-[#F5DCE5] bg-white/94 p-9 shadow-[0_24px_80px_rgba(106,51,70,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/80">
                  <div className="mb-6 space-y-3">
                    <div className="inline-flex items-center rounded-full bg-[#FFE7EF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#E684A0]">
                      Login staff
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-extrabold tracking-tight text-[color:var(--text)]">
                        Bentornata
                      </h2>
                      <p className="max-w-md text-[15px] leading-relaxed text-black/55 dark:text-white/55">
                        Sul tuo telefono usa Face ID o impronta. Puoi sempre entrare
                        anche con PIN oppure email e password.
                      </p>
                    </div>
                  </div>

                  <LoginForm documentAccessExpired={documentAccessExpired} />

                  <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
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
