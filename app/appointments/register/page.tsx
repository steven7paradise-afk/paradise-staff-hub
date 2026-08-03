import { cookies, headers } from "next/headers";
import Link from "next/link";
import { activatePC, appointmentsPcCookieName } from "@/lib/appointments-pc-auth";

export const dynamic = "force-dynamic";

export default async function AppointmentsRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const code = String(resolvedSearchParams?.code || "").trim();

  let error = "";
  let name = "";
  let locationId = "";

  if (!code) {
    error = "Codice di attivazione mancante. Usa un link di registrazione valido.";
  } else {
    try {
      const headersList = await headers();
      const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || null;

      const result = await activatePC(code, ip);
      name = result.name;
      locationId = result.locationId;

      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set(appointmentsPcCookieName, result.accessToken, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Errore durante l'attivazione del dispositivo.";
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6F5] text-neutral-900 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white border border-[#E8D8CF] rounded-[32px] p-8 md:p-10 shadow-soft text-center space-y-6">
        
        {/* Dior Style Logo Emblem */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border border-neutral-300 flex items-center justify-center font-serif text-lg tracking-widest text-neutral-800 bg-[#FAF6F5]">
            P
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-serif font-light tracking-wide uppercase text-neutral-900">
            {error ? "Attivazione Fallita" : "PC Cassa Attivato"}
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dc2626]">
            {error ? "ERRORE DISPOSITIVO" : "DISPOSITIVO ABILITATO"}
          </p>
        </div>

        {error ? (
          <div className="p-4 rounded-2xl bg-[#FFF5F6] border border-[#FADCDD] text-sm text-[#A04E59] font-medium leading-relaxed">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#F6FAF8] border border-[#DCEBE4] text-neutral-800 text-sm font-semibold space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">NOME PC CASSA</div>
              <div className="text-base text-neutral-900 font-serif font-light tracking-wide">{name.toUpperCase()}</div>
            </div>
            
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto font-normal">
              Questo browser è stato registrato ed è ora autorizzato a visualizzare l'agenda appuntamenti senza inserire le credenziali.
            </p>
          </div>
        )}

        <div className="pt-4">
          {error ? (
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition"
            >
              Torna alla dashboard
            </Link>
          ) : (
            <Link
              href="/appointments"
              className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition"
            >
              Accedi all'Agenda
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
