"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import {
  Archive,
  ArrowLeft,
  ArrowUp,
  Check,
  FileText,
  Forward,
  ImagePlus,
  Inbox,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenLine,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";

export type InternalEmailRecipient = { id: string; name: string; email: string; role: string; mansione: string | null; locationName: string | null; photoUrl: string | null };
type Attachment = { id: string; name: string; previewUrl: string; webViewLink?: string | null; mimeType?: string | null };
type MailPerson = { id: string; name: string; email: string; photo_url?: string | null };
type InternalMessage = { id: string; recipientRecordId: string | null; subject: string; body: string; status: string; createdAt: string; updatedAt: string; sender: MailPerson; recipients: MailPerson[]; draftRecipientIds: string[]; attachments: Attachment[]; read: boolean; starred: boolean; archived: boolean; deleted: boolean };
type Folder = "inbox" | "important" | "sent" | "drafts" | "archived" | "trash";
type Counts = { inbox: number; important: number; drafts: number; trash: number };
type Props = { currentUserId: string; currentUserName: string; currentUserEmail: string; recipients: InternalEmailRecipient[]; restrictedToLocation: string | null; focusMessageId?: string | null };

const folderItems: Array<{ id: Folder; label: string; icon: typeof Inbox }> = [
  { id: "inbox", label: "Posta in arrivo", icon: Inbox },
  { id: "important", label: "Importanti", icon: Star },
  { id: "sent", label: "Inviate", icon: Send },
  { id: "drafts", label: "Bozze", icon: FileText },
  { id: "archived", label: "Archiviate", icon: Archive },
  { id: "trash", label: "Cestino", icon: Trash2 },
];

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
function personPhoto(person: { photo_url?: string | null; photoUrl?: string | null } | null | undefined) { return resolveDrivePhotoUrl(person?.photo_url || person?.photoUrl || null); }
function formatMailDate(value: string) {
  const date = new Date(value); const today = new Date();
  if (date.toDateString() === today.toDateString()) return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

export function InternalEmailComposer({ currentUserId, currentUserName, currentUserEmail, recipients, restrictedToLocation, focusMessageId }: Props) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [counts, setCounts] = useState<Counts>({ inbox: 0, important: 0, drafts: 0, trash: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(focusMessageId || null);
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [recipientPicker, setRecipientPicker] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composeDragY, setComposeDragY] = useState(0);
  const [composeDragging, setComposeDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const composeDragStartRef = useRef(0);
  const composeDragYRef = useRef(0);
  const composeCloseTimerRef = useRef<number | null>(null);

  const loadFolder = useCallback(async (nextFolder: Folder, preferredId?: string | null) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/internal-email?folder=${nextFolder}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossibile caricare le email.");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setCounts(data.counts || { inbox: 0, important: 0, drafts: 0, trash: 0 });
      const targetId = preferredId || (nextFolder === folder ? selectedId : null);
      const autoSelectFirst = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
      setSelectedId(targetId && data.messages.some((message: InternalMessage) => message.id === targetId) ? targetId : autoSelectFirst ? data.messages[0]?.id || null : null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Impossibile caricare le email."); }
    finally { setLoading(false); }
  }, [folder, selectedId]);

  useEffect(() => { void loadFolder(folder, focusMessageId); }, [folder]);
  useEffect(() => {
    if (!recipientPicker) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecipientPicker(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [recipientPicker]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => () => {
    if (composeCloseTimerRef.current !== null) window.clearTimeout(composeCloseTimerRef.current);
  }, []);
  const selectedMessage = messages.find((message) => message.id === selectedId) || null;
  const visibleMessages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it");
    if (!query) return messages;
    return messages.filter((message) => {
      if (readFilter === "read" && !message.read) return false;
      if (readFilter === "unread" && message.read) return false;
      return !query || `${message.sender.name} ${message.subject} ${message.body} ${message.recipients.map((recipient) => recipient.name).join(" ")}`.toLocaleLowerCase("it").includes(query);
    });
  }, [messages, readFilter, search]);
  const selectedRecipients = recipients.filter((recipient) => selectedRecipientIds.has(recipient.id));

  function resetComposer() { setSelectedRecipientIds(new Set()); setSubject(""); setBody(""); setAttachments([]); setDraftId(null); setError(""); }
  function newMessage(options?: { recipientIds?: string[]; subject?: string; body?: string; draftId?: string | null; attachments?: Attachment[] }) {
    if (composeCloseTimerRef.current !== null) { window.clearTimeout(composeCloseTimerRef.current); composeCloseTimerRef.current = null; }
    setSelectedRecipientIds(new Set(options?.recipientIds || [])); setSubject(options?.subject || ""); setBody(options?.body || ""); setDraftId(options?.draftId || null); setAttachments(options?.attachments || []); setComposeDragging(false); setComposeDragY(0); composeDragYRef.current = 0; setCompose(true); setRecipientPicker(false); setError(""); setNotice("");
  }
  function closeComposer() { if (composeCloseTimerRef.current !== null) window.clearTimeout(composeCloseTimerRef.current); composeCloseTimerRef.current = null; setCompose(false); setComposeDragging(false); setComposeDragY(0); composeDragYRef.current = 0; resetComposer(); }
  function startComposeDrag(event: ReactPointerEvent<HTMLButtonElement>) { if (event.pointerType === "mouse" && event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); composeDragStartRef.current = event.clientY; composeDragYRef.current = 0; setComposeDragging(true); }
  function moveComposeDrag(event: ReactPointerEvent<HTMLButtonElement>) { if (!composeDragging) return; const next = Math.max(0, event.clientY - composeDragStartRef.current); composeDragYRef.current = next; setComposeDragY(next); }
  function endComposeDrag() { if (!composeDragging) return; setComposeDragging(false); if (composeDragYRef.current > 110) { const exitY = typeof window === "undefined" ? 900 : window.innerHeight; composeDragYRef.current = exitY; setComposeDragY(exitY); if (composeCloseTimerRef.current !== null) window.clearTimeout(composeCloseTimerRef.current); composeCloseTimerRef.current = window.setTimeout(closeComposer, 230); } else { composeDragYRef.current = 0; setComposeDragY(0); } }
  function quote(message: InternalMessage) { return `\n\n--- Messaggio precedente ---\nDa: ${message.sender.name}\nOggetto: ${message.subject}\n\n${message.body}`; }
  function reply(message: InternalMessage, all = false) {
    const isOwnMessage = message.sender.id === currentUserId;
    const ids = all
      ? Array.from(new Set([message.sender.id, ...message.recipients.map((recipient) => recipient.id)])).filter((id) => id !== currentUserId)
      : isOwnMessage ? message.recipients.map((recipient) => recipient.id) : [message.sender.id];
    newMessage({ recipientIds: ids, subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`, body: quote(message) });
  }
  function forward(message: InternalMessage) { newMessage({ subject: message.subject.startsWith("Inoltra:") ? message.subject : `Inoltra: ${message.subject}`, body: quote(message), attachments: message.attachments }); }

  async function selectMessage(message: InternalMessage) {
    setSelectedId(message.id); setCompose(false);
    if (!message.read && folder !== "sent" && folder !== "drafts") {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, read: true } : item));
      await fetch("/api/internal-email", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailId: message.id, action: "read" }) });
    }
  }

  async function mailAction(action: string, value?: boolean) {
    if (!selectedMessage) return;
    const response = await fetch("/api/internal-email", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailId: selectedMessage.id, action, value }) });
    if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.error || "Azione non riuscita."); return; }
    if (action === "star") setMessages((current) => current.map((item) => item.id === selectedMessage.id ? { ...item, starred: Boolean(value) } : item));
    else void loadFolder(folder);
  }

  async function saveOrSend(mode: "draft" | "send") {
    if (mode === "send" && (!selectedRecipientIds.size || !subject.trim() || !body.trim())) { setError("Seleziona i destinatari e inserisci oggetto e messaggio."); return; }
    setSending(true); setError("");
    try {
      const response = await fetch("/api/internal-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, draftId, recipientIds: [...selectedRecipientIds], subject, message: body, attachments }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Operazione non riuscita.");
      if (mode === "draft") { setDraftId(data.draftId); setNotice("Bozza salvata correttamente"); setFolder("drafts"); setCompose(false); }
      else { resetComposer(); setNotice(`Email inviata a ${Number(data?.sent || selectedRecipientIds.size)} destinatari`); setCompose(false); setFolder("sent"); }
      await loadFolder(mode === "draft" ? "drafts" : "sent");
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Operazione non riuscita."); }
    finally { setSending(false); }
  }

  async function deleteDraft() {
    if (!draftId) return;
    setSending(true);
    const response = await fetch("/api/internal-email", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailId: draftId, action: "delete-draft" }) });
    setSending(false);
    if (!response.ok) { setError("Impossibile eliminare la bozza."); return; }
    resetComposer(); setCompose(false); setFolder("drafts"); await loadFolder("drafts");
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 12 - attachments.length)) {
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/internal-email/upload", { method: "POST", body: form });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `Impossibile caricare ${file.name}.`);
        uploaded.push(data);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Caricamento non riuscito."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const countFor = (id: Folder) => id === "inbox" ? counts.inbox : id === "important" ? counts.important : id === "drafts" ? counts.drafts : id === "trash" ? counts.trash : 0;

  return (
    <div className="h-[calc(100dvh-68px)] w-full overflow-hidden bg-white lg:h-auto xl:h-dvh">
      {notice ? <div role="status" className="fixed right-5 top-5 z-[100] rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-2xl">{notice}</div> : null}
      <div className="grid h-full w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:h-auto lg:min-h-[calc(100dvh-68px)] lg:grid-cols-[220px_300px_minmax(0,1fr)] lg:grid-rows-none xl:h-dvh xl:min-h-0 xl:grid-cols-[76px_220px_300px_minmax(0,1fr)] 2xl:grid-cols-[84px_240px_340px_minmax(0,1fr)]">
        <aside className="hidden flex-col items-center bg-[#211E20] px-2 py-5 text-white xl:flex">
          <Link href="/dashboard" className="flex h-14 w-full items-center justify-center" title="Paradise Dashboard">
            <img src="/logo.png" alt="Paradise Beauty" className="max-h-8 max-w-[58px] brightness-0 invert" />
          </Link>
          <nav className="mt-7 flex w-full flex-col items-center gap-3" aria-label="Navigazione Paradise">
            <Link href="/dashboard" title="Dashboard" className="grid size-11 place-items-center rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white"><LayoutDashboard className="size-5" /></Link>
            <Link href="/tasks" title="Task" className="grid size-11 place-items-center rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white"><CheckSquare className="size-5" /></Link>
            <Link href="/schedules" title="Planning" className="grid size-11 place-items-center rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white"><CalendarDays className="size-5" /></Link>
            <Link href="/appointments" title="Appuntamenti" className="grid size-11 place-items-center rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white"><Inbox className="size-5" /></Link>
            <div className="my-1 h-px w-8 bg-white/15" />
            <div className="grid size-11 place-items-center rounded-2xl bg-[#F49BC4] text-[#211E20] shadow-[0_10px_24px_rgba(244,155,196,.24)]" title="Email"><Mail className="size-5" /></div>
          </nav>
          <Link href="/profile" title={currentUserName} className="mt-auto grid size-10 place-items-center rounded-full border border-white/20 bg-white/10 text-[11px] font-black text-white transition hover:bg-white/20">{initials(currentUserName)}</Link>
        </aside>
        <aside className="border-b border-[#EEDFE6] bg-white lg:border-b-0 lg:border-r lg:bg-[linear-gradient(180deg,#FFF4FA_0%,#FDECF4_48%,#FFF9FC_100%)] lg:p-4">
          <div className="hidden px-2 py-3 lg:block"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B63F73]">Paradise</p><h2 className="mt-1 text-2xl font-black text-[#211A1E]">Email</h2></div>
          <button type="button" onClick={() => newMessage()} className="mt-4 hidden min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#211E20] text-sm font-black text-white shadow-[0_12px_30px_rgba(33,30,32,.18)] active:scale-[.98] lg:flex"><PenLine className="size-4" /> Nuova email</button>
          <nav className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-5 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-0 lg:py-0">
            {folderItems.map((item) => { const Icon = item.icon; const count = countFor(item.id); return (
              <button key={item.id} type="button" onClick={() => { setFolder(item.id); setCompose(false); }} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-left text-xs font-bold transition lg:min-h-12 lg:w-full lg:gap-3 lg:rounded-2xl lg:px-3 lg:text-sm ${folder === item.id && !compose ? "bg-[#211E20] text-white shadow-sm lg:bg-white lg:text-[#9F3263] lg:shadow-[0_8px_22px_rgba(126,55,87,.10)]" : "bg-[#F1EEF0] text-[#56434C] hover:bg-white/65 lg:bg-transparent"}`}>
                <Icon className="size-5" /><span className="flex-1">{item.label}</span>{count ? <span className="grid min-w-6 place-items-center rounded-full bg-[#C8447D] px-1.5 py-1 text-[10px] font-black text-white">{count}</span> : null}
              </button>
            ); })}
          </nav>
          {restrictedToLocation ? <div className="mt-4 hidden rounded-2xl border border-[#EACFDC] bg-white/70 p-3 text-[10px] font-bold leading-4 text-[#85596D] lg:mt-8 lg:block">Invii limitati a<br /><strong>{restrictedToLocation}</strong></div> : null}
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden border-b border-[#E9E2E5] bg-[#FFFDFE] lg:h-auto lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-[#EFE6EA] px-5 pb-4 pt-5 lg:p-4">
            <div className="flex items-center justify-between"><div><h3 className="text-[32px] font-black leading-none tracking-[-.04em] text-[#211A1E] lg:text-xl lg:capitalize lg:tracking-normal"><span className="lg:hidden">{folder === "inbox" ? "In entrata" : folderItems.find((item) => item.id === folder)?.label}</span><span className="hidden lg:inline">{folderItems.find((item) => item.id === folder)?.label}</span></h3><p className="mt-2 text-xs font-medium text-black/40 lg:hidden">Appena aggiornato{folder === "inbox" ? ` · ${counts.inbox} non lette` : ""}</p></div><button type="button" onClick={() => newMessage()} className="hidden size-9 place-items-center rounded-full bg-[#211E20] text-white lg:grid"><PenLine className="size-4" /></button></div>
            <label className="relative mt-4 hidden lg:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/30" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca" className="h-11 w-full rounded-2xl border border-[#E9DDE3] bg-[#FAF7F9] pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#D96F9E]" /></label>
            {folder !== "sent" && folder !== "drafts" ? <div className="mt-3 hidden grid-cols-3 rounded-2xl bg-[#F4EEF1] p-1 lg:grid">{(["all", "read", "unread"] as const).map((value) => <button key={value} type="button" onClick={() => setReadFilter(value)} className={`min-h-8 rounded-xl text-[9px] font-black ${readFilter === value ? "bg-[#211E20] text-white shadow-sm" : "text-black/45"}`}>{value === "all" ? "Tutte" : value === "read" ? "Lette" : "Non lette"}</button>)}</div> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:[scrollbar-width:auto]">
            {loading ? <div className="grid h-48 place-items-center"><Loader2 className="size-6 animate-spin text-[#B43A70]" /></div> : visibleMessages.length ? visibleMessages.map((message) => {
              const active = selectedId === message.id && !compose; const outgoing = folder === "sent" || folder === "drafts"; const contact = outgoing ? message.recipients[0] : message.sender; const senderName = outgoing ? message.recipients.map((recipient) => recipient.name).join(", ") || "Bozza" : message.sender.name; const contactPhoto = personPhoto(contact);
              return <button key={message.id} type="button" onClick={() => folder === "drafts" ? newMessage({ recipientIds: message.draftRecipientIds, subject: message.subject, body: message.body, draftId: message.id, attachments: message.attachments }) : void selectMessage(message)} className={`w-full border-b border-[#F0E8EC] px-5 py-4 text-left transition ${active ? "bg-[#FFF0F7]" : "bg-white hover:bg-[#FFFAFC]"}`}>
                <div className="flex items-start gap-3"><span className={`mt-4 size-2 shrink-0 rounded-full ${message.read ? "bg-transparent" : "bg-[#F49BC4]"}`} />{contactPhoto ? <img src={contactPhoto} alt={contact?.name || "Profilo"} className="size-11 shrink-0 rounded-full object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F3DFE8] text-[10px] font-black text-[#8E315D]">{initials(contact?.name || "P")}</span>}<span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-[15px] ${message.read ? "font-bold text-[#493A42]" : "font-black text-[#211A1E]"}`}>{senderName}</span><span className="shrink-0 text-xs font-medium text-black/40">{formatMailDate(message.updatedAt || message.createdAt)}</span><span className="text-lg leading-none text-black/25 lg:hidden">›</span></span><span className="mt-0.5 block truncate text-[13px] font-bold text-[#352930]">{message.subject}</span><span className="mt-0.5 block line-clamp-2 text-[13px] font-medium leading-[18px] text-black/42">{message.body || "Nessun testo"}</span><span className="mt-1.5 flex gap-2">{message.starred ? <Star className="size-3.5 fill-amber-400 text-amber-400" /> : null}{message.attachments.length ? <Paperclip className="size-3.5 text-[#B43A70]" /> : null}</span></span></div>
              </button>;
            }) : <div className="grid h-60 place-items-center px-8 text-center"><div><MailOpen className="mx-auto size-8 text-black/15" /><p className="mt-3 text-sm font-black text-black/40">Nessuna email</p></div></div>}
          </div>
          {!compose && !selectedMessage ? <div className="z-[70] flex shrink-0 items-center gap-3 border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,.60),rgba(255,246,251,.88))] px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-14px_38px_rgba(92,53,72,.12)] backdrop-blur-2xl lg:hidden"><button type="button" onClick={() => setReadFilter((current) => current === "all" ? "unread" : current === "unread" ? "read" : "all")} aria-label={`Filtro: ${readFilter === "all" ? "tutte" : readFilter === "unread" ? "non lette" : "lette"}`} className={`relative grid size-12 shrink-0 place-items-center rounded-full border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,.92),rgba(255,228,241,.62))] shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_28px_rgba(86,48,67,.16)] backdrop-blur-xl transition active:scale-95 ${readFilter === "all" ? "text-[#211E20]" : "ring-2 ring-[#ECAAC8]/55 text-[#A93469]"}`}><ListFilter className="size-5" />{readFilter !== "all" ? <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#C8447D] text-[8px] font-black text-white shadow-md">1</span> : null}</button><label className="relative flex-1 rounded-full border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,.88),rgba(255,235,245,.58))] shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_28px_rgba(86,48,67,.13)] backdrop-blur-xl"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-black/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca email" className="h-12 w-full rounded-full bg-transparent pl-12 pr-4 text-base font-medium outline-none placeholder:text-black/35" /></label><button type="button" onClick={() => newMessage()} aria-label="Scrivi un messaggio" className="grid size-12 shrink-0 place-items-center rounded-full border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,218,236,.68))] text-[#211E20] shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_28px_rgba(86,48,67,.16)] backdrop-blur-xl transition active:scale-95"><PenLine className="size-5" /></button></div> : null}
        </section>

        <main className={`bg-white ${compose || selectedMessage ? "fixed inset-0 z-[90] h-dvh min-h-0 overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:h-auto" : "hidden lg:relative lg:block lg:min-h-0"}`}>
          {compose ? (
            <div className="email-compose-enter h-full">
            <div className="flex h-full flex-col bg-[#FFFDFE] lg:bg-white" style={{ transform: `translate3d(0,${composeDragY}px,0)`, transition: composeDragging ? "none" : "transform 230ms cubic-bezier(.22,.86,.3,1)" }}>
              <div className="relative flex shrink-0 items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] lg:hidden"><button type="button" onPointerDown={startComposeDrag} onPointerMove={moveComposeDrag} onPointerUp={endComposeDrag} onPointerCancel={endComposeDrag} className="absolute left-1/2 top-1 h-8 w-20 -translate-x-1/2 touch-none cursor-grab active:cursor-grabbing" aria-label="Trascina verso il basso per chiudere"><span className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-black/20" /></button><button type="button" onClick={closeComposer} className="grid size-12 place-items-center rounded-full border border-black/10 bg-white/80 text-black shadow-[0_8px_24px_rgba(32,24,28,.08)] backdrop-blur-xl" aria-label="Chiudi"><X className="size-7" /></button><button type="button" onClick={() => void saveOrSend("send")} disabled={sending || !selectedRecipientIds.size || !subject.trim() || !body.trim()} className="grid size-12 place-items-center rounded-full border border-black/10 bg-white/80 text-[#B43A70] shadow-[0_8px_24px_rgba(32,24,28,.08)] backdrop-blur-xl disabled:text-black/22" aria-label="Invia email">{sending ? <Loader2 className="size-6 animate-spin" /> : <ArrowUp className="size-7" />}</button></div>
              <div className="hidden items-center justify-between border-b border-[#EEE4E8] px-6 py-5 lg:flex"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#B43A70]">Composizione</p><h3 className="mt-1 text-2xl font-black text-[#211A1E]">Nuova email</h3></div><button type="button" onClick={closeComposer} className="grid size-10 place-items-center rounded-full bg-black/5"><X className="size-5" /></button></div>
              <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:p-6 lg:[scrollbar-width:auto]">
                <h3 className="mb-12 text-[42px] font-black leading-none tracking-[-.045em] text-black lg:hidden">Nuovo messaggio</h3>
                <div className="relative">
                  <button type="button" onClick={() => setRecipientPicker((value) => !value)} className="flex min-h-16 w-full flex-wrap items-center gap-2 border-b border-black/[.08] bg-transparent px-0 text-left lg:min-h-12 lg:rounded-2xl lg:border lg:border-[#E8DCE2] lg:bg-[#FFFBFD] lg:px-3">
                    <span className="text-xl font-medium text-black/38 lg:text-xs lg:font-black">A:</span>{selectedRecipients.length ? selectedRecipients.map((recipient) => <span key={recipient.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#F8DCE9] py-1 pl-1 pr-2.5 text-[10px] font-black text-[#94305E]">{personPhoto(recipient) ? <img src={personPhoto(recipient)} alt="" className="size-5 rounded-full object-cover" /> : <span className="grid size-5 place-items-center rounded-full bg-white/70 text-[8px]">{initials(recipient.name)}</span>}{recipient.name}</span>) : <span className="text-lg font-medium text-black/28 lg:text-sm lg:font-semibold">Seleziona destinatari</span>}
                  </button>
                  {recipientPicker ? <div className="absolute inset-x-0 top-14 z-30 max-h-80 overflow-y-auto rounded-2xl border border-[#E7D8DF] bg-white p-2 shadow-2xl">
                    <div className="sticky -top-2 z-10 mb-1 flex min-h-12 items-center justify-between border-b border-[#EEE3E8] bg-white px-3">
                      <span className="text-xs font-black text-[#46363E]">{selectedRecipientIds.size} {selectedRecipientIds.size === 1 ? "destinatario selezionato" : "destinatari selezionati"}</span>
                      <button type="button" onClick={() => setRecipientPicker(false)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#211E20] px-3 text-[10px] font-black uppercase tracking-wider text-white"><Check className="size-3.5" /> Fine</button>
                    </div>
                    {recipients.map((recipient) => { const checked = selectedRecipientIds.has(recipient.id); const photo = personPhoto(recipient); return <button key={recipient.id} type="button" onClick={() => setSelectedRecipientIds((current) => { const next = new Set(current); checked ? next.delete(recipient.id) : next.add(recipient.id); return next; })} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-[#FFF1F7]"><span className={`grid size-6 place-items-center rounded-full border ${checked ? "border-[#B43A70] bg-[#B43A70] text-white" : "border-black/15 text-transparent"}`}><Check className="size-3.5" /></span>{photo ? <img src={photo} alt="" className="size-9 shrink-0 rounded-full object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F3DFE8] text-[10px] font-black text-[#8E315D]">{initials(recipient.name)}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{recipient.name}</span><span className="block truncate text-[10px] text-black/40">{recipient.email} · {recipient.locationName || "Senza sede"}</span></span></button>; })}
                  </div> : null}
                </div>
                <div className="flex min-h-16 items-center border-b border-black/[.08] lg:hidden"><span className="min-w-0 flex-1 truncate text-base font-medium text-black/38">Cc/Ccn, Da: {currentUserEmail}</span></div>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder="Oggetto:" className="h-16 w-full border-b border-black/[.08] bg-transparent px-0 text-xl font-medium outline-none placeholder:text-black/38 lg:mt-3 lg:h-14 lg:rounded-2xl lg:border lg:border-[#E8DCE2] lg:bg-[#FFFBFD] lg:px-4 lg:text-sm lg:font-black lg:focus:border-[#D96F9E]" />
                <textarea ref={bodyRef} value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} placeholder="Scrivi il messaggio..." className="mt-6 min-h-[42dvh] w-full resize-none bg-transparent p-0 text-[18px] font-medium leading-7 outline-none placeholder:text-black/25 lg:mt-3 lg:min-h-72 lg:resize-y lg:rounded-2xl lg:border lg:border-[#E8DCE2] lg:bg-white lg:p-4 lg:text-sm lg:leading-6 lg:focus:border-[#D96F9E]" />
                {attachments.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{attachments.map((attachment) => <div key={attachment.id} className="group relative overflow-hidden rounded-2xl border border-[#E8DCE2] bg-[#FFF8FB]"><img src={attachment.previewUrl} alt="" className="h-28 w-full object-cover" /><button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-white"><X className="size-3.5" /></button><p className="truncate px-2 py-2 text-[9px] font-bold">{attachment.name}</p></div>)}</div> : null}
                {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files)} />
              <div className="flex shrink-0 justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 lg:hidden"><div className="flex items-center gap-1 rounded-full border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,232,243,.66))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_12px_32px_rgba(86,48,67,.15)] backdrop-blur-2xl"><button type="button" onClick={() => bodyRef.current?.focus()} className="grid size-11 place-items-center rounded-full text-xl font-medium text-black" aria-label="Testo">Aa</button><button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid size-11 place-items-center rounded-full text-black disabled:opacity-45" aria-label="Allega immagini">{uploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-6" />}</button><button type="button" onClick={() => void saveOrSend("draft")} disabled={sending} className="grid size-11 place-items-center rounded-full text-black disabled:opacity-45" aria-label="Salva bozza">{sending ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}</button>{draftId ? <button type="button" onClick={() => void deleteDraft()} disabled={sending} className="grid size-11 place-items-center rounded-full text-red-600 disabled:opacity-45" aria-label="Elimina bozza"><Trash2 className="size-5" /></button> : null}</div></div>
              <div className="hidden flex-wrap items-center gap-2 border-t border-[#EEE4E8] p-5 lg:flex">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#E4D5DC] px-4 text-xs font-black text-[#7D4A61]">{uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Immagini</button>
                <button type="button" onClick={() => void saveOrSend("draft")} disabled={sending} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#E4D5DC] px-4 text-xs font-black text-black/55 disabled:opacity-55">{sending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} {sending ? "Salvataggio..." : "Salva bozza"}</button>
                {draftId ? <button type="button" onClick={() => void deleteDraft()} disabled={sending} className="grid size-12 place-items-center rounded-2xl border border-red-200 text-red-600" aria-label="Elimina bozza"><Trash2 className="size-4" /></button> : null}
                <button type="button" onClick={() => void saveOrSend("send")} disabled={sending} className="inline-flex min-h-12 min-w-36 items-center justify-center gap-2 rounded-2xl bg-[#211E20] px-5 text-xs font-black text-white shadow-lg hover:bg-[#A93469] disabled:opacity-55">{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {sending ? "Invio..." : "Invia"}</button>
              </div>
            </div>
            </div>
          ) : selectedMessage ? (
            <div className="flex h-full flex-col">
              <div className="sticky top-0 z-20 border-b border-[#EEE5E9] bg-white">
                <div className="flex items-center px-3 py-2.5 lg:hidden"><button type="button" onClick={() => setSelectedId(null)} className="mail-action" aria-label="Torna all’elenco"><ArrowLeft className="size-5" /> Indietro</button></div>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-t border-black/5 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
                  <button type="button" onClick={() => reply(selectedMessage)} className="mail-icon-action" aria-label="Rispondi" title="Rispondi"><Reply className="size-5" /></button><button type="button" onClick={() => reply(selectedMessage, true)} className="mail-icon-action" aria-label="Rispondi a tutti" title="Rispondi a tutti"><ReplyAll className="size-5" /></button><button type="button" onClick={() => forward(selectedMessage)} className="mail-icon-action" aria-label="Inoltra" title="Inoltra"><Forward className="size-5" /></button>
                  <button type="button" onClick={() => void mailAction("unread")} className="mail-icon-action" aria-label="Segna come non letta" title="Non letta"><Mail className="size-5" /></button><button type="button" onClick={() => void mailAction("star", !selectedMessage.starred)} className="mail-icon-action" aria-label="Importante" title="Importante"><Star className={`size-5 ${selectedMessage.starred ? "fill-amber-400 text-amber-400" : ""}`} /></button>
                  {folder === "trash" ? <button type="button" onClick={() => void mailAction("restore")} className="mail-icon-action" aria-label="Ripristina" title="Ripristina"><Archive className="size-5" /></button> : <><button type="button" onClick={() => void mailAction("archive")} className="mail-icon-action" aria-label="Archivia" title="Archivia"><Archive className="size-5" /></button><button type="button" onClick={() => void mailAction(folder === "sent" ? "delete-sent" : "delete")} className="mail-icon-action text-red-600" aria-label="Elimina" title="Elimina"><Trash2 className="size-5" /></button></>}
                </div>
                <div className="hidden flex-nowrap items-center gap-2 overflow-x-auto px-5 py-4 lg:flex">
                  <button type="button" onClick={() => reply(selectedMessage)} className="mail-action"><Reply className="size-4" /> Rispondi</button><button type="button" onClick={() => reply(selectedMessage, true)} className="mail-action"><ReplyAll className="size-4" /> Tutti</button><button type="button" onClick={() => forward(selectedMessage)} className="mail-action"><Forward className="size-4" /> Inoltra</button>
                  <span className="mx-1 h-6 w-px bg-black/10" /><button type="button" onClick={() => void mailAction("unread")} className="mail-action"><Mail className="size-4" /> Non letta</button><button type="button" onClick={() => void mailAction("star", !selectedMessage.starred)} className="mail-action"><Star className={`size-4 ${selectedMessage.starred ? "fill-amber-400 text-amber-400" : ""}`} /> Importante</button>
                  {folder === "trash" ? <button type="button" onClick={() => void mailAction("restore")} className="mail-action"><Archive className="size-4" /> Ripristina</button> : <><button type="button" onClick={() => void mailAction("archive")} className="mail-action"><Archive className="size-4" /> Archivia</button><button type="button" onClick={() => void mailAction(folder === "sent" ? "delete-sent" : "delete")} className="mail-action text-red-600"><Trash2 className="size-4" /> Elimina</button></>}
                </div>
              </div>
              <article className="flex-1 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] sm:p-7">{(() => { const outgoing = selectedMessage.sender.id === currentUserId; const contact = outgoing ? selectedMessage.recipients[0] : selectedMessage.sender; const photo = personPhoto(contact); return <div className="flex items-start gap-4">{photo ? <img src={photo} alt={contact?.name || "Profilo"} className="size-12 shrink-0 rounded-full object-cover" /> : <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F3DFE8] text-sm font-black text-[#8E315D]">{initials(contact?.name || "P")}</div>}<div className="min-w-0 flex-1"><h1 className="font-serif text-2xl font-semibold text-[#211A1E] sm:text-3xl">{selectedMessage.subject}</h1><div className="mt-4 text-xs text-black/45"><strong className="block text-sm leading-5 text-[#30252A]">{outgoing ? `A: ${selectedMessage.recipients.map((recipient) => recipient.name).join(", ")}` : selectedMessage.sender.name}</strong><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="break-all">{outgoing ? selectedMessage.recipients.map((recipient) => recipient.email).join(", ") : `<${selectedMessage.sender.email}>`}</span><span aria-hidden="true">·</span><span>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedMessage.createdAt))}</span></div></div><p className="mt-2 block text-[11px] font-semibold text-black/35">Da: {selectedMessage.sender.name}</p></div></div>; })()}
                <div className="mt-8 whitespace-pre-wrap break-words text-[15px] font-medium leading-7 text-[#493D43]">{selectedMessage.body}</div>
                {selectedMessage.attachments.length ? <div className="mt-8 border-t border-[#EEE3E8] pt-5"><p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-black/40"><Paperclip className="size-4" /> Immagini allegate</p><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{selectedMessage.attachments.map((attachment) => <a key={attachment.id} href={attachment.webViewLink || attachment.previewUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-[#E8DCE2]"><img src={attachment.previewUrl} alt={attachment.name} className="h-32 w-full object-cover" /><p className="truncate p-2 text-[10px] font-bold">{attachment.name}</p></a>)}</div></div> : null}
              </article>
            </div>
          ) : <div className="hidden h-full place-items-center text-center lg:grid"><div><Mail className="mx-auto size-10 text-black/12" /><p className="mt-4 text-sm font-black text-black/35">Seleziona un messaggio oppure crea una nuova email</p></div></div>}
        </main>
      </div>
      <style jsx>{`.mail-action{display:inline-flex;min-height:40px;flex-shrink:0;align-items:center;gap:6px;border-radius:12px;padding:0 10px;font-size:11px;font-weight:800;color:#51434a;transition:.15s}.mail-action:hover{background:#fff0f7;color:#9e3262}.mail-icon-action{display:grid;width:42px;height:42px;flex:0 0 42px;place-items:center;border:1px solid rgba(255,255,255,.85);border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(255,228,241,.65));box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 7px 18px rgba(86,48,67,.12);color:#51434a;backdrop-filter:blur(18px);transition:.15s}.mail-icon-action:active{transform:scale(.94)}@media(max-width:1023px){.email-compose-enter{transform-origin:bottom center;animation:email-compose-slide-up .42s cubic-bezier(.22,.86,.3,1) both}}@keyframes email-compose-slide-up{from{transform:translate3d(0,100%,0);opacity:.72}to{transform:translate3d(0,0,0);opacity:1}}@media(prefers-reduced-motion:reduce){.email-compose-enter{animation:none!important}}`}</style>
    </div>
  );
}
