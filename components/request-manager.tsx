"use client";

import { useState } from "react";
import { Check, Send, X, Flag } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";

type RequestRecord = {
  id: string;
  employee: string;
  type: "FERIE" | "PERMESSO" | "RIPOSO" | "MALATTIA" | "ALTRO";
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
};

const typeLabels = { FERIE: "Ferie", PERMESSO: "Permesso", RIPOSO: "Riposo", MALATTIA: "Malattia", ALTRO: "Altro" };
const statusLabels = { PENDING: "In attesa", APPROVED: "Approvata", REJECTED: "Rifiutata", FLAGGED: "Segnalata" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function RequestManager({ initialRequests, role }: { initialRequests: RequestRecord[]; role: Role }) {
  const [requests, setRequests] = useState(initialRequests);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ type: "FERIE", startDate: "", endDate: "", reason: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const employeeView = role === "DIPENDENTE";
  const canApprove = role === "ADMIN" || role === "SUPER_ADMIN";

  async function createRequest() {
    if (!form.startDate || !form.endDate) {
      setMessage("Scegli la data iniziale e finale.");
      return;
    }
    setSaving("create");
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Richiesta non salvata.");
      return;
    }
    setRequests((current) => [{
      id: data.id,
      employee: data.user.name,
      type: data.type,
      startDate: data.start_date,
      endDate: data.end_date,
      reason: data.reason,
      status: data.status,
    }, ...current]);
    setForm({ type: "FERIE", startDate: "", endDate: "", reason: "" });
    setOpenForm(false);
    setMessage("Richiesta inviata correttamente.");
  }

  async function changeStatus(id: string, status: "APPROVED" | "REJECTED" | "FLAGGED") {
    setSaving(id);
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error ?? "Operazione non salvata.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status: data.leaveRequest.status } : request));
    setMessage(status === "APPROVED" ? "Richiesta approvata e inserita nel planning." : "Stato richiesta aggiornato.");
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        {employeeView ? <Button onClick={() => setOpenForm((current) => !current)}><Send className="size-4" /> Nuova richiesta</Button> : null}
      </div>
      {openForm ? (
        <Card className="mb-5 max-w-3xl">
          <h2 className="text-lg font-semibold">Nuova richiesta</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Tipo</span>
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Motivo</span>
              <Field value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Dal</span>
              <Field type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Al</span>
              <Field type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </label>
          </div>
          <Button className="mt-5" onClick={createRequest} disabled={saving === "create"}>
            <Send className="size-4" /> {saving === "create" ? "Invio..." : "Invia richiesta"}
          </Button>
        </Card>
      ) : null}
      {message ? <p className="mb-5 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {requests.length === 0 ? <Card className="text-sm text-black/50">Nessuna richiesta disponibile.</Card> : null}
        {requests.map((request) => (
          <Card key={request.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                {!employeeView ? <p className="font-semibold">{request.employee}</p> : null}
                <p className={employeeView ? "font-semibold" : "mt-1 text-sm text-black/50"}>
                  {typeLabels[request.type]} - {formatDate(request.startDate)} - {formatDate(request.endDate)}
                </p>
              </div>
              <Badge tone={request.status === "APPROVED" ? "green" : request.status === "FLAGGED" ? "gold" : "pink"}>
                {statusLabels[request.status]}
              </Badge>
            </div>
            <p className="mt-5 min-h-12 text-sm text-black/60">{request.reason || "Nessuna nota inserita."}</p>
            {canApprove && request.status === "PENDING" ? (
              <div className="mt-5 flex gap-2">
                <Button className="flex-1" disabled={saving === request.id} onClick={() => changeStatus(request.id, "APPROVED")}><Check className="size-4" /> Approva</Button>
                <Button className="flex-1" variant="soft" disabled={saving === request.id} onClick={() => changeStatus(request.id, "REJECTED")}><X className="size-4" /> Rifiuta</Button>
              </div>
            ) : null}
            {role === "RESPONSABILE" && request.status === "PENDING" ? (
              <Button className="mt-5 w-full" variant="soft" disabled={saving === request.id} onClick={() => changeStatus(request.id, "FLAGGED")}><Flag className="size-4" /> Segnala ad Admin</Button>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
