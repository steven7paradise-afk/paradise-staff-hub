"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Reply, Forward, X } from "lucide-react";
import { chatReactions, type MessageReaction } from "@/lib/chat-reactions";
import s from "./web-chat.module.css";
export function WebMessageActions({ disabled, reactions = [], onReact, onReply, onForward }: { disabled: boolean; reactions?: MessageReaction[]; onReact: (emoji: string | null) => void; onReply: () => void; onForward: () => void }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div ref={host} className={s.messageActions}>
    <button ref={trigger} className={s.actionTrigger} type="button" aria-label="Reazioni e azioni messaggio" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}><MoreHorizontal size={19}/></button>
    {open && <div className={s.actionMenu} role="group" aria-label="Azioni messaggio"><div className={s.reactionPicker}>{chatReactions.map(emoji => <button key={emoji} type="button" aria-label={`Reagisci ${emoji}`} aria-pressed={reactions.some(r => r.emoji === emoji && r.mine)} disabled={disabled} onClick={() => { onReact(reactions.some(r => r.emoji === emoji && r.mine) ? null : emoji); setOpen(false); }}>{emoji}</button>)}</div><div className={s.messageCommands}><button type="button" onClick={() => { onReply(); setOpen(false); }}><Reply size={17}/>Rispondi</button><button type="button" onClick={() => { onForward(); setOpen(false); }}><Forward size={17}/>Inoltra</button><button type="button" aria-label="Chiudi azioni" onClick={() => setOpen(false)}><X size={17}/></button></div></div>}
    {!!reactions.length && <div className={s.reactions}>{reactions.map(r => <button key={r.emoji} type="button" aria-label={`${r.emoji}: ${r.count} reazioni${r.mine ? ", anche tu" : ""}`} aria-pressed={r.mine} disabled={disabled} onClick={() => onReact(r.mine ? null : r.emoji)}>{r.emoji}<small>{r.count}</small></button>)}</div>}
  </div>;
}
