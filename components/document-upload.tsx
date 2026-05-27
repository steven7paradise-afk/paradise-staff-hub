"use client";

import { FormEvent, useState } from "react";
import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Select } from "@/components/ui";

type Worker = { id: string; name: string };

export function DocumentUpload({ workers }: { workers: Worker[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/documents", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setStatus(result.error ?? "Documento non caricato.");
    setOpen(false);
    setStatus("Documento caricato e notifica inviata al dipendente.");
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}><Upload className="size-4" /> Carica documento</Button>
        {status ? <p className="rounded-full bg-paradise-nude px-4 py-2 text-sm">{status}</p> : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4">
          <Card className="w-full max-w-lg">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nuovo documento</h2>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl border border-black/10"><X className="size-4" /></button>
            </div>
            <form className="grid gap-3" onSubmit={submit}>
              <Select name="userId" required>
                <option value="">Scegli dipendente</option>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
              </Select>
              <Field name="title" placeholder="Titolo documento" required />
              <Select name="type" defaultValue="BUSTA_PAGA">
                <option value="BUSTA_PAGA">Busta paga</option>
                <option value="CONTRATTO">Contratto</option>
                <option value="DOCUMENTO">Documento</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Field name="month" type="number" min={1} max={12} placeholder="Mese" />
                <Field name="year" type="number" min={2020} max={2100} placeholder="Anno" />
              </div>
              <Field name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
              {status ? <p className="rounded-xl bg-paradise-nude p-3 text-sm">{status}</p> : null}
              <Button type="submit" disabled={loading}>{loading ? "Caricamento..." : "Carica e notifica"}</Button>
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
}
