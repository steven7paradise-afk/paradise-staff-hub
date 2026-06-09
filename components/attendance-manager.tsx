"use client";

import { useState } from "react";
import { Pencil, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Select } from "@/components/ui";

type Worker = { id: string; name: string; location: string };
type AttendanceLog = {
  id: string;
  userId: string;
  employee: string;
  location: string;
  device: string;
  type: string;
  timestamp: string;
  time: string;
  note: string;
};

const typeLabels: Record<string, string> = { ENTRATA: "Entrata", PAUSA: "Pausa", RIENTRO: "Rientro", USCITA: "Uscita" };

function inputTimestamp(timestamp = new Date().toISOString()) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AttendanceManager({ workers, initialLogs }: { workers: Worker[]; initialLogs: AttendanceLog[] }) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    userId: workers[0]?.id ?? "",
    type: "ENTRATA",
    timestamp: inputTimestamp(),
    note: "",
  });

  function createLog() {
    setEditingId(null);
    setDraft({ userId: workers[0]?.id ?? "", type: "ENTRATA", timestamp: inputTimestamp(), note: "" });
    setMessage("");
    setOpen(true);
  }

  function editLog(log: AttendanceLog) {
    setEditingId(log.id);
    setDraft({ userId: log.userId, type: log.type, timestamp: inputTimestamp(log.timestamp), note: log.note });
    setMessage("");
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(editingId ? `/api/attendance/manual/${editingId}` : "/api/attendance/manual", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, timestamp: new Date(draft.timestamp).toISOString() }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Timbratura non salvata.");
      return;
    }
    setMessage(editingId ? "Timbratura modificata correttamente." : "Timbratura aggiunta correttamente.");
    setOpen(false);
    const worker = workers.find((item) => item.id === draft.userId);
    const updated: AttendanceLog = {
      id: data.id,
      userId: draft.userId,
      employee: worker?.name ?? "",
      location: worker?.location ?? "",
      device: editingId ? "Correzione manuale Admin" : "Inserimento manuale Admin",
      type: draft.type,
      timestamp: data.timestamp,
      time: data.time,
      note: data.note ?? "",
    };
    setLogs((current) => editingId ? current.map((log) => log.id === editingId ? updated : log) : [updated, ...current]);
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={createLog} disabled={workers.length === 0}><Plus className="size-4" /> Aggiungi timbratura</Button>
        {message ? <p className="rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-semibold dark:bg-neutral-850 dark:text-white">{message}</p> : null}
      </div>
      <Card className="overflow-hidden p-0">
        {logs.length === 0 ? <p className="p-5 text-sm text-black/50 dark:text-white/50">Nessuna timbratura registrata.</p> : null}
        {logs.map((log) => (
          <div key={log.id} className="grid gap-4 border-b border-black/5 dark:border-white/5 p-5 last:border-b-0 md:grid-cols-[1fr_0.65fr_0.7fr_0.7fr_1fr_auto] md:items-center">
            <div>
              <p className="font-semibold">{log.employee}</p>
              <p className="text-sm text-black/50 dark:text-white/50">{log.location}</p>
            </div>
            <Badge>{typeLabels[log.type]}</Badge>
            <p className="text-sm">{new Intl.DateTimeFormat("it-IT").format(new Date(log.timestamp))}</p>
            <p className="text-sm">{log.time}</p>
            <div>
              <p className="text-sm text-black/50 dark:text-white/50">{log.device}</p>
              {log.note ? <p className="line-clamp-1 text-xs text-black/45 dark:text-white/45">{log.note}</p> : null}
            </div>
            <Button variant="soft" onClick={() => editLog(log)}><Pencil className="size-4" /> Modifica</Button>
          </div>
        ))}
      </Card>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 dark:bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl">
            <div className="mb-5 flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Correzione Admin</p>
                <h2 className="mt-2 text-2xl font-semibold">{editingId ? "Modifica timbratura" : "Aggiungi timbratura"}</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 dark:text-white" onClick={() => setOpen(false)}><X className="size-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Lavoratore</span>
                <Select value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })}>
                  {workers.map((worker) => <option key={worker.id} value={worker.id} className="dark:bg-[#201F24] dark:text-white">{worker.name} - {worker.location}</option>)}
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Tipo</span>
                <Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                  <option value="ENTRATA" className="dark:bg-[#201F24] dark:text-white">Entrata</option>
                  <option value="PAUSA" className="dark:bg-[#201F24] dark:text-white">Pausa</option>
                  <option value="RIENTRO" className="dark:bg-[#201F24] dark:text-white">Rientro</option>
                  <option value="USCITA" className="dark:bg-[#201F24] dark:text-white">Uscita</option>
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Data e ora</span>
                <Field type="datetime-local" value={draft.timestamp} onChange={(event) => setDraft({ ...draft, timestamp: event.target.value })} />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Nota</span>
                <Field value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Esempio: uscita dimenticata" />
              </label>
            </div>
            {message ? <p className="mt-4 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium dark:bg-neutral-850 dark:text-white">{message}</p> : null}
            <Button className="mt-5 w-full" onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Salvataggio..." : "Salva timbratura"}</Button>
          </Card>
        </div>
      ) : null}
    </>
  );
}
