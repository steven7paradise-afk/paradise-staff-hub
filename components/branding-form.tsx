"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { CheckCircle2, Crown, ImagePlus, Moon, Save, Sun } from "lucide-react";
import { Button, Field } from "@/components/ui";
import type { BrandingTheme } from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandingKey = keyof Omit<BrandingTheme, "logo_url">;

const lightFields: Array<{ key: BrandingKey; label: string }> = [
  { key: "background_color", label: "Sfondo sito" },
  { key: "sidebar_color", label: "Sidebar" },
  { key: "sidebar_text_color", label: "Testo sidebar" },
  { key: "sidebar_icon_color", label: "Icone sidebar" },
  { key: "card_color", label: "Card" },
  { key: "text_color", label: "Testo" },
  { key: "button_color", label: "Bottoni" },
  { key: "primary_color", label: "Accento rosa" },
  { key: "secondary_color", label: "Rosa soft" },
  { key: "gradient_color", label: "Oro" },
];

const darkFields: Array<{ key: BrandingKey; label: string }> = [
  { key: "dark_background_color", label: "Sfondo notte" },
  { key: "dark_sidebar_color", label: "Sidebar notte" },
  { key: "dark_sidebar_text_color", label: "Testo sidebar notte" },
  { key: "dark_sidebar_icon_color", label: "Icone sidebar notte" },
  { key: "dark_card_color", label: "Card notte" },
  { key: "dark_text_color", label: "Testo notte" },
  { key: "dark_button_color", label: "Bottoni notte" },
];

const presets = [
  {
    name: "Paradise Pink",
    values: {
      background_color: "#FFF7FB",
      sidebar_color: "#FFFFFF",
      card_color: "#FFFFFF",
      text_color: "#1F1F1F",
      button_color: "#FF4DA6",
      primary_color: "#FFABDD",
      secondary_color: "#FFD6E7",
      gradient_color: "#E8C98B",
    },
  },
  {
    name: "Pulito bianco",
    values: {
      background_color: "#FAFAFA",
      sidebar_color: "#FFFFFF",
      card_color: "#FFFFFF",
      text_color: "#111111",
      button_color: "#111111",
      primary_color: "#F3F4F6",
      secondary_color: "#E5E7EB",
      gradient_color: "#8A8A8A",
    },
  },
  {
    name: "Notte elegante",
    values: {
      dark_background_color: "#121114",
      dark_sidebar_color: "#1B1A1F",
      dark_card_color: "#201F24",
      dark_text_color: "#F8F3F6",
      dark_button_color: "#F4A3C4",
    },
  },
];

