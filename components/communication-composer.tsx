"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  Eye,
  Link as LinkIcon,
  Megaphone,
  Paperclip,
  Send,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import "./communication-composer.css";

type Recipient = {
  id: string;
  name: string;
  photoUrl: string | null;
  locationId: string | null;
  locationName: string;
};

type LocationOption = { id: string; name: string };
type Target = "all" | "location" | "user";

export function CommunicationComposer({
  role,
  recipients,
  locations,
}: {
  role: Role;
  recipients: Recipient[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Target>("all");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [bannerUntil, setBannerUntil] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [attachedFileUrl, setAttachedFileUrl] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [attachedImage, setAttachedImage] = useState(false);
  const [imageAsBackground, setImageAsBackground] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const recipientsByLocation = useMemo(() => locations.map((location) => ({
    ...location,
    recipients: recipients.filter((recipient) => recipient.locationId === location.id),
  })), [locations, recipients]);
  const recipientsWithoutLocation = useMemo(
    () => recipients.filter((recipient) => !recipient.locationId),
    [recipients],
  );

  const targetLabel = target === "all"
    ? role === "RESPONSABILE" ? "Tutto il personale del tuo salone" : "Tutto lo staff"
    : target === "location"
      ? locations.find((location) => location.id === targetId)?.name || "Scegli un salone"
      : recipients.find((recipient) => recipient.id === targetId)?.name || "Scegli una persona";

  const isReady = Boolean(title.trim() && message.trim() && (target === "all" || targetId));
  const audienceCount = target === "all" ? recipients.length : target === "location" ? recipients.filter((recipient) => recipient.locationId === targetId).length : recipients.some((recipient) => recipient.id === targetId) ? 1 : 0;

  function changeTarget(value: Target) {
    setTarget(value);
    if (value === "location") setTargetId(locations[0]?.id ?? "");
    if (value === "user") setTargetId(recipients[0]?.id ?? "");
    if (value === "all") setTargetId("");
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setStatus("Caricamento allegato in corso...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/notifications/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossibile caricare il file.");
      setAttachedFileUrl(data.url);
      setAttachedFileName(data.name);
      setAttachedImage(Boolean(data.isImage));
      setImageAsBackground(false);
      setStatus("Allegato caricato correttamente.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile caricare il file.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function publish() {
    if (!isReady || sending) return;
    setSending(true);
    setStatus("Pubblicazione in corso...");
    try {
      const publishedMessage = attachedFileUrl && attachedFileName
        ? `${message.trim()}\n\n📄 ALLEGATO DRIVE: [${attachedFileName}](${attachedFileUrl})`
        : message.trim();
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          targetId,
          title: title.trim(),
          message: publishedMessage,
          bannerUntil,
          bannerImageUrl: attachedImage && imageAsBackground ? attachedFileUrl : null,
          actionUrl: customLinkUrl.trim() || attachedFileUrl || "/notifications",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Comunicazione non inviata.");
      setStatus(`Comunicazione inviata a ${data.sent} destinatari.`);
      router.push("/notifications?section=sent");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Comunicazione non inviata.");
      setSending(false);
    }
  }

  return (
    <div className="communication-workspace min-h-[calc(100vh-8rem)] px-3 py-4 text-[#202631] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <header className="flex flex-col gap-5 px-1 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className="grid size-11 shrink-0 place-items-center border border-black/10 bg-white transition hover:bg-black hover:text-white"
              aria-label="Torna alle comunicazioni"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C13F75]">Comunicazioni aziendali</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#17151A] sm:text-3xl">Nuova comunicazione</h1>
              <p className="mt-2 text-sm text-black/55">Invia un messaggio allo staff e pubblica il banner nell’app.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className="h-11 flex-1 border border-black/10 px-5 text-xs font-black uppercase tracking-wider sm:flex-none"
            >
              Annulla
            </button>
            <a href="#communication-review" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 text-sm font-medium transition hover:bg-black/[0.03] sm:flex-none"><Eye className="size-4" /> Controlla anteprima</a>
          </div>
        </header>

        <div className="communication-layout grid items-start gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_350px]">
          <main className="space-y-6 rounded-xl border border-black/[0.07] bg-white p-5 sm:p-7">
            <section>
              <div className="mb-5 flex items-center gap-3 pb-1">
                <span className="grid size-10 place-items-center bg-[#FBE7F0] text-[#C13F75]"><FileText className="size-5" /></span>
                <div>
                  <h2 className="text-base font-semibold">Messaggio</h2>
                  <p className="mt-1 text-xs text-black/50">Titolo e testo sono obbligatori.</p>
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50">Titolo</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Inserisci un titolo chiaro"
                  className="mt-2 h-12 w-full rounded-lg border border-black/15 bg-white px-3 text-base font-medium outline-none transition placeholder:text-black/40 focus:border-[#C13F75] focus:ring-2 focus:ring-[#C13F75]/10"
                />
                <span className="mt-1 block text-right text-[10px] font-bold text-black/30">{title.length}/120</span>
              </label>

              <label className="mt-6 block">
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50">Testo</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Scrivi qui la comunicazione completa..."
                  className="mt-2 min-h-[220px] w-full resize-y rounded-lg border border-black/15 bg-white p-4 text-base leading-7 outline-none transition placeholder:text-black/40 focus:border-[#C13F75] focus:ring-2 focus:ring-[#C13F75]/10"
                />
              </label>
            </section>

            <section className="grid gap-4 border-t border-black/10 pt-6 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-black/50">Allegato</p>
                {attachedFileName ? (
                  <div className="mt-2 flex min-h-14 items-center justify-between gap-3 border border-[#E8A9C2] bg-[#FFF5F9] px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#9E315F]"><Paperclip className="size-4 shrink-0" /><span className="truncate">{attachedFileName}</span></span>
                    <button type="button" onClick={() => { setAttachedFileName(""); setAttachedFileUrl(""); setAttachedImage(false); setImageAsBackground(false); }} aria-label="Rimuovi allegato"><X className="size-4" /></button>
                  </div>
                ) : (
                  <label className="mt-2 flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed border-black/20 px-4 text-sm font-bold transition hover:border-[#C13F75] hover:bg-[#FFF5F9]">
                    <UploadCloud className="size-4 text-[#C13F75]" /> {uploadingFile ? "Caricamento..." : "Carica immagine o PDF"}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                  </label>
                )}
                {attachedImage && <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={imageAsBackground} onChange={(event) => setImageAsBackground(event.target.checked)} className="size-4 accent-[#b53b74]" /> Usa come sfondo del banner</label>}
              </div>
              <label>
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50">Link esterno opzionale</span>
                <span className="mt-2 flex min-h-14 items-center gap-2 border border-black/10 px-4 focus-within:border-[#C13F75]">
                  <LinkIcon className="size-4 shrink-0 text-black/35" />
                  <input value={customLinkUrl} onChange={(event) => setCustomLinkUrl(event.target.value)} placeholder="https://..." className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" />
                </span>
              </label>
            </section>
          </main>

          <aside className="space-y-5">
            <section className="rounded-xl border border-black/[0.07] bg-white p-5">
              <div className="flex items-center gap-3 border-b border-black/10 pb-4">
                <span className="grid size-10 place-items-center bg-[#17151A] text-white"><Users className="size-5" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Distribuzione</p>
                  <h2 className="font-black">Destinatari</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {[
                  { id: "all" as Target, label: role === "RESPONSABILE" ? "Personale del mio salone" : "Tutto lo staff", icon: Users },
                  ...(role !== "RESPONSABILE" ? [{ id: "location" as Target, label: "Un salone", icon: Building2 }] : []),
                  { id: "user" as Target, label: "Una persona", icon: UserRound },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => changeTarget(option.id)}
                      aria-pressed={target === option.id}
                      className={cn(
                        "flex min-h-12 items-center gap-3 border px-4 text-left text-sm font-bold transition",
                        target === option.id ? "border-[#C13F75] bg-[#FFF0F6] text-[#9E315F]" : "border-black/10 hover:bg-black/[0.02]",
                      )}
                    >
                      <Icon className="size-4" /> <span className="flex-1">{option.label}</span>
                      {target === option.id ? <Check className="size-4" /> : null}
                    </button>
                  );
                })}
              </div>

              {target === "location" ? (
                <label className="mt-4 block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-black/45">Scegli il salone</span>
                  <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-2 h-12 w-full border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C13F75]">
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </label>
              ) : null}

              {target === "user" ? (
                <label className="mt-4 block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-black/45">Scegli la persona</span>
                  <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-2 h-12 w-full border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C13F75]">
                    {recipientsByLocation.map((location) => location.recipients.length ? (
                      <optgroup key={location.id} label={location.name}>
                        {location.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
                      </optgroup>
                    ) : null)}
                    {recipientsWithoutLocation.length ? (
                      <optgroup label="Senza salone">{recipientsWithoutLocation.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</optgroup>
                    ) : null}
                  </select>
                </label>
              ) : null}
              <p className="mt-4 border-t border-black/10 pt-4 text-sm text-black/60"><span className="font-semibold text-black/80">{audienceCount}</span> {audienceCount === 1 ? "destinatario" : "destinatari"} selezionati</p>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold">Durata del banner</h2>
              <p className="mt-2 text-sm leading-6 text-black/60">Visibile per 3 giorni dalla pubblicazione. Scegli una data solo per prolungarlo.</p>
              <label className="mt-4 block text-sm font-medium">
                Visibile fino al <span className="font-normal text-black/50">(facoltativo)</span>
                <input type="date" value={bannerUntil} onChange={(event) => setBannerUntil(event.target.value)} disabled={sending} className="mt-2 h-11 w-full rounded-lg border border-black/15 bg-white px-3 outline-none focus:border-[#C13F75]" />
              </label>
              <p className="mt-3 text-xs text-black/50">{bannerUntil ? `Fino al ${bannerUntil.split("-").reverse().join("/")}, a fine giornata (ora italiana).` : "Scadenza automatica dopo 72 ore. La comunicazione resta nell’archivio."}</p>
            </section>

            <section id="communication-review" className="scroll-mt-24 overflow-hidden rounded-xl border border-black/10 bg-white">
              <div className="border-b border-black/10 bg-[#fafafa] px-5 py-4">
                <p className="text-sm font-semibold">Anteprima del banner</p>
                <p className="mt-1 break-words text-xs text-black/50">{targetLabel} · {bannerUntil ? "Fino al " + bannerUntil.split("-").reverse().join("/") : "Visibile per 3 giorni"}</p>
              </div>
              <div className="p-5" style={attachedImage && imageAsBackground ? { backgroundImage: `linear-gradient(90deg,rgba(35,12,25,.88),rgba(35,12,25,.55)),url(${JSON.stringify(attachedFileUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <span className="inline-flex items-center gap-1.5 bg-[#FBE7F0] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#A73362]"><Megaphone className="size-3" /> Comunicazione</span>
                <h3 className="mt-4 text-xl font-black leading-tight">{title.trim() || "Titolo della comunicazione"}</h3>
                <p className="mt-3 line-clamp-6 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-black/60">{message.trim() || "Il testo apparirà qui mentre scrivi."}</p>
                <div className="communication-preview-action"><span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 text-sm font-semibold">Continua <ArrowLeft className="size-4 rotate-180" /></span></div>
                {attachedFileName ? <p className="mt-4 flex items-center gap-2 border-t border-black/10 pt-4 text-xs font-bold text-[#A73362]"><Paperclip className="size-3.5" /> {attachedFileName}</p> : null}
              </div>
            </section>

            {status ? <p role="status" aria-live="polite" className={cn("rounded-lg border px-4 py-3 text-sm font-medium", status.startsWith("Comunicazione inviata") || status.startsWith("Allegato") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#E8A9C2] bg-[#FFF5F9] text-[#9E315F]")}>{status}</p> : null}
          </aside>
        </div>
        <footer className="flex flex-col gap-4 rounded-xl border border-black/[0.07] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold">{isReady ? "Pronta per la pubblicazione" : "Completa la comunicazione"}</p><p className="mt-1 text-xs leading-5 text-black/55">{isReady ? `${audienceCount} destinatari · banner ${bannerUntil ? "fino al " + bannerUntil.split("-").reverse().join("/") : "attivo per 3 giorni"}` : "Inserisci titolo, testo e scegli i destinatari."}</p></div>
          <button type="button" onClick={publish} disabled={!isReady || sending || uploadingFile || !audienceCount} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#b53b74] px-5 text-sm font-semibold text-white transition hover:bg-[#96305f] disabled:cursor-not-allowed disabled:bg-black/20"><Send className="size-4" />{sending ? "Pubblicazione in corso…" : "Pubblica comunicazione"}</button>
        </footer>
      </div>
    </div>
  );
}
