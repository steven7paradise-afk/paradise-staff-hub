"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Smile, Square, Trash2, X } from "lucide-react";
import s from "./web-chat.module.css";
const emojis = ["😀","😊","😂","😍","🥰","😎","🤔","😅","😭","🙏","👍","👎","👏","🙌","👌","💪","❤️","💕","💖","🔥","🎉","✨","✅","❌","👀","📞","📅","📍","💼","💇‍♀️","💅","🌸"];
const limit = 5 * 1024 * 1024;
export function WebChatComposer({ draft, setDraft, disabled, onSend, onFile, onError }: {
  draft: string; setDraft: (value: string) => void; disabled: boolean;
  onSend: () => void; onFile: (file: File, clientId: string) => Promise<boolean>; onError: (message: string) => void;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false), [recording, setRecording] = useState(false), [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0), [pending, setPending] = useState<{ file: File; id: string } | null>(null), [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null), text = useRef<HTMLTextAreaElement>(null), picker = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0);
  const locked = disabled || recording || starting || !!pending;
  function cancelRecording() {
    generation.current++;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    recorder.current = null; stream.current = null;
    setRecording(false); setStarting(false);
  }
  useEffect(() => () => { generation.current++; if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => {
    if (!pending) { setPreview(""); return; }
    const url = URL.createObjectURL(pending.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(old => old + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => { if (recording && seconds >= 180) recorder.current?.stop(); }, [seconds, recording]);
  useEffect(() => {
    if (!emojiOpen) return;
    const click = (event: PointerEvent) => { if (!picker.current?.contains(event.target as Node)) setEmojiOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setEmojiOpen(false); text.current?.focus(); } };
    document.addEventListener("pointerdown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", click); document.removeEventListener("keydown", key); };
  }, [emojiOpen]);
  function choose(file?: File) {
    if (!file) return;
    if (!file.size || file.size > limit) { onError("Scegli un file non vuoto, massimo 5 MB."); return; }
    setPending({ file, id: crypto.randomUUID() }); setEmojiOpen(false);
  }
  async function start() {
    if (locked) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { onError("La registrazione audio non è disponibile in questo browser."); return; }
    const token = ++generation.current; setStarting(true); setEmojiOpen(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== token) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error("Formato audio non supportato da questo browser.");
      const rec = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 }); recorder.current = rec;
      const chunks: Blob[] = []; let bytes = 0;
      rec.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes >= limit && rec.state === "recording") rec.stop(); } };
      rec.onerror = () => { cancelRecording(); onError("Registrazione interrotta. Riprova."); };
      rec.onstop = () => {
        media.getTracks().forEach(t => t.stop());
        if (generation.current !== token) return;
        setRecording(false); recorder.current = null; stream.current = null;
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("webm") ? "webm" : "ogg";
        choose(new File(chunks, `Audio-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`, { type: mime }));
      };
      rec.start(1000); setSeconds(0); setRecording(true);
    } catch (error) {
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
      if (generation.current === token) onError(error instanceof DOMException && error.name === "NotAllowedError" ? "Consenti l’accesso al microfono per registrare un audio." : "Impossibile avviare il microfono. Verifica che sia disponibile.");
    } finally { if (generation.current === token) setStarting(false); }
  }
  async function upload() { if (pending && !disabled && await onFile(pending.file, pending.id)) setPending(null); }
  return <div className={s.composerWrap}>
    {pending && <div className={s.filePreview}>
      {pending.file.type.startsWith("image/") && <img src={preview} alt="Anteprima allegato" />}
      <div><strong>{pending.file.type.startsWith("audio/") ? "Messaggio vocale" : pending.file.name}</strong><small>{(pending.file.size / 1024).toFixed(0)} KB · pronto per l’invio</small>{pending.file.type.startsWith("audio/") && <audio controls src={preview} aria-label="Ascolta prima di inviare" />}</div>
      <button type="button" disabled={disabled} onClick={() => setPending(null)} aria-label="Rimuovi allegato"><X size={20} /></button>
    </div>}
    <form className={s.composer} onSubmit={e => { e.preventDefault(); if (pending) void upload(); else if (!locked) onSend(); }}>
      <input hidden ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.m4a,.webm,.ogg" onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      {recording || starting ? <>
        <button className={s.toolButton} type="button" onClick={cancelRecording} aria-label="Annulla registrazione"><Trash2 size={22} /></button>
        <div className={s.recording} role="status"><span />{starting ? "Accesso al microfono…" : `Registrazione ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</div>
        <button type="button" disabled={starting} onClick={() => recorder.current?.stop()} aria-label="Termina e ascolta registrazione"><Square size={20} /></button>
      </> : <>
        <div ref={picker} className={s.emojiAnchor}>
          <button className={s.toolButton} type="button" disabled={locked} aria-label="Emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={24} /></button>
          {emojiOpen && <div className={s.emojiPicker} role="dialog" aria-label="Scegli un’emoji"><strong>Emoji</strong><div>{emojis.map(emoji => <button type="button" key={emoji} aria-label={`Inserisci ${emoji}`} onClick={() => { const start = text.current?.selectionStart ?? draft.length, end = text.current?.selectionEnd ?? start; if (draft.length - (end - start) + emoji.length > 4000) return; setDraft(draft.slice(0, start) + emoji + draft.slice(end)); requestAnimationFrame(() => { text.current?.focus(); text.current?.setSelectionRange(start + emoji.length, start + emoji.length); }); }}>{emoji}</button>)}</div></div>}
        </div>
        <button className={s.toolButton} type="button" disabled={locked} aria-label="Allega foto o documento" title="Allega foto o documento · massimo 5 MB" onClick={() => input.current?.click()}><Paperclip size={23} /></button>
        <textarea ref={text} aria-label="Messaggio" placeholder={pending ? "Allegato pronto da inviare" : "Scrivi un messaggio…"} maxLength={4000} disabled={locked} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!locked) onSend(); } }} rows={1} />
        <button className={s.toolButton} type="button" disabled={locked} aria-label="Registra messaggio vocale" title="Registra messaggio vocale" onClick={() => void start()}><Mic size={23} /></button>
        <button aria-label={pending ? "Invia allegato" : "Invia messaggio"} disabled={disabled || (!pending && !draft.trim())}><Send size={21} /></button>
      </>}
    </form>
  </div>;
}
