"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const options = [
  { value: "LIKE", label: "Mi piace", icon: ThumbsUp },
  { value: "OK", label: "Poteva andare meglio", icon: ThumbsUp },
  { value: "DISLIKE", label: "No mi piace", icon: ThumbsDown },
];

export function TaskEvaluationActions({ taskId, initialValue }: { taskId: string; initialValue?: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function save(next: string) {
    setValue(next);
    setSaving(true);
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, evaluation: next }),
    });
    setSaving(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => void save(option.value)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-paradise-pink text-black shadow-sm" : "bg-white text-black/60 ring-1 ring-black/10 hover:bg-paradise-nude"}`}
          >
            <Icon className="size-4" />
            {option.label}
          </button>
        );
      })}
      {saving ? <span className="self-center text-xs font-semibold text-black/40">Salvo...</span> : null}
    </div>
  );
}
