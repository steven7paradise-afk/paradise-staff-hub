"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { ShiftResponsibleComment } from "@/lib/shift-responsible-access";

function commentTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(value));
}

export function ShiftResponsibleComments({ day, initialComments }: { day: string; initialComments: ShiftResponsibleComment[] }) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => setComments(initialComments), [initialComments]);

  function submit() {
    const value = text.trim();
    if (!value || isPending) return;
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/shift-responsible-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, text: value }),
      });
      const data = await response.json().catch(() => null) as { comment?: ShiftResponsibleComment; error?: string } | null;
      if (!response.ok || !data?.comment) {
        setMessage(data?.error || "Non è stato possibile salvare il commento");
        return;
      }
      setComments((current) => [...current, data.comment!]);
      setText("");
      setMessage("Commento pubblicato");
    });
  }

  return <section className="rounded-[22px] border border-black/[0.08] bg-white p-4 shadow-[0_10px_30px_rgba(47,28,38,0.04)] sm:p-6" aria-label="Commenti della giornata">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-[#ffe7f1] text-[#b7356d]"><MessageCircle className="size-4" /></span><div><h4 className="text-sm font-black text-[#282426]">Commenti sulla giornata</h4><p className="mt-0.5 text-[9px] text-black/40">I commenti sono visibili alle persone coinvolte.</p></div></div><span className="rounded-full bg-[#f5f1f3] px-2.5 py-1 text-[9px] font-black text-black/45">{comments.length}</span></div>
    <div className="mt-4 space-y-2.5">
      {comments.map((comment) => <article key={comment.id} className="rounded-2xl bg-[#faf8f9] px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-[#302c2e]">{comment.authorName}</p><time className="text-[8px] font-bold text-black/35">{commentTime(comment.at)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#514b4e]">{comment.text}</p></article>)}
      {!comments.length ? <p className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-[10px] text-black/35">Nessun commento per questa giornata.</p> : null}
    </div>
    <div className="mt-4 rounded-2xl border border-black/[0.08] bg-white p-2 focus-within:border-[#d94c88]"><label className="sr-only" htmlFor={`shift-comment-${day}`}>Scrivi un commento</label><textarea id={`shift-comment-${day}`} value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3} placeholder="Scrivi un commento sulla giornata…" className="w-full resize-none bg-transparent px-2 py-2 text-xs leading-relaxed outline-none placeholder:text-black/30" /><div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-1 pt-2"><p role="status" className={`text-[9px] font-bold ${message === "Commento pubblicato" ? "text-[#27813b]" : "text-[#b8374f]"}`}>{message}</p><button type="button" onClick={submit} disabled={!text.trim() || isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#171417] px-4 text-[10px] font-black text-white disabled:opacity-35"><Send className="size-3.5" />{isPending ? "Invio…" : "Pubblica"}</button></div></div>
  </section>;
}
