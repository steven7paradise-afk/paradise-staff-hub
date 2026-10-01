"use client";

import { useState } from "react";
import { AppointmentWorkerConfirmation } from "./appointment-worker-confirmation";

export function DevOfficeWorkerPreview() {
  const [open, setOpen] = useState(true);
  const [office, setOffice] = useState(true);
  const [assigned, setAssigned] = useState("");
  return <main className="min-h-screen bg-[#fcf8fa] p-8 text-slate-800">
    <p className="text-sm text-[#995476]">Anteprima locale · Dati di esempio</p>
    <h1 className="my-4 text-2xl font-bold">Scelta della persona che ha eseguito il servizio</h1>
    <label className="flex items-center gap-3"><input type="checkbox" checked={office} onChange={event => setOffice(event.target.checked)} />Profilo della sede Ufficio</label>
    <button className="my-6 rounded-xl border bg-white px-5 py-3" onClick={() => setOpen(true)}>Apri scelta collaboratrice</button>
    {assigned && <p role="status">Servizio assegnato a {assigned} (simulazione locale).</p>}
    {open && <AppointmentWorkerConfirmation name="Nicol" self={{ id: "salon-nicol", name: "Nicol" }} workers={[{ id: "salon-nicol", name: "Nicol", status: "IN" }]} canChooseOfficeStaff={office}
      officeWorkers={[{ id: "office-giuseppe", name: "Giuseppe Ufficio" }, { id: "office-francesca", name: "Francesca Ufficio" }, { id: "office-marta", name: "Marta Ufficio" }]}
      workersLoading={false} workersError="" clientName="Cliente di esempio" loading={false}
      onClose={() => setOpen(false)} onAssign={async worker => { setAssigned(worker.name); setOpen(false); return true; }} />}
  </main>;
}
