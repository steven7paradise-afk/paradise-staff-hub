"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";

export function TaskSettings({ initialCategories }: { initialCategories: string[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  function addCategory() {
    const clean = draft.trim();
    if (!clean) return;
    setCategories((current) => Array.from(new Set([...current, clean])));
    setDraft("");
    setSaved(false);
  }

  async function save() {
    const response = await fetch("/api/settings/task-categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    });
    setSaved(response.ok);
  }

  return (
    <Card className="max-w-3xl bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">Task</p>
          <h2 className="mt-2 text-2xl font-semibold">Categorie predefinite</h2>
          <p className="mt-2 text-sm text-black/55">Queste categorie appariranno quando crei una nuova task.</p>
        </div>
        <Button onClick={save}><Save className="size-4" /> Salva</Button>
      </div>

      <div className="mt-6 flex gap-2">
        <Field value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Es. Social, Reception, Magazzino..." />
        <Button type="button" variant="soft" onClick={addCategory}><Plus className="size-4" /> Aggiungi</Button>
      </div>

      <div className="mt-6 grid gap-2">
        {categories.map((category) => (
          <div key={category} className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
            <span className="font-semibold">{category}</span>
            <button type="button" onClick={() => { setCategories((current) => current.filter((item) => item !== category)); setSaved(false); }} className="grid size-9 place-items-center rounded-xl text-black/45 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      {saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Categorie salvate.</p> : null}
    </Card>
  );
}
