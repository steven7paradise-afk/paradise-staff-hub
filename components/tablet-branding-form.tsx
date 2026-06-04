"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { CheckCircle2, Crown, ImagePlus, Save, MapPin, ShieldCheck, Volume2, Delete, X, Send } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { cn } from "@/lib/utils";

export type TabletBranding = {
  logo_url: string;
  background_color: string;
  card_color: string;
  text_color: string;
  accent_color: string;
  soft_color: string;
  button_color: string;
};

const defaultBranding: TabletBranding = {
  logo_url: "",
  background_color: "#fbf7f2",
  card_color: "#ffffff",
  text_color: "#171717",
  accent_color: "#a77a49",
  soft_color: "#f8ddd7",
  button_color: "#1c1c1c",
};

const presets = [
  {
    name: "Originale Paradise",
    values: {
      background_color: "#fbf7f2",
      card_color: "#ffffff",
      text_color: "#171717",
      accent_color: "#a77a49",
      soft_color: "#f8ddd7",
      button_color: "#1c1c1c",
    },
  },
  {
    name: "Luxury Rosa",
    values: {
      background_color: "#FFF7FB",
      card_color: "#FFFFFF",
      text_color: "#1F1F1F",
      accent_color: "#FF4DA6",
      soft_color: "#FFD6E7",
      button_color: "#FF4DA6",
    },
  },
  {
    name: "Notte Premium",
    values: {
      background_color: "#121114",
      card_color: "#1B1A1F",
      text_color: "#F8F3F6",
      accent_color: "#F4A3C4",
      soft_color: "#2C252E",
      button_color: "#F4A3C4",
    },
  },
];

