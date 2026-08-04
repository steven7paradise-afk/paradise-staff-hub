import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PcNonAutorizzatoPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFBF6] p-6 text-center text-neutral-900">
      <Link
        href="/appointments/buenos-aires?choose=1"
        className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-neutral-950 px-8 text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-[0_22px_45px_rgba(0,0,0,0.18)] transition hover:bg-neutral-800"
      >
        Torna a scegliere il tuo profilo
      </Link>
    </main>
  );
}
