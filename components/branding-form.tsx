"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Crown,
  ImagePlus,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Smartphone,
  Sun,
} from "lucide-react";
import { Button, Field } from "@/components/ui";
import type { BrandingTheme } from "@/lib/branding";
import { cn } from "@/lib/utils";

type ColorKey = Exclude<keyof BrandingTheme, "logo_url">;
type Mode = "light" | "dark";

type ColorField = {
  key: ColorKey;
  label: string;
  help: string;
};

const lightFields: ColorField[] = [
  { key: "background_color", label: "Sfondo sito", help: "Colore principale delle pagine." },
  { key: "sidebar_color", label: "Sidebar", help: "Menu laterale e header mobile." },
  { key: "sidebar_text_color", label: "Testo sidebar", help: "Etichette del menu." },
  { key: "sidebar_icon_color", label: "Icone sidebar", help: "Icone e dettagli del menu." },
  { key: "card_color", label: "Card", help: "Pannelli e contenitori." },
  { key: "text_color", label: "Testo", help: "Titoli e testi principali." },
  { key: "button_color", label: "Bottoni", help: "Azioni principali." },
  { key: "primary_color", label: "Rosa primario", help: "Badge, accenti e focus." },
  { key: "secondary_color", label: "Rosa soft", help: "Sfondi delicati." },
  { key: "gradient_color", label: "Accento oro", help: "Dettagli luxury." },
];

const darkFields: ColorField[] = [
  { key: "dark_background_color", label: "Sfondo notte", help: "Colore principale in dark mode." },
  { key: "dark_sidebar_color", label: "Sidebar notte", help: "Menu laterale in dark mode." },
  { key: "dark_sidebar_text_color", label: "Testo sidebar notte", help: "Etichette menu in dark mode." },
  { key: "dark_sidebar_icon_color", label: "Icone sidebar notte", help: "Icone menu in dark mode." },
  { key: "dark_card_color", label: "Card notte", help: "Pannelli in dark mode." },
  { key: "dark_text_color", label: "Testo notte", help: "Titoli e testi in dark mode." },
  { key: "dark_button_color", label: "Bottoni notte", help: "Azioni principali in dark mode." },
];

const defaults: BrandingTheme = {
  primary_color: "#FFA8DD",
  secondary_color: "#FFD6EA",
  background_color: "#F7E9EF",
  sidebar_color: "#FFFFFF",
  button_color: "#FFA8DD",
  card_color: "#FFFFFF",
  text_color: "#1F1F1F",
  gradient_color: "#E8C98B",
  dark_background_color: "#121114",
  dark_sidebar_color: "#1B1A1F",
  dark_card_color: "#201F24",
  dark_text_color: "#F8F3F6",
  dark_button_color: "#F4A3C4",
  sidebar_text_color: "#1F1F1F",
  sidebar_icon_color: "#1F1F1F",
  dark_sidebar_text_color: "#F8F3F6",
  dark_sidebar_icon_color: "#F8F3F6",
  sidebar_active_bg_color: "#FFFFFF",
  sidebar_active_text_color: "#FFFFFF",
  sidebar_active_icon_color: "#FFFFFF",
  logo_url: null,
};

const presets: Array<{ name: string; description: string; values: Partial<BrandingTheme> }> = [
  {
    name: "Paradise pulito",
    description: "Bianco premium con rosa soft.",
    values: {
      background_color: "#FFF7FB",
      sidebar_color: "#FFFFFF",
      sidebar_text_color: "#1F1F1F",
      sidebar_icon_color: "#1F1F1F",
      card_color: "#FFFFFF",
      text_color: "#1F1F1F",
      button_color: "#FFA8DD",
      primary_color: "#FFA8DD",
      secondary_color: "#FFD6EA",
      gradient_color: "#E8C98B",
    },
  },
  {
    name: "Pink salon",
    description: "Menu rosa pieno, leggibile e caldo.",
    values: {
      background_color: "#FFF8FC",
      sidebar_color: "#F7C9EB",
      sidebar_text_color: "#1F1F1F",
      sidebar_icon_color: "#1F1F1F",
      card_color: "#FFFFFF",
      text_color: "#1F1F1F",
      button_color: "#F49AD4",
      primary_color: "#F49AD4",
      secondary_color: "#FFE3F2",
      gradient_color: "#C66170",
    },
  },
  {
    name: "Notte luxury",
    description: "Dark mode elegante, senza perdere contrasto.",
    values: {
      dark_background_color: "#121114",
      dark_sidebar_color: "#1B1A1F",
      dark_sidebar_text_color: "#F8F3F6",
      dark_sidebar_icon_color: "#F8F3F6",
      dark_card_color: "#201F24",
      dark_text_color: "#F8F3F6",
      dark_button_color: "#F4A3C4",
    },
  },
];

