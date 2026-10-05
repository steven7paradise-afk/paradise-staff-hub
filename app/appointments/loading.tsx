import Link from "next/link";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6 sm:p-10">
      <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Appuntamenti</h1>
        <p role="status" className="mt-2 text-sm text-neutral-600">Caricamento del periodo selezionato…</p>
        <p className="mt-2 text-sm text-neutral-600">Puoi tornare alla giornata di oggi senza aspettare.</p>
        <Link href="/appointments" className="mt-4 inline-flex rounded-xl bg-[#99345F] px-4 py-3 text-sm font-semibold text-white">Torna a oggi</Link>
      </section>
    </main>
  );
}
