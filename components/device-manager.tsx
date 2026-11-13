"use client";

import { useRef, useState } from "react";
import { Copy, Link2, Lock, Trash2, Unlock } from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";

type Device = { id: string; deviceId: string; name: string; location: string; status: "ACTIVE" | "BLOCKED"; lastUsed: string | null; registeredIp: string | null; activatedAt: string | null };
type Location = { id: string; name: string };
type ClockRule = { entranceRoundingMinutes: number; breakDurationMinutes: number };
type AuthorizedPC = { code: string; name: string; location: string; locationId: string; createdAt: string; activatedAt: string | null; archivedAt: string | null; registeredIp: string | null };

async function requestActivationLink<T>(path: string, body?: { name: string; locationId: string }) {
  const response = await fetch(path, {
    method: "POST",
    redirect: "manual",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  }).catch(() => {
    throw new Error("Connessione non disponibile. Riprova.");
  });
  if (response.type === "opaqueredirect" || response.status === 401 || (response.status >= 300 && response.status < 400)) {
    throw new Error("Sessione scaduta. Accedi di nuovo e riprova.");
  }
  const data = await response.json().catch(() => null) as (T & { activationUrl?: string; error?: string }) | null;
  if (!response.ok || typeof data?.activationUrl !== "string" || !data.activationUrl) {
    throw new Error(data?.error || "Link non creato. Riprova.");
  }
  return { data, url: data.activationUrl };
}

export function DeviceManager({ initialDevices, locations, initialRules, initialPcs = [] }: { initialDevices: Device[]; locations: Location[]; initialRules: Record<string, ClockRule>; initialPcs?: AuthorizedPC[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [pcs, setPcs] = useState(initialPcs.filter((pc) => !pc.archivedAt));
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState({ name: "", locationId: locations[0]?.id ?? "" });
  const [message, setMessage] = useState("");
  const [activationLink, setActivationLink] = useState<{ target: string; deviceId: string; url: string } | null>(null);
  const [linkFeedback, setLinkFeedback] = useState<{ target: string; text: string } | null>(null);
  const [pendingEnrollment, setPendingEnrollment] = useState<string | null>(null);
  const enrollmentInProgress = useRef(false);
  const activationLinkField = useRef<HTMLInputElement>(null);

  async function generateLink(device?: Device) {
    const target = device?.id ?? "new";
    const name = draft.name.trim();
    if (enrollmentInProgress.current || (!device && (!name || !draft.locationId))) return;
    enrollmentInProgress.current = true;
    setPendingEnrollment(target);
    setLinkFeedback(null);
    setActivationLink((current) => current && (current.target === target || current.deviceId === device?.id) ? null : current);
    try {
      let url: string;
      let deviceId: string;
      if (device) {
        ({ url } = await requestActivationLink(`/api/devices/${encodeURIComponent(device.id)}/enrollment`));
        deviceId = device.id;
      } else {
        const result = await requestActivationLink<Device>("/api/devices", { name, locationId: draft.locationId });
        const { activationUrl: _activationUrl, error: _error, ...registered } = result.data;
        setDevices((current) => [registered, ...current.filter((item) => item.id !== registered.id)]);
        setDraft({ name: "", locationId: locations[0]?.id ?? "" });
        deviceId = registered.id;
        url = result.url;
      }
      setActivationLink({ target, deviceId, url });
      setLinkFeedback({ target, text: "Link creato. Aprilo sul tablet da autorizzare entro 24 ore." });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Link non creato. Riprova.";
      setLinkFeedback({ target, text });
    } finally {
      enrollmentInProgress.current = false;
      setPendingEnrollment(null);
    }
  }

  async function copyActivationLink(link: NonNullable<typeof activationLink>) {
    try {
      await navigator.clipboard.writeText(link.url);
      setLinkFeedback({ target: link.target, text: "Link copiato. Aprilo direttamente sul tablet." });
    } catch {
      activationLinkField.current?.focus();
      activationLinkField.current?.select();
      setLinkFeedback({ target: link.target, text: "Copia manualmente il link selezionato e aprilo sul tablet." });
    }
  }

  function renderActivationLink(target: string) {
    const link = activationLink?.target === target ? activationLink : null;
    const feedback = pendingEnrollment === target
      ? "Creazione del link in corso…"
      : linkFeedback?.target === target ? linkFeedback.text : "";
    return (
      <>
        {link ? (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-black/5 bg-paradise-nude/60 p-4 sm:flex-row sm:items-center">
            <input ref={activationLinkField} aria-label="Link di attivazione" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-paradise-noir" value={link.url} readOnly onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" variant="soft" disabled={pendingEnrollment !== null} onClick={() => copyActivationLink(link)}><Copy className="size-4" /> Copia link</Button>
          </div>
        ) : null}
        <p role="status" className="empty:hidden mt-2 text-sm">{feedback}</p>
      </>
    );
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
    setActivationLink((current) => current?.deviceId === device.id ? null : current);
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
          <Field placeholder="Nome dispositivo" value={draft.name} disabled={pendingEnrollment === "new"} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <Select aria-label="Salone" value={draft.locationId} disabled={pendingEnrollment === "new"} onChange={(event) => setDraft({ ...draft, locationId: event.target.value })}>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
          <Button type="button" onClick={() => generateLink()} disabled={pendingEnrollment !== null || !draft.name.trim() || !draft.locationId}><Link2 className="size-4" /> Crea link</Button>
        </div>
        {locations.length === 0 ? <p className="mt-2 text-sm">Per creare un link serve almeno un salone attivo.</p> : null}
        {renderActivationLink("new")}
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
              <Button type="button" variant="soft" disabled={pendingEnrollment !== null} onClick={() => generateLink(device)}>
                <Copy className="size-4" /> Nuovo link
              </Button>
              {device.status === "ACTIVE" || device.registeredIp ? (
                <Button variant="soft" disabled={pendingEnrollment === device.id} onClick={() => toggleDevice(device)}>
                  {device.status === "ACTIVE" ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                  {device.status === "ACTIVE" ? "Blocca" : "Riattiva"}
                </Button>
              ) : null}
              <Button variant="soft" disabled={pendingEnrollment === device.id} onClick={() => deleteDevice(device)}>
                <Trash2 className="size-4" /> Elimina
              </Button>
            </div>
            {activationLink?.target === device.id || linkFeedback?.target === device.id || pendingEnrollment === device.id ? (
              <div className="col-span-full">{renderActivationLink(device.id)}</div>
            ) : null}
          </div>
        ))}
      </Card>
    </>
  );
}
