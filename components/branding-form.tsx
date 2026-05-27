"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, Save, TriangleAlert } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import type { BrandingTheme } from "@/lib/branding";

const fields: Array<{ key: keyof Omit<BrandingTheme, "logo_url">; label: string }> = [
  { key: "primary_color", label: "Primary Pink" },
  { key: "secondary_color", label: "Soft Pink" },
  { key: "background_color", label: "Sfondo sito" },
  { key: "sidebar_color", label: "Sidebar" },
  { key: "button_color", label: "Bottoni" },
  { key: "card_color", label: "Card" },
  { key: "text_color", label: "Testo" },
  { key: "gradient_color", label: "Accento Gold" },
];

export function BrandingForm({ initial }: { initial: BrandingTheme }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const previewStyle = useMemo(
    () => ({
      "--primary": form.primary_color,
      "--secondary": form.secondary_color,
      "--background": form.background_color,
      "--sidebar": form.sidebar_color,
      "--button": form.button_color,
      "--card": form.card_color,
      "--text": form.text_color,
      "--gradient": form.gradient_color,
    }) as React.CSSProperties,
    [form],
  );

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setStatus(response.ok ? "saved" : "error");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
      <Card>
        <p className="mb-5 rounded-2xl bg-paradise-nude/70 px-4 py-3 text-sm text-black/60">
          Questi colori e il logo personalizzano pannello admin, dashboard e schermata tablet clock.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="space-y-2">
              <span className="text-sm font-semibold">{field.label}</span>
              <div className="flex gap-3">
                <input
                  className="h-12 w-16 rounded-2xl border border-black/10 bg-white p-1"
                  type="color"
                  value={form[field.key]}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                />
                <Field value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
              </div>
            </label>
          ))}
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold">Logo URL</span>
            <div className="flex gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-white">
                {form.logo_url ? <img src={form.logo_url} alt="Logo" className="size-full object-cover" /> : <ImagePlus className="size-5 text-black/45" />}
              </div>
              <Field value={form.logo_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))} placeholder="https://..." />
            </div>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={status === "saving"}><Save className="size-4" /> {status === "saving" ? "Salvataggio" : "Salva branding"}</Button>
          {status === "saved" ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Colori salvati</span> : null}
          {status === "error" ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-700"><TriangleAlert className="size-4" /> Errore salvataggio</span> : null}
        </div>
      </Card>

      <section className="rounded-[26px] border border-white/70 bg-[color:var(--card)]/80 p-5 shadow-soft" style={previewStyle}>
        <div className="rounded-[22px] bg-[color:var(--background)] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-[color:var(--text)] text-white">
              {form.logo_url ? <img src={form.logo_url} alt="Logo anteprima" className="size-full object-cover" /> : "P"}
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--text)]">Paradise Staff Hub</p>
              <p className="text-xs text-[color:var(--text)]/55">Anteprima sito e tablet</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-[color:var(--card)] p-4">
            <p className="text-sm font-semibold text-[color:var(--text)]">Dashboard</p>
            <div className="mt-4 h-3 rounded-full bg-[color:var(--secondary)]" />
            <div className="mt-3 h-3 w-2/3 rounded-full bg-[color:var(--primary)]" />
            <button className="mt-5 rounded-2xl bg-[color:var(--button)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">Bottone</button>
            <div className="mt-4 rounded-2xl border border-black/10 bg-[color:var(--card)] p-3 text-center">
              <p className="font-serif text-4xl text-[color:var(--gradient)]">15:02</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--gradient)]">Tablet clock</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
