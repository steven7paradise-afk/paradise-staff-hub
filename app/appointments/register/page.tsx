import Link from "next/link";
import { cookies } from "next/headers";
import { appointmentSalonUrl } from "@/lib/appointment-salon-url";
import { appointmentSalonForPC, appointmentsPcCookieName, checkPCAuthorization, normalizePCAccessMode, verifyOneTimeCode, type PCAccessMode } from "@/lib/appointments-pc-auth";
import { PcRegisterForm } from "@/components/pc-register-form";

export const dynamic = "force-dynamic";

export default async function AppointmentsRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const code = String(resolvedSearchParams?.code || "").trim();

  let error = "";
  let pcName = "";
  let existingAppointmentUrl = "";
  let accessMode: PCAccessMode = "worker";

  const cookieStore = await cookies();
  const existingPcAuth = await checkPCAuthorization(cookieStore.get(appointmentsPcCookieName)?.value);
  if (existingPcAuth && (!code || existingPcAuth.code === code) && resolvedSearchParams.activation !== "retry") {
    accessMode = existingPcAuth.accessMode;
    const salon = await appointmentSalonForPC(existingPcAuth.locationId);
    if (salon) existingAppointmentUrl = `${appointmentSalonUrl(salon)}?choose=1`;
  }

  if (resolvedSearchParams.activation === "retry") {
    error = "Impossibile attivare il dispositivo. Riapri il link originale e riprova.";
  } else if (!code) {
    error = "Codice di attivazione mancante. Usa un link di registrazione valido.";
  } else {
    try {
      // Just verify the code exists and is not yet activated.
      // This is a GET request, so we DO NOT consume/activate it here!
      // This prevents link prefetched crawlers (WhatsApp, Skype, Slack) from consuming the code.
      const pc = await verifyOneTimeCode(code);
      pcName = pc.name;
      accessMode = normalizePCAccessMode(pc.accessMode);
    } catch (err) {
      error = err instanceof Error ? err.message : "Errore durante la verifica del codice.";
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6F5] text-neutral-900 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white border border-[#E8D8CF] rounded-[32px] p-8 md:p-10 shadow-soft relative">
        
        {error && existingAppointmentUrl ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full border border-neutral-300 flex items-center justify-center font-serif text-lg tracking-widest text-neutral-800 bg-[#FAF6F5]">
                P
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-serif font-light tracking-wide uppercase text-neutral-900">
                PC Gia Attivato
              </h1>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                DISPOSITIVO ABILITATO
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F6FAF8] border border-[#DCEBE4] text-sm text-neutral-700 font-medium leading-relaxed">
              {accessMode === "reception"
                ? "Questo computer è già autorizzato per la reception. Per accedere, inserisci il tuo PIN personale una volta al giorno."
                : "Questo computer è già autorizzato per i lavoratori. Scegli il tuo profilo e inserisci il PIN personale."}
            </div>

            <div className="pt-4">
              <Link
                href={existingAppointmentUrl}
                className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition"
              >
                {accessMode === "reception" ? "Apri la Reception" : "Scegli profilo staff"}
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-6 text-center">
            {/* Dior Style Logo Emblem */}
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full border border-neutral-300 flex items-center justify-center font-serif text-lg tracking-widest text-neutral-800 bg-[#FAF6F5]">
                P
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-serif font-light tracking-wide uppercase text-neutral-900">
                Attivazione Fallita
              </h1>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dc2626]">
                ERRORE DISPOSITIVO
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF5F6] border border-[#FADCDD] text-sm text-[#A04E59] font-medium leading-relaxed">
              {error}
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed font-normal">
              Il codice di attivazione fornito non è valido, è scaduto o è già stato utilizzato per registrare un altro computer.
            </p>

            <div className="pt-4">
              <Link href="/appointments" className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 hover:bg-neutral-800 text-white py-3.5 px-6 text-xs font-black uppercase tracking-[0.2em] transition">
                Torna agli appuntamenti
              </Link>
            </div>
          </div>
        ) : (
          <PcRegisterForm code={code} initialPcName={pcName} accessMode={accessMode} />
        )}

      </div>
    </div>
  );
}
