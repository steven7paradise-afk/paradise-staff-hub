"use client";
export default function RegisterError({ reset }: { reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-lg p-6 text-slate-900"><h2 className="text-lg font-semibold">Registro non disponibile</h2><p className="mt-2 text-sm text-slate-500">Non è stato possibile caricare le presenze. Riprova: nessun dato è stato modificato.</p><button onClick={reset} className="mt-4 min-h-11 rounded-lg bg-[#171717] px-5 text-sm font-medium text-white">Riprova</button></section>;
}