export function TabletBrandingForm({ initial }: { initial: TabletBranding | null }) {
  const [form, setForm] = useState<TabletBranding>(initial || defaultBranding);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const previewStyle = useMemo(
    () =>
      ({
        "--tablet-bg": form.background_color,
        "--tablet-card": form.card_color,
        "--tablet-text": form.text_color,
        "--tablet-accent": form.accent_color,
        "--tablet-soft": form.soft_color,
        "--tablet-dark": form.button_color,
      }) as CSSProperties,
    [form],
  );

  function update(key: keyof TabletBranding, value: string) {
    setStatus("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setStatus("saving");
    try {
      const response = await fetch("/api/settings/tablet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setStatus("saved");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm dark:bg-[color:var(--card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-500">Tablet Clock</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-black">
              Branding Tablet <Crown className="size-5 text-pink-500" />
            </h1>
            <p className="mt-2 text-sm text-black/55 dark:text-white/55">
              Personalizza il design specifico per la schermata del tablet per la timbratura.
            </p>
          </div>
          <Button onClick={save} disabled={status === "saving"} className="bg-pink-500 text-white hover:bg-pink-600">
            <Save className="size-4" /> {status === "saving" ? "Salvo..." : "Salva"}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Sfondo Tablet</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.background_color}
                onChange={(e) => update("background_color", e.target.value)}
              />
              <Field value={form.background_color} onChange={(e) => update("background_color", e.target.value)} />
            </div>
          </label>

          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Sfondo Card</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.card_color}
                onChange={(e) => update("card_color", e.target.value)}
              />
              <Field value={form.card_color} onChange={(e) => update("card_color", e.target.value)} />
            </div>
          </label>

          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Colore Testo</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.text_color}
                onChange={(e) => update("text_color", e.target.value)}
              />
              <Field value={form.text_color} onChange={(e) => update("text_color", e.target.value)} />
            </div>
          </label>

          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Colore Accento (Oro/Dettagli)</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.accent_color}
                onChange={(e) => update("accent_color", e.target.value)}
              />
              <Field value={form.accent_color} onChange={(e) => update("accent_color", e.target.value)} />
            </div>
          </label>

          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Evidenziazione Soft (Ferie/Permessi)</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.soft_color}
                onChange={(e) => update("soft_color", e.target.value)}
              />
              <Field value={form.soft_color} onChange={(e) => update("soft_color", e.target.value)} />
            </div>
          </label>

          <label className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <span className="text-sm font-black">Colore Bottoni (PIN pad / Azioni)</span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                type="color"
                value={form.button_color}
                onChange={(e) => update("button_color", e.target.value)}
              />
              <Field value={form.button_color} onChange={(e) => update("button_color", e.target.value)} />
            </div>
          </label>
        </div>

        <label className="mt-6 block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/5">
          <span className="text-sm font-black">Logo Tablet (URL)</span>
          <div className="mt-3 flex items-center gap-3">
            <div className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-white", form.logo_url ? "bg-transparent" : "bg-black")}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-5" />
              )}
            </div>
            <Field
              value={form.logo_url}
              onChange={(e) => update("logo_url", e.target.value)}
              placeholder="Lascia vuoto per ereditare il logo del sito"
            />
          </div>
        </label>

        <div className="mt-6 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setStatus("idle");
                setForm((current) => ({ ...current, ...preset.values }));
              }}
              className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-pink-300 hover:bg-pink-50 dark:border-white/10 dark:bg-white/5"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {status === "saved" ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
            <CheckCircle2 className="size-4" /> Impostazioni salvate correttamente.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="mt-4 text-sm font-black text-red-600">Errore nel salvataggio.</p>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm dark:bg-[color:var(--card)]">
        <p className="mb-4 text-sm font-black text-black/55 dark:text-white/55">Anteprima Tablet Clock</p>
        
        {/* Scale the mockup down to fit the side panel */}
        <div 
          className="mx-auto aspect-[4/3] w-full rounded-[24px] border-[6px] border-black bg-[color:var(--tablet-bg)] p-1.5 shadow-2xl text-[color:var(--tablet-text)] transition-colors duration-300"
          style={previewStyle}
        >
          <div className="flex h-full flex-col rounded-[18px] bg-[color:var(--tablet-card)] p-2">
            
            {/* Header Mockup */}
            <header className="flex items-center justify-between gap-1 text-[8px] opacity-80">
              <div className="flex items-center gap-1">
                <MapPin className="size-2 text-[color:var(--tablet-accent)]" />
                <span className="font-bold">Ufficio Paradise</span>
              </div>
              <div className="flex items-center gap-1">
                <Volume2 className="size-2 text-[color:var(--tablet-accent)]" />
                <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[6px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  <ShieldCheck className="size-1.5" /> AUTORIZZATO
                </div>
              </div>
            </header>

            {/* Split Screen Mockup */}
            <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2 items-center flex-1 min-h-0">
              
              {/* Keypad Mockup */}
              <div className="flex flex-col justify-center">
                <div className="grid grid-cols-6 gap-0.5 rounded-lg border border-black/10 bg-white/50 p-1 mb-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="mx-auto size-1.5 rounded-full bg-black/20" />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-0.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-4 rounded bg-white/80 border border-black/5 flex items-center justify-center text-[7px] font-bold">
                      {i + 1}
                    </div>
                  ))}
                  <div className="h-4 rounded bg-white/80 border border-black/5 flex items-center justify-center text-[7px]"><Delete className="size-1.5" /></div>
                  <div className="h-4 rounded bg-white/80 border border-black/5 flex items-center justify-center text-[7px] font-bold">0</div>
                  <div className="h-4 rounded bg-white/80 border border-black/5 flex items-center justify-center text-[7px]"><X className="size-1.5" /></div>
                </div>
                <div className="mt-1 h-4 rounded flex items-center justify-center bg-[color:var(--tablet-dark)] text-white text-[6px] font-bold uppercase tracking-wider">
                  <Send className="size-1.5 mr-1" style={{ color: "var(--tablet-accent)" }} /> Invia PIN
                </div>
              </div>

              {/* Logo / Clock Mockup */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className={cn("size-8 overflow-hidden flex items-center justify-center rounded", form.logo_url ? "bg-transparent" : "bg-black/5")}>
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="font-serif italic text-lg text-[color:var(--tablet-accent)]">P</span>
                  )}
                </div>
                <span className="font-serif text-lg leading-none mt-1">10:30</span>
                <span className="text-[6px] text-black/55 mt-0.5">mercoledì 3 giugno</span>
              </div>

            </div>

            {/* Footer Mockup */}
            <footer className="mt-1 border-t border-black/5 pt-1 flex items-center justify-between text-[5px] text-black/40">
              <span>Dispositivo autorizzato</span>
              <span>Sincronizzazione: 10:30:00</span>
            </footer>

          </div>
        </div>
      </section>
    </div>
  );
}
