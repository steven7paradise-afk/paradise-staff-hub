"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Nfc, Loader2, PauseCircle, Search, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";

type Worker = { id: string; name: string; role: string; mansione: string | null; photoUrl: string | null; locationName: string | null; hasBadge: boolean; enabled: boolean; enrolledAt: string | null };
type Reader = EventTarget & {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: { records: Array<{ recordType: "url"; data: string }> }, options?: { signal?: AbortSignal }): Promise<void>;
};
type ReaderConstructor = new () => Reader;

export function NfcBadgeManager({ initialWorkers }: { initialWorkers: Worker[] }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [query, setQuery] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setSupported("NDEFReader" in window), []);
  const filtered = useMemo(() => workers.filter((worker) => `${worker.name} ${worker.locationName ?? ""} ${worker.mansione ?? ""}`.toLowerCase().includes(query.toLowerCase())), [workers, query]);

  async function api(method: string, body: object) {
    const response = await fetch("/api/settings/nfc", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita");
    return data;
  }

  async function enroll(worker: Worker) {
    const NDEFReader = (window as typeof window & { NDEFReader?: ReaderConstructor }).NDEFReader;
    if (!NDEFReader) { setMessage({ ok: false, text: "Apri questa pagina con Chrome su Android e attiva NFC." }); return; }
    setReadingId(worker.id); setMessage(null);
    const controller = new AbortController();
    try {
      const reader = new NDEFReader();
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const badgeToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const badgeUrl = `${window.location.origin}/tablet-clock/nfc?badge=${badgeToken}`;
      setMessage({ ok: true, text: `Avvicina ora la tessera di ${worker.name}. Il vecchio link verrà sostituito.` });
      await reader.write({ records: [{ recordType: "url", data: badgeUrl }] }, { signal: controller.signal });
      const data = await api("POST", { userId: worker.id, badgeToken });
      setWorkers((items) => items.map((item) => item.id === worker.id ? { ...item, hasBadge: true, enabled: true, enrolledAt: data.enrolledAt } : item));
      setMessage({ ok: true, text: `Tessera pronta per ${worker.name}. Da ora basta avvicinarla al tablet.` });
      setReadingId(null);
    } catch { setReadingId(null); setMessage({ ok: false, text: "Permesso NFC non concesso o lettore non disponibile." }); }
  }

  async function testReader() {
    const NDEFReader = (window as typeof window & { NDEFReader?: ReaderConstructor }).NDEFReader;
    if (!NDEFReader) {
      setMessage({ ok: false, text: "Questo browser non può leggere NFC. Apri la pagina con Chrome sul tablet Android." });
      return;
    }
    setTesting(true);
    setMessage({ ok: true, text: "Lettore pronto: avvicina una carta NFC. Il test non salva e non timbra nulla." });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setTesting(false);
      setMessage({ ok: false, text: "Nessuna carta rilevata entro 30 secondi. Premi Testa e riprova." });
    }, 30_000);
    try {
      const reader = new NDEFReader();
      await reader.scan({ signal: controller.signal });
      reader.addEventListener("reading", (event) => {
        window.clearTimeout(timeout);
        controller.abort();
        const records = (event as Event & { message?: { records?: Array<{ recordType?: string }> } }).message?.records ?? [];
        const hasLink = records.some((record) => record.recordType === "url" || record.recordType === "absolute-url");
        setTesting(false);
        setMessage({ ok: true, text: hasLink ? "Tessera rilevata correttamente. È presente un link NFC." : "Tessera rilevata correttamente. Il lettore NFC funziona." });
      }, { once: true });
      reader.addEventListener("readingerror", () => {
        window.clearTimeout(timeout);
        controller.abort();
        setTesting(false);
        setMessage({ ok: false, text: "Carta rilevata ma non leggibile. Riprova appoggiandola ferma sul retro del tablet." });
      }, { once: true });
    } catch (error) {
      window.clearTimeout(timeout);
      setTesting(false);
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      setMessage({ ok: false, text: timedOut ? "Nessuna carta rilevata entro 30 secondi. Premi Testa e riprova." : "NFC bloccato: attivalo nelle impostazioni del tablet e consenti l’accesso a Chrome." });
    }
  }

  async function change(worker: Worker, action: "toggle" | "remove") {
    setBusyId(worker.id); setMessage(null);
    try {
      if (action === "remove") {
        await api("DELETE", { userId: worker.id });
        setWorkers((items) => items.map((item) => item.id === worker.id ? { ...item, hasBadge: false, enabled: false, enrolledAt: null } : item));
        setMessage({ ok: true, text: `Tessera rimossa da ${worker.name}.` });
      } else {
        await api("PATCH", { userId: worker.id, enabled: !worker.enabled });
        setWorkers((items) => items.map((item) => item.id === worker.id ? { ...item, enabled: !worker.enabled } : item));
      }
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Operazione non riuscita" }); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-5">
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="rounded-[28px] border border-pink-100 bg-gradient-to-br from-white to-pink-50 p-6 shadow-sm">
        <div className="flex items-center gap-4"><div className="grid size-14 place-items-center rounded-2xl bg-black text-white"><Nfc className="size-7" /></div><div><h2 className="text-xl font-semibold">Configurazione semplice</h2><p className="mt-1 text-sm text-black/55">Scegli la persona, premi Associa e avvicina la tessera. Il link provvisorio già presente verrà sostituito con il link personale Paradise.</p></div></div>
      </div>
      <div className={`rounded-[28px] border p-5 ${supported ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex gap-3">{supported ? <ShieldCheck className="size-6 text-emerald-700" /> : <TriangleAlert className="size-6 text-amber-700" />}<div className="min-w-0 flex-1"><p className="font-semibold">{supported === null ? "Verifica lettore…" : supported ? "Lettore NFC disponibile" : "Lettore non disponibile in questo browser"}</p><p className="mt-1 text-sm opacity-70">{supported ? "Puoi provare qualsiasi tessera prima di associarla." : "Usa Chrome su Android. Il PIN continua a funzionare."}</p><button type="button" onClick={() => void testReader()} disabled={!supported || testing || readingId !== null} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-40">{testing ? <Loader2 className="size-4 animate-spin" /> : <Nfc className="size-4" />}{testing ? "Avvicina la carta…" : "Testa lettore NFC"}</button></div></div>
      </div>
    </div>
    {message && <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{message.ok ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}{message.text}</div>}
    <label className="flex h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4"><Search className="size-5 text-black/40" /><input className="w-full bg-transparent outline-none" placeholder="Cerca per nome, sede o ruolo" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="grid gap-3 xl:grid-cols-2">{filtered.map((worker) => <article key={worker.id} className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-start gap-4">
      {worker.photoUrl ? <img src={resolveDrivePhotoUrl(worker.photoUrl)} alt="" className="size-12 rounded-full object-cover" /> : <div className="grid size-12 place-items-center rounded-full bg-pink-100 font-bold text-pink-700">{worker.name.slice(0, 1)}</div>}
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{worker.name}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${worker.hasBadge && worker.enabled ? "bg-emerald-100 text-emerald-800" : worker.hasBadge ? "bg-amber-100 text-amber-800" : "bg-black/5 text-black/50"}`}>{worker.hasBadge ? worker.enabled ? "ATTIVA" : "SOSPESA" : "NON ASSOCIATA"}</span></div><p className="mt-1 text-sm text-black/45">{worker.mansione || worker.role} · {worker.locationName || "Nessuna sede"}</p></div>
    </div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => enroll(worker)} disabled={!supported || readingId !== null || busyId !== null} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-40">{readingId === worker.id ? <Loader2 className="size-4 animate-spin" /> : <Nfc className="size-4" />}{worker.hasBadge ? "Sostituisci" : "Associa tessera"}</button>{worker.hasBadge && <><button onClick={() => change(worker, "toggle")} disabled={busyId !== null} className="flex h-11 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-semibold"><PauseCircle className="size-4" />{worker.enabled ? "Sospendi" : "Riattiva"}</button><button aria-label="Rimuovi tessera" onClick={() => change(worker, "remove")} disabled={busyId !== null} className="grid size-11 place-items-center rounded-xl border border-red-200 text-red-600"><Trash2 className="size-4" /></button></>}</div></article>)}</div>
  </div>;
}
