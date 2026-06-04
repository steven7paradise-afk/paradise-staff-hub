"use client";

import { FormEvent, useRef, useState } from "react";
import { CalendarDays, Camera, KeyRound, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ProfileSettings({
  photoUrl,
  name,
  role,
  calendarSync = false,
  calendarId = "",
}: {
  photoUrl: string | null;
  name: string;
  role: string;
  calendarSync?: boolean;
  calendarId?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(photoUrl);
  const [photoStatus, setPhotoStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [calendarEnabled, setCalendarEnabled] = useState(calendarSync);
  const [calendarValue, setCalendarValue] = useState(calendarId ?? "");
  const [calendarStatus, setCalendarStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const canUseCalendar = role === "SUPER_ADMIN" || role === "ADMIN";

  async function uploadPhoto(file?: File) {
    if (!file) return;
    setLoading(true);
    setPhotoStatus("");
    const form = new FormData();
    form.append("photo", file);
    const response = await fetch("/api/profile/photo", { method: "POST", body: form });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPhotoStatus(result.error ?? "Errore nel caricamento della foto.");
    setImage(result.photoUrl);
    setPhotoStatus("Foto profilo aggiornata con successo.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) return setPasswordStatus("Le nuove password non coincidono.");
    setLoading(true);
    setPasswordStatus("");
    const response = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPasswordStatus(result.error ?? "Impossibile aggiornare la password.");
    event.currentTarget.reset();
    setPasswordStatus("Password aggiornata correttamente.");
  }

  async function saveCalendar() {
    setLoading(true);
    setCalendarStatus("");
    const response = await fetch("/api/profile/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: calendarEnabled, calendarId: calendarValue }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setCalendarStatus(result.error ?? "Google Calendar non salvato.");
    setCalendarStatus("Sincronizzazione Google Calendar salvata.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Photo settings card */}
      <Card className="border border-white/50 bg-white/95 shadow-soft p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 border-b border-black/5 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68]">
              <Camera className="size-4.5" />
            </div>
            <h2 className="text-base font-bold text-paradise-noir">Foto Profilo</h2>
          </div>
          <p className="mt-2 text-xs text-black/50">La foto apparirà nella tua area personale, nel planning turni e nei documenti HR.</p>
          
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group select-none">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-paradise-pink to-paradise-gold opacity-30 blur group-hover:opacity-60 transition duration-500" />
              <div className="relative grid size-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-paradise-nude text-2xl font-extrabold text-paradise-noir shadow-md">
                {image ? <img src={image} alt={name} className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}
              </div>
            </div>
            
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
            <button 
              type="button"
              disabled={loading} 
              onClick={() => inputRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-black/5 bg-white px-5 py-2.5 text-xs font-bold text-paradise-noir shadow-sm transition hover:bg-paradise-nude hover:border-black/10 active:scale-95"
            >
              <Camera className="size-4 text-[#B85B68]" /> Carica Nuova Foto
            </button>
          </div>
        </div>

        <div>
          {photoStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{photoStatus}</span>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[10px] text-black/45">
            <Upload className="size-3.5" /> 
            <span>File accettati: JPG o PNG. Dimensione massima consentita: 5 MB.</span>
          </p>
        </div>
      </Card>

      {/* Password modifier card */}
      <Card className="border border-white/50 bg-white/95 shadow-soft p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68]">
            <KeyRound className="size-4.5" />
          </div>
          <h2 className="text-base font-bold text-paradise-noir">Aggiorna Password</h2>
        </div>
        
        <form className="mt-5 space-y-3" onSubmit={updatePassword}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Password Corrente</span>
            <Field name="currentPassword" type="password" placeholder="Inserisci password attuale" required />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Nuova Password</span>
            <Field name="newPassword" type="password" placeholder="Inserisci nuova password" minLength={8} required />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Conferma Nuova Password</span>
            <Field name="confirmation" type="password" placeholder="Ripeti la nuova password" minLength={8} required />
          </div>

          {passwordStatus && (
            <div className={cn(
              "rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in",
              passwordStatus.includes("correttamente") 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-700"
            )}>
              {passwordStatus.includes("correttamente") ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
              <span>{passwordStatus}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              Salva Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Google Calendar card (Admins/Super Admins only) */}
      {canUseCalendar ? (
        <Card className="lg:col-span-2 border border-white/50 bg-white/95 shadow-soft p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-black/5 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-paradise-pink/15 text-[#B85B68]">
              <CalendarDays className="size-4.5" />
            </div>
            <h2 className="text-base font-bold text-paradise-noir">Sincronizzazione Google Calendar</h2>
          </div>
          <p className="mt-2 text-xs text-black/50">Solo quando approvi ferie, permessi o malattia, l'evento viene creato automaticamente sul calendario specificato.</p>
          
          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 cursor-pointer select-none">
              <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">Stato Sync</span>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold">
                <input type="checkbox" className="size-4 accent-[#B85B68]" checked={calendarEnabled} onChange={(event) => setCalendarEnabled(event.target.checked)} />
                Attiva Sync
              </div>
            </label>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider pl-1">ID Calendario Google Sheets / Calendar</span>
              <Field value={calendarValue} onChange={(event) => setCalendarValue(event.target.value)} placeholder="Esempio: paradise.beauty@gmail.com o calendar_id" />
            </div>
            
            <Button type="button" onClick={saveCalendar} disabled={loading} className="w-full sm:w-auto">
              Aggiorna Sincronizzazione
            </Button>
          </div>

          {calendarStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{calendarStatus}</span>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
