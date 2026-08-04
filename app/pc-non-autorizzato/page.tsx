import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PcNonAutorizzatoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const from = typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : "";

  return (
    <main className="grid min-h-screen place-items-center bg-[#FCE6EF] p-6 text-center text-neutral-900">
      <section className="w-full max-w-lg rounded-[28px] border border-[#F4C9D9] bg-white p-8 shadow-2xl">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#FADBEA] text-[#F12D83]">
          <ShieldAlert className="size-8" strokeWidth={1.8} />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-normal text-neutral-950">
          Pagina non autorizzata
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-neutral-500">
          Questo PC cassa puo usare solo Appuntamenti, Moduli cassa e le schede consentite del salone.
        </p>
        {from ? (
          <p className="mt-4 rounded-2xl border border-[#F4C9D9] bg-[#FFF7FA] px-4 py-3 text-xs font-bold text-[#A15062]">
            Pagina richiesta: {from}
          </p>
        ) : null}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/appointments/buenos-aires?choose=1"
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-neutral-800"
          >
            Scegli profilo
          </Link>
          <Link
            href="/appointments/buenos-aires"
            className="inline-flex items-center justify-center rounded-full border border-[#E8C9D4] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-[#A15062] transition hover:bg-[#FFF7FA]"
          >
            Torna all'agenda
          </Link>
        </div>
      </section>
    </main>
  );
}
