"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="space-y-4 p-6"><p role="alert">Non è stato possibile caricare il riepilogo.</p><button onClick={reset} className="min-h-11 rounded-xl border px-4">Riprova</button><a href="/staff" className="ml-4 underline">Torna a Staff</a></div>; }
