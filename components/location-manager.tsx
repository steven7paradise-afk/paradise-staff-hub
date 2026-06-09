"use client";

import { useState } from "react";
import { AlertCircle, CalendarDays, Clock3, Download, FileText, MapPin, Phone, Plus, Save, Trash2, Upload, Users, X } from "lucide-react";
import { Badge, Button, Card, Field } from "@/components/ui";

type Staff = { id: string; name: string; role: string };
type LocationItem = {
  id: string;
  name: string;
  address: string;
  phone: string;
  openingTime: string;
  closingTime: string;
  active: boolean;
  users: Staff[];
  logsCount: number;
};

export function LocationManager({ initialLocations, canManage }: { initialLocations: LocationItem[]; canManage: boolean }) {
  const [locations, setLocations] = useState(initialLocations);
  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(creating ? "/api/locations" : `/api/locations/${editing.id}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Salone non salvato.");
      return;
    }
    const updated: LocationItem = {
      ...editing,
      id: data.id,
      name: data.name,
      address: data.address ?? "",
      phone: data.phone ?? "",
      openingTime: data.opening_time ?? "",
      closingTime: data.closing_time ?? "",
      active: data.active,
    };
    setLocations((current) => creating
      ? [...current, updated].sort((a, b) => a.name.localeCompare(b.name))
      : current.map((location) => (location.id === updated.id ? updated : location)));
    setEditing(null);
    setCreating(false);
    setMessage(creating ? "Nuovo salone creato. Ora puoi assegnare il personale da Dipendenti." : "Salone aggiornato.");
  }

  function createLocation() {
    setCreating(true);
    setEditing({
      id: "",
      name: "",
      address: "",
      phone: "",
      openingTime: "",
      closingTime: "",
      active: true,
      users: [],
      logsCount: 0,
    });
    setMessage("");
  }

  async function deactivate(location: LocationItem) {
    const confirmed = window.confirm(`Eliminare/disattivare il salone ${location.name}? Lo storico resta salvato.`);
    if (!confirmed) return;
    const response = await fetch(`/api/locations/${location.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Salone non eliminato.");
      return;
    }
    setLocations((current) => current.map((item) => (item.id === location.id ? { ...item, active: data.active } : item)));
  }

  return (
    <>
      {canManage ? <div className="mb-5"><Button onClick={createLocation}><Plus className="size-4" /> Nuovo salone</Button></div> : null}
      {message ? <p className="mb-4 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-semibold dark:bg-neutral-850 dark:text-white">{message}</p> : null}
      <section className="grid gap-5 xl:grid-cols-2">
        {locations.map((location) => (
          <Card key={location.id} className={`space-y-5 ${location.active ? "" : "opacity-65"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-paradise-softPink text-paradise-noir">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{location.name}</h2>
                  <p className="text-sm text-black/50 dark:text-white/50">{location.address || "Indirizzo non impostato"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={location.active ? "green" : "dark"}>{location.active ? "Attivo" : "Eliminato"}</Badge>
                {canManage ? <Button variant="soft" onClick={() => { setCreating(false); setEditing(location); }}>Modifica</Button> : null}
                {canManage && location.active ? <Button variant="soft" onClick={() => deactivate(location)}><Trash2 className="size-4" /> Elimina</Button> : null}
              </div>
            </div>
 
            <div className="grid gap-3 sm:grid-cols-3">
              <Info icon={Clock3} label="Apertura" value={location.openingTime || "Non impostata"} />
              <Info icon={Clock3} label="Chiusura" value={location.closingTime || "Non impostata"} />
              <Info icon={Phone} label="Telefono" value={location.phone || "Non impostato"} />
            </div>
 
            <div className="rounded-2xl border border-black/5 bg-white/55 dark:border-white/5 dark:bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Personale attivo</p>
                <span className="text-xs text-black/45 dark:text-white/45">{location.users.length} persone</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {location.users.map((user) => (
                  <div key={user.id} className="rounded-xl bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-black/45 dark:text-white/45">{user.role}</p>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="grid gap-3 sm:grid-cols-2">
              <Action href={`/api/locations/${location.id}/accounting-report`} icon={Download} label="Resoconto commercialista" detail={`${location.logsCount} timbrature mese`} />
              <Action href="/schedules" icon={CalendarDays} label="Modifica planning" detail="Turni, ferie, permessi" />
              <Action href="/notifications" icon={AlertCircle} label="Invia avviso" detail="Comunicazione al team" />
              <Action href="/documents" icon={Upload} label="Carica documenti" detail="Buste paga e contratti" />
              <Action href="/employees" icon={FileText} label="Contratti personale" detail="Scadenze e dati lavoratore" />
            </div>
          </Card>
        ))}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 dark:bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Salone</p>
                <h2 className="mt-2 text-2xl font-semibold dark:text-white">{creating ? "Nuovo salone" : "Modifica salone"}</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 dark:text-white" onClick={() => { setEditing(null); setCreating(false); }}><X className="size-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Nome salone</span>
                <Field value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Indirizzo</span>
                <Field value={editing.address} onChange={(event) => setEditing({ ...editing, address: event.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Telefono</span>
                <Field value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Stato</span>
                <select className="min-h-12 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800 px-4 text-sm dark:text-white" value={editing.active ? "active" : "inactive"} onChange={(event) => setEditing({ ...editing, active: event.target.value === "active" })}>
                  <option value="active" className="dark:bg-[#201F24] dark:text-white">Attivo</option>
                  <option value="inactive" className="dark:bg-[#201F24] dark:text-white">Eliminato / inattivo</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Apertura</span>
                <Field type="time" value={editing.openingTime} onChange={(event) => setEditing({ ...editing, openingTime: event.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Chiusura</span>
                <Field type="time" value={editing.closingTime} onChange={(event) => setEditing({ ...editing, closingTime: event.target.value })} />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Salvataggio..." : creating ? "Crea salone" : "Salva salone"}</Button>
              <Button variant="soft" onClick={() => { setEditing(null); setCreating(false); }}>Annulla</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/55 dark:border-white/5 dark:bg-white/5 p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"><Icon className="size-4" /> {label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Action({ href, icon: Icon, label, detail }: { href: string; icon: typeof Download; label: string; detail: string }) {
  return (
    <a href={href} className="rounded-2xl border border-black/5 bg-white/65 dark:border-white/5 dark:bg-white/5 p-4 transition hover:bg-white dark:hover:bg-white/10">
      <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-paradise-noir/65 dark:text-white/65" /> {label}</p>
      <p className="mt-1 text-xs text-black/45 dark:text-white/45">{detail}</p>
    </a>
  );
}
