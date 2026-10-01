"use client";

import { useEffect, useState } from "react";
import { ClientControlChecks } from "./client-control-checks";
import { WorkerServiceSections } from "./worker-service-sections";
import { reconcileWorkerServices, parseWorkerServices, type WorkerServiceSection } from "@/lib/worker-service-sections";

const workers = [{ id: "demo-nicol", name: "Nicol" }, { id: "demo-francesca", name: "Francesca" }];
const initial = () => reconcileWorkerServices([], [workers[0].id]);
const storageKey = "paradise-local-worker-services-demo-solo-v2";

export function DevWorkerServicesPreview() {
  const [sections, setSections] = useState<WorkerServiceSection[]>(initial);
  const [checks, setChecks] = useState({ beforeMedia: false, afterMedia: false, products: false, review: false });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSections(reconcileWorkerServices(parseWorkerServices(JSON.parse(raw), [workers[0].id]), [workers[0].id]));
    } catch { /* The demo can start from empty data when storage is unavailable. */ }
    setReady(true);
  }, []);
  function change(next: WorkerServiceSection[]) {
    setSections(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(true); }
    catch { setSaved(false); }
  }
  return <main className="min-h-screen bg-[#f8f6f7] px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-[1480px]">
      <p className="text-xs font-bold uppercase tracking-widest text-[#995476]">Anteprima locale · Dati di esempio</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-800">Dettagli del servizio</h1>
      <p className="mt-2 text-sm text-slate-600">Cliente di esempio nella board di Nicol. Lavora solo Nicol: entrambe le sezioni sono assegnate a lei.</p>
      <div className="my-6 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-emerald-800">{saved ? "Bozza salvata in questo browser" : "Seleziona i servizi e scrivi un dettaglio per ogni lavoratrice."}</p>
        <button type="button" className="rounded-xl border bg-white px-4 py-2 text-sm" onClick={() => change(initial())}>Azzera esempio</button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <WorkerServiceSections completionChecks={<ClientControlChecks values={checks} onChange={(key, checked) => setChecks(current => ({ ...current, [key]: checked }))} />} serviceDate="2026-10-01T10:00:00+02:00" officeNote="CAPELLI IN UFFICIO, VUOLE NICOL" workers={workers} sections={sections} onChange={change} disabled={!ready} />
      </div>
      <p className="mt-5 text-xs text-slate-500">Questa anteprima usa lo stesso modulo degli appuntamenti. I dati di esempio restano nel browser e non vengono inviati al gestionale.</p>
    </div>
  </main>;
}
