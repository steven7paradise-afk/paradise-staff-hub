"use client";

import { FormEvent, useRef, useState } from "react";
import { CalendarDays, Camera, KeyRound, Upload, CheckCircle2, AlertCircle, Palette, RotateCcw } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

const presets = [
  { name: "Brand Classico", header: "#C66170", sidebar: "#FFFFFF" },
  { name: "Rose Gold", header: "#B85B68", sidebar: "#FAF1F2" },
  { name: "Smeraldo", header: "#2D5A4C", sidebar: "#EBF2EF" },
  { name: "Royal Blue", header: "#1E3A8A", sidebar: "#F3F4F6" },
  { name: "Luxury Dark", header: "#1A1A1A", sidebar: "#1F1F1F" },
  { name: "Sand & Gold", header: "#D4AF37", sidebar: "#FCF9F2" },
];

export function ProfileSettings({
  photoUrl,
  name,
  role,
  calendarSync = false,
  calendarId = "",
  headerColor = "",
  sidebarColor = "",
}: {
  photoUrl: string | null;
  name: string;
  role: string;
  calendarSync?: boolean;
  calendarId?: string | null;
  headerColor?: string | null;
  sidebarColor?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(photoUrl);
  const [photoLink, setPhotoLink] = useState(photoUrl ?? "");
  const [photoStatus, setPhotoStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [calendarEnabled, setCalendarEnabled] = useState(calendarSync);
  const [calendarValue, setCalendarValue] = useState(calendarId ?? "");
  const [calendarStatus, setCalendarStatus] = useState("");
  const [headerColorVal, setHeaderColorVal] = useState(headerColor ?? "");
  const [sidebarColorVal, setSidebarColorVal] = useState(sidebarColor ?? "");
  const [themeStatus, setThemeStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const canUseCalendar = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const canManagePhoto = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";

  async function uploadPhoto(file?: File) {
    if (!file || !canManagePhoto) return;
    setLoading(true);
    setPhotoStatus("");
    const form = new FormData();
    form.append("photo", file);
    const response = await fetch("/api/profile/photo", { method: "POST", body: form });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPhotoStatus(result.error ?? "Errore nel caricamento della foto.");
    setImage(result.photoUrl);
    setPhotoLink(result.photoUrl ?? "");
    setPhotoStatus("Foto profilo aggiornata con successo.");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("photo-change", { detail: result.photoUrl }));
    }
  }

  async function savePhotoLink() {
    if (!canManagePhoto) return;
    setLoading(true);
    setPhotoStatus("");
    const response = await fetch("/api/profile/photo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: photoLink }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setPhotoStatus(result.error ?? "Errore nel salvataggio del link foto.");
    setImage(result.photoUrl);
    setPhotoLink(result.photoUrl ?? "");
    setPhotoStatus(result.photoUrl ? "Link foto profilo salvato." : "Foto profilo rimossa.");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("photo-change", { detail: result.photoUrl }));
    }
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

  function updateLivePreview(header: string, sidebar: string) {
    const root = document.querySelector<HTMLElement>(".paradise-theme-root");
    if (root) {
      if (header) {
        root.style.setProperty("--user-header-color", header);
      } else {
        root.style.removeProperty("--user-header-color");
      }
      if (sidebar) {
        root.style.setProperty("--user-sidebar-color", sidebar);
        root.style.setProperty("--user-background-color", `color-mix(in srgb, ${sidebar} 6%, var(--background))`);
      } else {
        root.style.removeProperty("--user-sidebar-color");
        root.style.removeProperty("--user-background-color");
      }
    }
  }

  function applyPreset(header: string, sidebar: string) {
    setHeaderColorVal(header);
    setSidebarColorVal(sidebar);
    updateLivePreview(header, sidebar);
  }

  async function saveThemeColors() {
    setLoading(true);
    setThemeStatus("");
    const response = await fetch("/api/profile/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headerColor: headerColorVal, sidebarColor: sidebarColorVal }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setThemeStatus(result.error ?? "Errore nel salvataggio dei colori.");
    setThemeStatus("Colori del tema salvati con successo.");
    updateLivePreview(headerColorVal, sidebarColorVal);
  }

  async function resetThemeColors() {
    setLoading(true);
    setThemeStatus("");
    const response = await fetch("/api/profile/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headerColor: "", sidebarColor: "" }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setThemeStatus(result.error ?? "Errore nel ripristino dei colori.");
    setHeaderColorVal("");
    setSidebarColorVal("");
    setThemeStatus("Colori ripristinati con successo.");
    updateLivePreview("", "");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Photo settings card */}
      <Card className="border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-5 sm:p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3 mb-4">
            <Camera className="size-5 text-[#B85B68] dark:text-paradise-pink" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Foto Profilo</h2>
          </div>
          <p className="mt-2 text-xs text-black/50 dark:text-white/40">La foto apparirà nella tua area personale, nel planning turni e nei documenti HR.</p>
          
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group select-none">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-paradise-pink to-paradise-gold opacity-30 blur group-hover:opacity-60 transition duration-500" />
              <div className="relative grid size-20 place-items-center overflow-hidden rounded-full border-4 border-white dark:border-neutral-800 bg-paradise-nude text-2xl font-extrabold text-paradise-noir shadow-md">
                {image ? <img src={resolveDrivePhotoUrl(image)} alt={name} className="size-full object-cover rounded-full select-none pointer-events-none" /> : name.slice(0, 1).toUpperCase()}
              </div>
            </div>
            
            {canManagePhoto ? (
              <>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
                <button 
                  type="button"
                  disabled={loading} 
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all duration-200 ease-out active:scale-[0.96] active:brightness-95 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-paradise-pink/60 bg-white text-paradise-noir ring-1 ring-black/5 hover:bg-paradise-nude hover:shadow-sm dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15"
                >
                  <Camera className="size-4 text-[#B85B68] dark:text-paradise-pink" /> Carica Nuova Foto
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-3 text-xs font-semibold text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
                La foto profilo può essere modificata solo da admin.
              </div>
            )}
          </div>

          {canManagePhoto ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field
                value={photoLink}
                onChange={(event) => setPhotoLink(event.target.value)}
                placeholder="https://esempio.com/foto.jpg"
              />
              <Button type="button" variant="soft" onClick={savePhotoLink} disabled={loading}>
                Salva link
              </Button>
            </div>
          ) : null}

          {photoStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{photoStatus}</span>
            </div>
          )}
        </div>

        <div className="border-t border-black/5 dark:border-white/5 pt-4">
          <p className="flex items-center gap-1.5 text-[10px] text-black/45 dark:text-white/40">
            <Upload className="size-3.5" /> 
            <span>{canManagePhoto ? "File accettati: JPG o PNG. Puoi anche incollare un link immagine." : "Le foto gia caricate restano visibili. Le modifiche sono riservate agli admin."}</span>
          </p>
        </div>
      </Card>

      {/* Password modifier card */}
      <Card className="border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3 mb-4">
          <KeyRound className="size-5 text-[#B85B68] dark:text-paradise-pink" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Aggiorna Password</h2>
        </div>
        
        <form className="mt-5 space-y-3" onSubmit={updatePassword}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Password Corrente</span>
            <Field name="currentPassword" type="password" placeholder="Inserisci password attuale" required />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Nuova Password</span>
            <Field name="newPassword" type="password" placeholder="Inserisci nuova password" minLength={8} required />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Conferma Nuova Password</span>
            <Field name="confirmation" type="password" placeholder="Ripeti la nuova password" minLength={8} required />
          </div>

          {passwordStatus && (
            <div className={cn(
              "rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in",
              passwordStatus.includes("correttamente") 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
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
        <Card className="lg:col-span-2 border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-3 mb-4">
            <CalendarDays className="size-5 text-[#B85B68] dark:text-paradise-pink" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-black/75 dark:text-white/80">Sincronizzazione Google Calendar</h2>
          </div>
          <p className="mt-2 text-xs text-black/50 dark:text-white/40">Solo quando approvi ferie, permessi o malattia, l'evento viene creato automaticamente sul calendario specificato.</p>
          
          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 cursor-pointer select-none">
              <span className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Stato Sync</span>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm font-bold text-[color:var(--text)]">
                <input type="checkbox" className="size-4 accent-[#B85B68] dark:accent-paradise-pink" checked={calendarEnabled} onChange={(event) => setCalendarEnabled(event.target.checked)} />
                Attiva Sync
              </div>
            </label>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">ID Calendario Google Sheets / Calendar</span>
              <Field value={calendarValue} onChange={(event) => setCalendarValue(event.target.value)} placeholder="Esempio: paradise.beauty@gmail.com o calendar_id" />
            </div>
            
            <Button type="button" onClick={saveCalendar} disabled={loading} className="w-full sm:w-auto">
              Aggiorna Sincronizzazione
            </Button>
          </div>

          {calendarStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{calendarStatus}</span>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
