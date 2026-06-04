import { LoginForm } from "@/components/login-form";
import { getBrandingTheme, brandingCss } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const branding = await getBrandingTheme();
  const themeStyles = brandingCss(branding);

  return (
    <main 
      className="paradise-theme-root relative flex min-h-screen items-center justify-center bg-[#FFC5D3] px-4 py-8 md:px-8 md:py-16 transition-colors duration-500"
      style={themeStyles}
    >
      <div className="w-full max-w-5xl rounded-[32px] overflow-hidden bg-[color:var(--card)] shadow-luxury border border-black/5 dark:border-white/5 flex flex-col md:flex-row min-h-[600px] animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
        {/* Left Side: Banner Image */}
        <div className="relative w-full md:w-1/2 flex flex-col justify-end p-8 sm:p-12 min-h-[350px] md:min-h-0 text-white overflow-hidden bg-paradise-noir">
          <img 
            src="/login-banner.jpg" 
            alt="Paradise Extensions" 
            className="absolute inset-0 size-full object-cover object-[center_45%] login-banner-motion" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />
          
          <div className="relative z-10">
            <h2 className="font-serif italic font-extrabold tracking-wider text-4xl sm:text-5xl text-white drop-shadow-md">
              Paradise
            </h2>
            <p className="text-[10px] uppercase tracking-[0.4em] font-black text-paradise-pink drop-shadow-sm mt-1">
              Beauty
            </p>
            <p className="mt-4 text-xs font-semibold text-white/80 max-w-xs leading-relaxed drop-shadow-sm">
              Estensioni premium, lusso nei dettagli e cura esclusiva per la tua bellezza quotidiana.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center bg-[color:var(--card)]/95 backdrop-blur-md">
          <div className="mb-6 flex flex-col items-start">
            <img 
              src={branding.logo_url ?? "/logo.png"} 
              alt="Paradise Logo" 
              className="mb-6 size-16 object-contain shadow-sm ring-1 ring-black/5 transition-transform duration-300 hover:scale-105 dark:invert" 
            />
            <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text)]">
              Benvenuto
            </h1>
            <p className="text-xs font-semibold text-black/45 dark:text-white/40 uppercase tracking-wider mt-2">
              Accedi con le tue credenziali dipendente
            </p>
          </div>
          <LoginForm />
          <p className="mt-6 text-[10px] uppercase tracking-wider text-black/35 dark:text-white/35 font-semibold text-center md:text-left">
            Copyright © 2026 Paradise Beauty. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </main>
  );
}