function modeValues(theme: BrandingTheme, mode: Mode) {
  return {
    background: mode === "dark" ? theme.dark_background_color : theme.background_color,
    sidebar: mode === "dark" ? theme.dark_sidebar_color : theme.sidebar_color,
    card: mode === "dark" ? theme.dark_card_color : theme.card_color,
    text: mode === "dark" ? theme.dark_text_color : theme.text_color,
    button: mode === "dark" ? theme.dark_button_color : theme.button_color,
    sidebarText: mode === "dark" ? theme.dark_sidebar_text_color : theme.sidebar_text_color,
    sidebarIcon: mode === "dark" ? theme.dark_sidebar_icon_color : theme.sidebar_icon_color,
  };
}

function readableColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : value;
}

export function BrandingForm({ initial }: { initial: BrandingTheme }) {
  const [form, setForm] = useState<BrandingTheme>({ ...defaults, ...initial });
  const [mode, setMode] = useState<Mode>("light");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const colors = useMemo(() => modeValues(form, mode), [form, mode]);
  const fields = mode === "dark" ? darkFields : lightFields;

  const previewStyle = useMemo(
    () =>
      ({
        "--preview-bg": colors.background,
        "--preview-sidebar": colors.sidebar,
        "--preview-card": colors.card,
        "--preview-text": colors.text,
        "--preview-button": colors.button,
        "--preview-sidebar-text": colors.sidebarText,
        "--preview-sidebar-icon": colors.sidebarIcon,
        "--preview-primary": form.primary_color,
        "--preview-soft": form.secondary_color,
        "--preview-gold": form.gradient_color,
      }) as CSSProperties,
    [colors, form.gradient_color, form.primary_color, form.secondary_color],
  );

  function applyLiveTheme(nextForm: BrandingTheme, nextMode: Mode) {
    const nextColors = modeValues(nextForm, nextMode);
    const root = document.querySelector<HTMLElement>(".paradise-theme-root") ?? document.documentElement;

    root.style.setProperty("--primary", nextForm.primary_color);
    root.style.setProperty("--secondary", nextForm.secondary_color);
    root.style.setProperty("--gradient", nextForm.gradient_color);
    root.style.setProperty("--sidebar-gradient-from", nextForm.dark_sidebar_color);
    root.style.setProperty("--sidebar-gradient-mid", "#07101F");
    root.style.setProperty("--sidebar-gradient-to", `color-mix(in srgb, ${nextForm.dark_sidebar_color} 78%, ${nextForm.gradient_color} 22%)`);
    root.style.setProperty("--sidebar-active-bg", nextForm.sidebar_active_bg_color);
    root.style.setProperty("--sidebar-active-text", nextForm.sidebar_active_text_color);
    root.style.setProperty("--sidebar-active-icon", nextForm.sidebar_active_icon_color);

    root.style.setProperty("--light-background", nextForm.background_color);
    root.style.setProperty("--light-sidebar", nextForm.sidebar_color);
    root.style.setProperty("--light-card", nextForm.card_color);
    root.style.setProperty("--light-text", nextForm.text_color);
    root.style.setProperty("--light-button", nextForm.button_color);
    root.style.setProperty("--light-sidebar-text", nextForm.sidebar_text_color);
    root.style.setProperty("--light-sidebar-icon", nextForm.sidebar_icon_color);

    root.style.setProperty("--dark-background", nextForm.dark_background_color);
    root.style.setProperty("--dark-sidebar", nextForm.dark_sidebar_color);
    root.style.setProperty("--dark-card", nextForm.dark_card_color);
    root.style.setProperty("--dark-text", nextForm.dark_text_color);
    root.style.setProperty("--dark-button", nextForm.dark_button_color);
    root.style.setProperty("--dark-sidebar-text", nextForm.dark_sidebar_text_color);
    root.style.setProperty("--dark-sidebar-icon", nextForm.dark_sidebar_icon_color);

    root.style.setProperty("--background", nextColors.background);
    root.style.setProperty("--sidebar", nextColors.sidebar);
    root.style.setProperty("--card", nextColors.card);
    root.style.setProperty("--text", nextColors.text);
    root.style.setProperty("--button", nextColors.button);
    root.style.setProperty("--sidebar-text", nextColors.sidebarText);
    root.style.setProperty("--sidebar-icon", nextColors.sidebarIcon);
    root.style.setProperty("--mobile-header-color", nextColors.sidebar);

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = nextColors.sidebar;
    try {
      window.localStorage.removeItem("mobile-theme-color");
      window.localStorage.setItem("paradise-theme", nextMode);
    } catch {
      // Local storage can be unavailable in private contexts.
    }
    window.dispatchEvent(new CustomEvent("branding-change", { detail: nextForm }));
  }

  useEffect(() => {
    applyLiveTheme(form, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key: ColorKey, value: string) {
    setStatus("idle");
    setForm((current) => {
      const next = { ...current, [key]: value };
      applyLiveTheme(next, mode);
      return next;
    });
  }

  function updateLogo(value: string) {
    setStatus("idle");
    setForm((current) => {
      const next = { ...current, logo_url: value.trim() || null };
      window.dispatchEvent(new CustomEvent("branding-change", { detail: next }));
      return next;
    });
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    document.documentElement.classList.toggle("dark", nextMode === "dark");
    applyLiveTheme(form, nextMode);
  }

  function applyPreset(values: Partial<BrandingTheme>) {
    setStatus("idle");
    setForm((current) => {
      const next = { ...current, ...values };
      applyLiveTheme(next, mode);
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      const saved = (await response.json()) as BrandingTheme;
      const next = { ...defaults, ...saved };
      setForm(next);
      applyLiveTheme(next, mode);
      setStatus("saved");
      return;
    }
    setStatus("error");
  }

  const sidebarGradientFields: ColorField[] = [
    { key: "dark_sidebar_color", label: "Base menu scura", help: "Parte principale della sidebar desktop." },
    { key: "gradient_color", label: "Sfumatura menu", help: "Colore che crea profondita nella sidebar." },
    { key: "dark_sidebar_text_color", label: "Testo menu", help: "Titoli e nomi delle pagine nel menu scuro." },
    { key: "dark_sidebar_icon_color", label: "Icone menu", help: "Icone della sidebar scura." },
    { key: "sidebar_active_bg_color", label: "Sfondo selezionato", help: "Colore della pagina attiva nel menu." },
    { key: "sidebar_active_text_color", label: "Testo selezionato", help: "Colore del testo quando una pagina e selezionata." },
    { key: "sidebar_active_icon_color", label: "Icona selezionata", help: "Colore dell'icona quando una pagina e selezionata." },
  ];

  function renderColorField(field: ColorField, compact = false) {
    return (
      <label key={field.key} className="rounded-2xl border border-black/10 bg-white p-4 transition hover:border-pink-200 dark:border-white/10 dark:bg-white/5">
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-black text-black dark:text-white">{field.label}</span>
            <span className="mt-1 block text-xs leading-5 text-black/45 dark:text-white/45">{field.help}</span>
          </span>
          <span className="rounded-full bg-black/[0.03] px-2 py-1 text-[10px] font-black text-black/45 dark:bg-white/10 dark:text-white/45">
            {readableColor(String(form[field.key]))}
          </span>
        </span>
        <span className={cn("mt-4 flex items-center gap-3", compact && "mt-3")}>
          <input
            className="size-12 shrink-0 cursor-pointer rounded-2xl border border-black/10 bg-white p-1 dark:border-white/10"
            type="color"
            value={String(form[field.key])}
            onChange={(event) => update(field.key, event.target.value)}
            aria-label={field.label}
          />
          <Field value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value)} />
        </span>
      </label>
    );
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 space-y-5">
        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-500">Branding</p>
              <h2 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight text-[color:var(--text)]">
                Personalizza colori e menu <Crown className="size-5 text-pink-500" />
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/60">
                Qui controlli sidebar desktop, menu mobile, bottoni, card, testi e logo. Le modifiche si vedono subito e poi si confermano con Salva.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="soft"
                onClick={() => {
                  setForm(defaults);
                  applyLiveTheme(defaults, mode);
                  setStatus("idle");
                }}
              >
                <RotateCcw className="size-4" /> Reset
              </Button>
              <Button type="button" onClick={save} disabled={status === "saving"} className="bg-pink-500 text-white hover:bg-pink-600">
                <Save className="size-4" /> {status === "saving" ? "Salvo..." : "Salva modifiche"}
              </Button>
            </div>
          </div>

          <div className="mt-5 min-h-6">
            {status === "saved" ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-black text-emerald-700 dark:text-emerald-300">
                <Check className="size-4" /> Branding salvato.
              </p>
            ) : null}
            {status === "error" ? <p className="text-sm font-black text-red-600">Errore durante il salvataggio. Riprova.</p> : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-pink-500">Menu laterale</p>
              <h3 className="mt-1 text-2xl font-black text-[color:var(--text)]">Sidebar desktop sfumata</h3>
              <p className="mt-1 text-sm text-black/50 dark:text-white/55">Questi colori controllano il menu scuro che vedi su PC.</p>
            </div>
            <button type="button" onClick={() => applyPreset(presets[2].values)} className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-black text-black/65 transition hover:border-pink-300 hover:bg-pink-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              Applica notte luxury
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{sidebarGradientFields.map((field) => renderColorField(field, true))}</div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-pink-500">Colori sito</p>
              <h3 className="mt-1 text-2xl font-black text-[color:var(--text)]">{mode === "light" ? "Tema chiaro" : "Tema notte"}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => changeMode("light")}
                className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition", mode === "light" ? "bg-pink-50 text-pink-600" : "text-black/50 dark:text-white/55")}
              >
                <Sun className="size-4" /> Chiaro
              </button>
              <button
                type="button"
                onClick={() => changeMode("dark")}
                className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition", mode === "dark" ? "bg-black text-white dark:bg-white dark:text-black" : "text-black/50 dark:text-white/55")}
              >
                <Moon className="size-4" /> Notte
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{fields.map((field) => renderColorField(field))}</div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-pink-500" />
            <h3 className="font-black">Preset rapidi</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="rounded-2xl border border-black/10 bg-white p-4 text-left transition hover:border-pink-300 hover:bg-pink-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="block text-sm font-black">{preset.name}</span>
                <span className="mt-1 block text-xs leading-5 text-black/50 dark:text-white/50">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-dashed border-black/15 bg-[color:var(--card)] p-5 shadow-sm dark:border-white/10">
          <label className="block">
            <span className="text-sm font-black">Logo ufficiale</span>
            <span className="mt-1 block text-xs text-black/45 dark:text-white/45">Usato nella sidebar, header mobile, login e favicon se configurato.</span>
            <span className="mt-4 flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-black text-sm font-black text-white shadow-sm">
                {form.logo_url ? <img src={form.logo_url} alt="Logo Paradise" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
              </span>
              <Field value={form.logo_url ?? ""} onChange={(event) => updateLogo(event.target.value)} placeholder="https://..." />
            </span>
          </label>
        </div>
      </section>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="size-4 text-pink-500" />
            <p className="text-sm font-black">Anteprima menu desktop</p>
          </div>
          <div
            className="rounded-[26px] border border-white/10 p-4 text-[color:var(--dark-sidebar-text)]"
            style={{
              background: `linear-gradient(165deg, ${form.dark_sidebar_color}, #07101F 54%, color-mix(in srgb, ${form.dark_sidebar_color} 78%, ${form.gradient_color} 22%))`,
            }}
          >
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                {form.logo_url ? <img src={form.logo_url} alt="" className="size-full object-cover" /> : "P"}
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em]">Paradise</p>
                <p className="text-xs opacity-55">Staff Hub</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-55">Principale</p>
              {["Dashboard", "Comunicazioni", "Profilo"].map((item, index) => (
                <div
                  key={item}
                  className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold", index !== 0 && "opacity-75")}
                  style={index === 0 ? { backgroundColor: form.sidebar_active_bg_color, color: form.sidebar_active_text_color } : undefined}
                >
                  <span className="grid size-8 place-items-center rounded-xl bg-white/[0.08]" style={{ color: index === 0 ? form.sidebar_active_icon_color : form.dark_sidebar_icon_color }}>
                    {index + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-[color:var(--card)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="size-4 text-pink-500" />
            <p className="text-sm font-black">Anteprima pagina</p>
          </div>
          <div className="mx-auto max-w-[310px] rounded-[38px] bg-white p-3 shadow-2xl shadow-black/15" style={previewStyle}>
            <div className="rounded-[30px] bg-[color:var(--preview-bg)] p-4 text-[color:var(--preview-text)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">9:41</span>
                <span className="text-[10px] tracking-widest">●●●</span>
              </div>
              <div className="mt-5 rounded-[24px] bg-[color:var(--preview-sidebar)] p-3 text-[color:var(--preview-sidebar-text)]">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-[color:var(--preview-button)] text-sm font-black text-white">
                    {form.logo_url ? <img src={form.logo_url} alt="" className="size-full object-cover" /> : "P"}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em]">Paradise</p>
                    <p className="text-xs opacity-60">Staff Hub</p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-45">Paradise Beauty</p>
                <h3 className="mt-1 text-2xl font-black">Ciao, Steven</h3>
                <p className="mt-1 text-xs opacity-55">Ecco cosa c'e da fare oggi.</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["2", "In corso"],
                  ["1", "Da iniziare"],
                  ["5", "Completate"],
                  ["3", "Avvisi"],
                ].map(([number, label]) => (
                  <div key={label} className="rounded-2xl bg-[color:var(--preview-card)] p-4 shadow-sm">
                    <p className="text-2xl font-black">{number}</p>
                    <p className="mt-1 text-xs opacity-60">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-[color:var(--preview-card)] p-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-[color:var(--preview-primary)]" />
                  <p className="font-black">Task principale</p>
                </div>
                <p className="mt-2 text-sm opacity-65">Controllare prenotazioni serali</p>
                <button className="mt-4 w-full rounded-2xl bg-[color:var(--preview-button)] py-3 text-sm font-black text-white shadow-sm">
                  Apri task
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