export function BrandingForm({ initial }: { initial: BrandingTheme }) {
  const [form, setForm] = useState(initial);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const previewStyle = useMemo(
    () =>
      ({
        "--p-bg": mode === "dark" ? form.dark_background_color : form.background_color,
        "--p-card": mode === "dark" ? form.dark_card_color : form.card_color,
        "--p-text": mode === "dark" ? form.dark_text_color : form.text_color,
        "--p-button": mode === "dark" ? form.dark_button_color : form.button_color,
        "--p-sidebar-text": mode === "dark" ? form.dark_sidebar_text_color : form.sidebar_text_color,
        "--p-sidebar-icon": mode === "dark" ? form.dark_sidebar_icon_color : form.sidebar_icon_color,
        "--p-soft": form.secondary_color,
      }) as CSSProperties,
    [form, mode],
  );

  function update(key: keyof BrandingTheme, value: string | null) {
    setStatus("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyLiveTheme(nextForm = form, nextMode = mode) {
    const root = document.querySelector<HTMLElement>(".paradise-theme-root");
    const target = root ?? document.documentElement;
    target.style.setProperty("--primary", nextForm.primary_color);
    target.style.setProperty("--secondary", nextForm.secondary_color);
    target.style.setProperty("--light-background", nextForm.background_color);
    target.style.setProperty("--light-sidebar", nextForm.sidebar_color);
    target.style.setProperty("--light-card", nextForm.card_color);
    target.style.setProperty("--light-text", nextForm.text_color);
    target.style.setProperty("--light-button", nextForm.button_color);
    target.style.setProperty("--dark-background", nextForm.dark_background_color);
    target.style.setProperty("--dark-sidebar", nextForm.dark_sidebar_color);
    target.style.setProperty("--dark-card", nextForm.dark_card_color);
    target.style.setProperty("--dark-text", nextForm.dark_text_color);
    target.style.setProperty("--dark-button", nextForm.dark_button_color);
    target.style.setProperty("--sidebar-text", nextForm.sidebar_text_color);
    target.style.setProperty("--sidebar-icon", nextForm.sidebar_icon_color);
    target.style.setProperty("--dark-sidebar-text", nextForm.dark_sidebar_text_color);
    target.style.setProperty("--dark-sidebar-icon", nextForm.dark_sidebar_icon_color);
    target.style.setProperty("--gradient", nextForm.gradient_color);
    target.style.setProperty("--background", nextMode === "dark" ? nextForm.dark_background_color : nextForm.background_color);
    target.style.setProperty("--sidebar", nextMode === "dark" ? nextForm.dark_sidebar_color : nextForm.sidebar_color);
    target.style.setProperty("--button", nextMode === "dark" ? nextForm.dark_button_color : nextForm.button_color);
    target.style.setProperty("--card", nextMode === "dark" ? nextForm.dark_card_color : nextForm.card_color);
    target.style.setProperty("--text", nextMode === "dark" ? nextForm.dark_text_color : nextForm.text_color);
  }

  function changeMode(nextMode: "light" | "dark") {
    setMode(nextMode);
    document.documentElement.classList.toggle("dark", nextMode === "dark");
    window.localStorage.setItem("paradise-theme", nextMode);
    applyLiveTheme(form, nextMode);
  }

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (response.ok) {
      applyLiveTheme(form, mode);
      setStatus("saved");
      return;
    }
    setStatus("error");
  }

  const fields = mode === "dark" ? darkFields : lightFields;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(420px,620px)_360px]">
      <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm dark:bg-[color:var(--card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-500">Branding</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-black">
              Personalizzazione <Crown className="size-5 text-pink-500" />
            </h1>
            <p className="mt-2 text-sm text-black/55 dark:text-white/55">Colori veri del sito, modalità chiara/notte e logo.</p>
          </div>
          <Button onClick={save} disabled={status === "saving"} className="bg-pink-500 text-white hover:bg-pink-600">
            <Save className="size-4" /> {status === "saving" ? "Salvo" : "Salva"}
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={() => changeMode("light")}
            className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black", mode === "light" ? "bg-white text-pink-600 shadow-sm" : "text-black/55 dark:text-white/55")}
          >
            <Sun className="size-4" /> Chiara
          </button>
          <button
            type="button"
            onClick={() => changeMode("dark")}
            className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black", mode === "dark" ? "bg-[#1F1F1F] text-white shadow-sm" : "text-black/55 dark:text-white/55")}
          >
            <Moon className="size-4" /> Notte
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
              <span className="text-sm font-black">{field.label}</span>
              <div className="mt-3 flex items-center gap-3">
                <input
                  className="size-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                  type="color"
                  value={String(form[field.key])}
                  onChange={(event) => update(field.key, event.target.value)}
                />
                <Field value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value)} />
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setStatus("idle");
                setForm((current) => ({ ...current, ...preset.values }));
              }}
              className="rounded-2xl border border-black/10 bg-white p-4 text-left text-sm font-black transition hover:border-pink-300 hover:bg-pink-50 dark:border-white/10 dark:bg-white/5"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <label className="mt-6 block rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/5">
          <span className="text-sm font-black">Logo URL</span>
          <div className="mt-3 flex items-center gap-3">
            <div className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-white", form.logo_url ? "bg-transparent" : "bg-black")}>
              {form.logo_url ? <img src={form.logo_url} alt="Logo" className="size-full object-contain" /> : <ImagePlus className="size-5" />}
            </div>
            <Field value={form.logo_url ?? ""} onChange={(event) => update("logo_url", event.target.value)} placeholder="https://..." />
          </div>
        </label>

        {status === "saved" ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700"><CheckCircle2 className="size-4" /> Salvato.</p> : null}
        {status === "error" ? <p className="mt-4 text-sm font-black text-red-600">Errore salvataggio.</p> : null}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm dark:bg-[color:var(--card)]">
        <p className="mb-4 text-sm font-black">Anteprima telefono</p>
        <div className="mx-auto max-w-[280px] rounded-[34px] bg-white p-3 shadow-2xl shadow-black/15" style={previewStyle}>
          <div className="rounded-[28px] bg-[color:var(--p-bg)] p-4 text-[color:var(--p-text)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black">9:41</span>
              <span className="text-[10px]">●●●</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className={cn("grid size-10 place-items-center overflow-hidden rounded-2xl text-sm font-black text-white", form.logo_url ? "bg-transparent" : "bg-[color:var(--p-button)]")}>
                {form.logo_url ? <img src={form.logo_url} alt="" className="size-full object-contain" /> : "P"}
              </div>
              <div>
                <p className="font-black">Ciao, Steven</p>
                <p className="text-xs opacity-60">Ecco cosa c'e da fare oggi.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-[color:var(--p-card)] p-3">
              {["Home", "TASK", "Profilo"].map((item, index) => (
                <div key={item} className="flex items-center gap-2 py-1 text-xs font-black text-[color:var(--p-sidebar-text)]">
                  <span className="grid size-5 place-items-center rounded-lg bg-[color:var(--p-sidebar-icon)] text-[9px] text-white">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {["In corso", "Da iniziare", "Completate", "Avvisi"].map((item, index) => (
                <div key={item} className="rounded-2xl bg-[color:var(--p-card)] p-4 shadow-sm">
                  <p className="text-2xl font-black">{[2, 1, 5, 3][index]}</p>
                  <p className="text-xs opacity-60">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-[color:var(--p-card)] p-4">
              <p className="font-black">Task principale</p>
              <p className="mt-2 text-sm opacity-65">Controllare prenotazioni serali</p>
              <button className="mt-4 w-full rounded-2xl bg-[color:var(--p-button)] py-3 text-sm font-black text-white">Apri task</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
