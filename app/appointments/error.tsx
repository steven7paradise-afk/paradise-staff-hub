"use client";
import Link from "next/link";

export default function AppointmentsError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-10">
      <section className="space-y-4 rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Appuntamenti non disponibili al momento</h1>
        <p role="alert" className="text-sm text-neutral-600">Il caricamento non è riuscito. Questo non significa che non ci siano appuntamenti nel periodo selezionato.</p>
        <button onClick={reset} className="rounded-xl bg-[#99345F] px-4 py-3 text-sm font-semibold text-white">Riprova</button>
        <Link href="/appointments" className="ml-4 text-sm underline">Torna a oggi</Link>
      </section>
    </main>
  );
}
