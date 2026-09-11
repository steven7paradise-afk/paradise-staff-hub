"use client";

import { useState } from "react";
import { Copy, Link2, Lock, Trash2, Unlock } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";

type Device = { id: string; deviceId: string; name: string; location: string; status: "ACTIVE" | "BLOCKED"; lastUsed: string | null; registeredIp: string | null; activatedAt: string | null };
type Location = { id: string; name: string };
type ClockRule = { entranceRoundingMinutes: number; breakDurationMinutes: number };
type AuthorizedPC = { code: string; name: string; location: string; locationId: string; createdAt: string; activatedAt: string | null; archivedAt: string | null; registeredIp: string | null };

export function DeviceManager({ initialDevices, locations, initialRules, initialPcs = [] }: { initialDevices: Device[]; locations: Location[]; initialRules: Record<string, ClockRule>; initialPcs?: AuthorizedPC[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [pcs, setPcs] = useState(initialPcs.filter((pc) => !pc.archivedAt));
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState({ name: "", locationId: locations[0]?.id ?? "" });
  const [message, setMessage] = useState("");
  const [activationUrl, setActivationUrl] = useState("");

  async function registerDevice() {
    const response = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Tablet non registrato.");
      return;
    }
    setDevices((current) => [data, ...current.filter((device) => device.id !== data.id)]);
    setDraft({ name: "", locationId: locations[0]?.id ?? "" });
    setActivationUrl(data.activationUrl);
    setMessage("Link creato. Aprilo sul tablet da autorizzare entro 24 ore.");
  }

  async function copyActivationLink() {
    await navigator.clipboard.writeText(activationUrl);
    setMessage("Link copiato. Invialo e aprilo direttamente sul tablet.");
  }

  async function renewDeviceLink(device: Device) {
    const response = await fetch(`/api/devices/${device.id}/enrollment`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Link non creato.");
      return;
    }
    setActivationUrl(data.activationUrl);
    await navigator.clipboard.writeText(data.activationUrl);
    setMessage(`Nuovo link per ${device.name} copiato. Invialo e aprilo sul tablet entro 24 ore.`);
  }

  async function deleteDevice(device: Device) {
    if (!window.confirm(`Eliminare ${device.name}? Il tablet non potra piu timbrare, mentre lo storico restera salvato.`)) return;
    const response = await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Tablet non eliminato.");
      return;
    }
    setDevices((current) => current.filter((item) => item.id !== device.id));
    setMessage(`${device.name} eliminato dai dispositivi autorizzati. Le timbrature storiche sono conservate.`);
  }

  async function toggleDevice(device: Device) {
    const status = device.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    const response = await fetch(`/api/devices/${device.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Stato non aggiornato.");
      return;
    }
    setDevices((current) => current.map((item) => item.id === device.id ? { ...item, status: data.status } : item));
    setMessage(status === "ACTIVE" ? "Tablet attivato." : "Tablet bloccato: non potra timbrare.");
  }

  async function saveRule(locationId: string, rule: ClockRule) {
    const response = await fetch(`/api/locations/${locationId}/clock-rule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Regola non salvata.");
      return;
    }
    setRules((current) => ({ ...current, [locationId]: rule }));
    setMessage("Regole timbratura e pausa salvate per il salone.");
  }

  async function revokePc(pc: AuthorizedPC) {
    if (!window.confirm(`Revocare l'accesso del PC ${pc.name}?`)) return;
    const response = await fetch("/api/appointments/pc/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: pc.code }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "PC non revocato.");
      return;
    }
    setPcs((current) => current.filter((item) => item.code !== pc.code));
    setMessage(`${pc.name} revocato.`);
  }

  return (
    <>
      <Card className="mb-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Autorizza un nuovo tablet</h2>
          <p className="mt-2 text-sm text-black/55">Crea un link di attivazione e aprilo sul dispositivo. Il tablet viene legato alla sua credenziale privata e all'indirizzo IP rilevato.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field placeholder="Nome dispositivo" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <Select value={draft.locationId} onChange={(event) => setDraft({ ...draft, locationId: event.target.value })}>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
          <Button onClick={registerDevice} disabled={!draft.name || !draft.locationId}><Link2 className="size-4" /> Crea link</Button>
        </div>
        {activationUrl ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-black/5 bg-paradise-nude/60 p-4 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{activationUrl}</p>
            <Button variant="soft" onClick={copyActivationLink}><Copy className="size-4" /> Copia link</Button>
          </div>
        ) : null}
        {message ? <p className="mt-4 rounded-2xl bg-paradise-nude px-4 py-3 text-sm font-medium">{message}</p> : null}
      </Card>
      <Card className="mb-6">
        <h2 className="text-lg font-semibold">Regole timbratura per salone</h2>
        <p className="mt-2 text-sm text-black/55">Imposta arrotondamento dell'entrata e durata prevista della pausa. In home apparira il tempo rimanente della pausa.</p>
        <div className="mt-5 space-y-3">
          {locations.map((location) => (
            <div key={location.id} className="grid gap-3 rounded-2xl bg-paradise-nude/55 p-4 lg:grid-cols-[1fr_300px_220px] lg:items-center">
              <span className="font-semibold">{location.name}</span>
              <Select value={rules[location.id]?.entranceRoundingMinutes ?? 0} onChange={(event) => saveRule(location.id, { ...(rules[location.id] ?? { entranceRoundingMinutes: 0, breakDurationMinutes: 60 }), entranceRoundingMinutes: Number(event.target.value) })}>
                <option value={0}>Nessun arrotondamento</option>
                <option value={15}>Entrata al prossimo quarto d'ora</option>
                <option value={30}>Entrata alla prossima mezz'ora</option>
                <option value={60}>Entrata alla prossima ora</option>
              </Select>
              <Select value={rules[location.id]?.breakDurationMinutes ?? 60} onChange={(event) => saveRule(location.id, { ...(rules[location.id] ?? { entranceRoundingMinutes: 0, breakDurationMinutes: 60 }), breakDurationMinutes: Number(event.target.value) })}>
                <option value={15}>Pausa 15 min</option>
                <option value={30}>Pausa 30 min</option>
                <option value={45}>Pausa 45 min</option>
                <option value={60}>Pausa 60 min</option>
                <option value={90}>Pausa 90 min</option>
                <option value={120}>Pausa 120 min</option>
              </Select>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-black/5 p-5">
          <h2 className="text-lg font-semibold">PC cassa autorizzati</h2>
          <p className="mt-2 text-sm text-black/55">Dispositivi con accesso operativo agli appuntamenti e alla reception.</p>
        </div>
        {pcs.length === 0 ? <p className="p-5 text-sm text-black/45">Nessun PC autorizzato.</p> : pcs.map((pc) => (
          <div key={pc.code} className="grid gap-3 border-b border-black/5 p-5 last:border-b-0 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div><p className="font-semibold">{pc.name}</p><p className="text-sm text-black/45">{pc.location}</p></div>
            <div className="text-sm text-black/55">{pc.registeredIp ? `IP: ${pc.registeredIp}` : "In attesa di attivazione"}</div>
            <Button variant="soft" onClick={() => revokePc(pc)}><Trash2 className="size-4" /> Revoca</Button>
          </div>
        ))}
      </Card>
      <Card className="overflow-hidden p-0">
        {devices.map((device) => (
          <div key={device.id} className="grid gap-4 border-b border-black/5 p-5 last:border-b-0 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-center">
            <div>
              <p className="font-semibold">{device.name}</p>
              <p className="text-sm text-black/50">{device.deviceId}</p>
            </div>
            <div className="text-sm">
              <p>{device.location}</p>
              <p className="text-black/45">{device.registeredIp ? `IP: ${device.registeredIp}` : "In attesa di apertura link"}</p>
            </div>
            <Badge tone={device.status === "ACTIVE" ? "green" : "dark"}>{device.status === "ACTIVE" ? "Autorizzato" : device.registeredIp ? "Bloccato" : "Da attivare"}</Badge>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="soft" onClick={() => renewDeviceLink(device)}>
                <Copy className="size-4" /> Nuovo link
              </Button>
              {device.status === "ACTIVE" || device.registeredIp ? (
                <Button variant="soft" onClick={() => toggleDevice(device)}>
                  {device.status === "ACTIVE" ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                  {device.status === "ACTIVE" ? "Blocca" : "Riattiva"}
                </Button>
              ) : null}
              <Button variant="soft" onClick={() => deleteDevice(device)}>
                <Trash2 className="size-4" /> Elimina
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
