"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";

type FotoItem = {
  id: string;
  orderNumber: string;
  uploadedBy: string;
  uploadedByPhoto?: string | null;
  driveUrl: string;
  fileName: string;
  slot?: number;
  slotLabel?: string;
  createdAt: string;
};

type SlotState = {
  file: File | null;
  preview: string | null;
  qualityChecked: boolean;
};

const PHOTO_STEPS = [
  { id: 1, label: "Prima davanti", short: "Prima davanti", hint: "Viso frontale, capelli ben visibili." },
  { id: 2, label: "Prima dietro", short: "Prima dietro", hint: "Vista posteriore, lunghezza completa." },
  { id: 3, label: "Dopo davanti", short: "Dopo davanti", hint: "Risultato finale frontale." },
  { id: 4, label: "Dopo dietro", short: "Dopo dietro", hint: "Risultato finale posteriore." },
];

const emptySlots = (): SlotState[] => Array.from({ length: 4 }, () => ({ file: null, preview: null, qualityChecked: false }));

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeOrder(value: string) {
  return value.trim().replace(/^#/, "").toUpperCase();
}

function nextMissingSlot(slots: Set<number>) {
  return PHOTO_STEPS.findIndex((step) => !slots.has(step.id));
}

export function FotoUploadClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(emptySlots);
  const [activeSlot, setActiveSlot] = useState(0);
  const [items, setItems] = useState<FotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [cameraStatus, setCameraStatus] = useState<"starting" | "ready" | "blocked">("starting");

  const cleanOrderNumber = normalizeOrder(orderNumber);
  const activePreview = slots[activeSlot]?.preview ?? null;
  const activeQualityChecked = slots[activeSlot]?.qualityChecked ?? false;
  const currentStep = PHOTO_STEPS[activeSlot];
  const pendingSlots = slots
    .map((slot, index) => ({ ...slot, index }))
    .filter((slot) => Boolean(slot.file) && slot.qualityChecked);
  const pendingCount = pendingSlots.length;
  const unconfirmedCount = slots.filter((slot) => slot.file && !slot.qualityChecked).length;

  const uploadedSlots = useMemo(() => {
    if (!cleanOrderNumber) return new Set<number>();
    return new Set(
      items
        .filter((item) => normalizeOrder(item.orderNumber) === cleanOrderNumber && item.slot)
        .map((item) => Number(item.slot))
    );
  }, [cleanOrderNumber, items]);

  const groupedOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    const groups = new Map<string, {
      orderNumber: string;
      uploadedBy: string;
      lastDate: string;
      lastDriveUrl: string;
      slots: Set<number>;
    }>();

    items.forEach((item) => {
      const order = normalizeOrder(item.orderNumber);
      if (!order) return;
      const existing = groups.get(order);
      const currentDate = existing?.lastDate ?? "";
      const isNewer = !currentDate || new Date(item.createdAt).getTime() > new Date(currentDate).getTime();
      const group = existing ?? {
        orderNumber: order,
        uploadedBy: item.uploadedBy,
        lastDate: item.createdAt,
        lastDriveUrl: item.driveUrl,
        slots: new Set<number>(),
      };

      if (item.slot) group.slots.add(Number(item.slot));
      if (isNewer) {
        group.uploadedBy = item.uploadedBy;
        group.lastDate = item.createdAt;
        group.lastDriveUrl = item.driveUrl;
      }
      groups.set(order, group);
    });

    return Array.from(groups.values())
      .filter((group) => !text || group.orderNumber.toLowerCase().includes(text) || group.uploadedBy.toLowerCase().includes(text))
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [items, query]);

  useEffect(() => {
    fetch("/api/foto", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setMessage("Non riesco a caricare la lista foto."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      slots.forEach((slot) => {
        if (slot.preview) URL.revokeObjectURL(slot.preview);
      });
    };
  }, []);

  useEffect(() => {
    void startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activePreview && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [activePreview, activeSlot]);

  async function startCamera() {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      return;
    }

    setCameraStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus("ready");
    } catch {
      setCameraStatus("blocked");
      setMessage("Permesso fotocamera non attivo. Usa il tasto upload o abilita la fotocamera.");
    }
  }

  function selectFile(nextFile?: File | null) {
    if (!nextFile) return;
    setSlots((current) => {
      const nextSlots = current.map((slot, index) => {
        if (index !== activeSlot) return slot;
        if (slot.preview) URL.revokeObjectURL(slot.preview);
        return { file: nextFile, preview: URL.createObjectURL(nextFile), qualityChecked: false };
      });
      const nextEmptySlot = nextSlots.findIndex((slot, index) => index !== activeSlot && !slot.file);
      if (nextEmptySlot >= 0) setActiveSlot(nextEmptySlot);
      return nextSlots;
    });
    setMessage("");
  }

  async function captureLivePhoto() {
    if (cameraStatus !== "ready" || !videoRef.current || !streamRef.current) {
      await startCamera();
      if (!streamRef.current || !videoRef.current) cameraInputRef.current?.click();
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      cameraInputRef.current?.click();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
    if (!blob) return;

    const step = PHOTO_STEPS[activeSlot];
    const filename = `${cleanOrderNumber || "ordine"}-${step.short.replace(/\s+/g, "-").toLowerCase()}.jpg`;
    selectFile(new File([blob], filename, { type: "image/jpeg" }));
  }

  function clearCurrentSlot() {
    setSlots((current) => current.map((slot, index) => {
      if (index !== activeSlot) return slot;
      if (slot.preview) URL.revokeObjectURL(slot.preview);
      return { file: null, preview: null, qualityChecked: false };
    }));
    window.setTimeout(() => {
      if (streamRef.current && videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play().catch(() => undefined);
      } else {
        void startCamera();
      }
    }, 0);
  }

  function continueOrderByNumber(orderNumberToContinue: string) {
    const order = normalizeOrder(orderNumberToContinue);
    const sameOrderSlots = new Set(
      items
        .filter((row) => normalizeOrder(row.orderNumber) === order && row.slot)
        .map((row) => Number(row.slot))
    );
    const nextSlot = nextMissingSlot(sameOrderSlots);
    setOrderNumber(order);
    setActiveSlot(nextSlot >= 0 ? nextSlot : 0);
    setMessage(
      nextSlot >= 0
        ? `Continua ordine #${order}: ${PHOTO_STEPS[nextSlot].label}.`
        : `Ordine #${order} completo. Puoi scegliere uno slot per sostituire una foto.`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPendingPhotos() {
    setMessage("");
    if (!cleanOrderNumber) {
      setMessage("Inserisci il numero ordine.");
      return;
    }
    if (pendingSlots.length === 0) {
      cameraInputRef.current?.click();
      return;
    }

    setSaving(true);
    try {
      const uploadedItems: FotoItem[] = [];
      const uploadedIndexes = new Set<number>();
      for (const slot of pendingSlots) {
        if (!slot.file) continue;
        const step = PHOTO_STEPS[slot.index];
        const formData = new FormData();
        formData.append("orderNumber", cleanOrderNumber);
        formData.append("slot", String(slot.index + 1));
        formData.append("slotLabel", step.label);
        formData.append("file", slot.file);

        const response = await fetch("/api/foto", { method: "POST", body: formData });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Caricamento ${step.label} non riuscito.`);
        uploadedItems.push(result.item);
        uploadedIndexes.add(slot.index);
      }

      setItems((current) => [...uploadedItems, ...current]);
      setSlots((current) => current.map((slot, index) => {
        if (!uploadedIndexes.has(index)) return slot;
        if (slot.preview) URL.revokeObjectURL(slot.preview);
        return { file: null, preview: null, qualityChecked: false };
      }));
      const nextSlot = nextMissingSlot(new Set([...Array.from(uploadedSlots), ...uploadedItems.map((item) => Number(item.slot)).filter(Boolean)]));
      setActiveSlot(nextSlot >= 0 ? nextSlot : 0);
      setMessage(`${uploadedItems.length} foto caricate su Google Drive.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Caricamento non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  function toggleActiveQualityChecked() {
    setSlots((current) => current.map((slot, index) => (
      index === activeSlot ? { ...slot, qualityChecked: !slot.qualityChecked } : slot
    )));
  }

  function handlePrimaryPhotoAction() {
    if (pendingCount) {
      void uploadPendingPhotos();
      return;
    }
    if (unconfirmedCount) {
      setMessage("Prima conferma il controllo distacco della foto scattata.");
      return;
    }
    void captureLivePhoto();
  }

  return (
    <div className="-mx-4 -my-5 bg-[#050506] text-white sm:mx-auto sm:my-0 sm:max-w-[430px] sm:overflow-hidden sm:rounded-[42px] sm:border sm:border-black/10 sm:shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
      <section className="flex h-[100svh] flex-col overflow-hidden px-3 pt-2">
        <div className="shrink-0 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.24em] text-[#ff9fbd]">Paradise Photo</p>
              <h2 className="mt-0.5 font-serif text-[21px] font-black leading-none tracking-tight text-white">Foto ordine</h2>
            </div>
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ff9fbd] shadow-inner active:scale-95"
              title="Carica foto originale"
            >
              Libreria
            </button>
          </div>

          <div className="mt-2">
            <label>
              <span className="block text-[10px] font-semibold tracking-[0.04em] text-white/55">Numero ordine</span>
              <input
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="ORD-2024-00158"
                className="mt-0.5 h-8 w-full bg-transparent text-base font-black uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/30"
              />
            </label>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 pb-2">
            <div className="rounded-[18px] border border-[#E8C98B]/45 bg-[#E8C98B]/10 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E8C98B]/20 text-center text-[#F7DFA7]">
                  <div>
                    <div className="text-xl font-black leading-none">{activeSlot + 1}</div>
                    <div className="mt-0.5 text-[7px] font-black uppercase tracking-[0.14em]">di 4</div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#F7DFA7]">Foto {activeSlot + 1} di 4</p>
                  <p className="mt-0.5 font-serif text-[18px] font-black leading-none">{currentStep.label}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-white/64">{currentStep.hint}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={captureLivePhoto}
            className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/18 bg-[#202326] text-left shadow-inner"
          >
            {activePreview ? (
              <img src={activePreview} alt={currentStep.label} className="absolute inset-0 h-full w-full object-cover" />
            ) : cameraStatus !== "blocked" ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_38%,rgba(0,0,0,0.24)_100%)]" />
            )}

            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-80">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="border border-white/18" />
              ))}
            </div>

            <div className="pointer-events-none absolute left-5 top-5 h-8 w-8 border-l-2 border-t-2 border-[#F7DFA7]" />
            <div className="pointer-events-none absolute right-5 top-5 h-8 w-8 border-r-2 border-t-2 border-[#F7DFA7]" />
            <div className="pointer-events-none absolute bottom-5 left-5 h-8 w-8 border-b-2 border-l-2 border-[#F7DFA7]" />
            <div className="pointer-events-none absolute bottom-5 right-5 h-8 w-8 border-b-2 border-r-2 border-[#F7DFA7]" />
            <img
              src="/photo-woman-silhouette.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[7%] h-[86%] w-[74%] -translate-x-1/2 object-contain opacity-75 drop-shadow-[0_0_22px_rgba(255,255,255,0.2)]"
            />

            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-black text-white/85">Originale</div>
            <div className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/80">Live</div>
            {!activePreview ? (
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                <div className="grid size-16 place-items-center rounded-full bg-white text-black shadow-[0_0_0_8px_rgba(255,255,255,0.12)]">
                  <Camera className="size-8" />
                </div>
              </div>
            ) : null}
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,.heic,.heif,image/heic,image/heif"
          capture="environment"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*,.heic,.heif,image/heic,image/heif"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />

        <div className="z-10 -mx-3 mt-2 shrink-0 rounded-t-[22px] border-t border-white/10 bg-black px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2.5">
          {activePreview ? (
            <button
              type="button"
              onClick={toggleActiveQualityChecked}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                activeQualityChecked
                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
                  : "border-[#ff9fbd]/35 bg-[#ff9fbd]/10 text-white"
              }`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-black ${
                activeQualityChecked ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/35 bg-white/10 text-white"
              }`}>
                {activeQualityChecked ? <Check className="size-4" /> : ""}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.08em]">Distacco controllato</span>
                <span className="block truncate text-[10px] font-semibold opacity-70">Conferma che capelli e attaccature siano ben visibili.</span>
              </span>
            </button>
          ) : null}

          <div className="grid grid-cols-4 gap-2">
            {PHOTO_STEPS.map((step, index) => {
              const filled = Boolean(slots[index]?.file);
              const checked = Boolean(slots[index]?.qualityChecked);
              const uploaded = uploadedSlots.has(step.id);
              const isActive = activeSlot === index;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveSlot(index)}
                  className={`min-h-[52px] rounded-[15px] border px-2 py-2 text-left transition active:scale-[0.98] ${
                    isActive
                      ? "border-[#ff9fbd] bg-[#ff9fbd]/12 text-white shadow-[0_0_28px_rgba(255,159,189,0.18)]"
                      : "border-white/10 bg-white/[0.04] text-white/58"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid size-6 place-items-center rounded-full text-[11px] font-black ${isActive ? "bg-[#ff9fbd] text-black" : "bg-white/12 text-white/75"}`}>{step.id}</span>
                    {uploaded || checked ? <Check className="size-4 text-emerald-300" /> : null}
                  </div>
                  <span className="mt-1 block text-[8px] font-black uppercase leading-3 tracking-[0.04em]">{step.short}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-[48px_1fr_48px] items-center gap-3">
            <button type="button" onClick={() => libraryInputRef.current?.click()} className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/10 active:scale-95" title="Carica HEIC dalla libreria">
              <UploadCloud className="size-5" />
            </button>
            <button
              type="button"
              onClick={handlePrimaryPhotoAction}
              disabled={saving}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff9fbd] to-[#ffd1dc] text-sm font-black text-black shadow-[0_10px_38px_rgba(255,159,189,0.28)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : pendingCount ? <CheckCircle2 className="size-5" /> : <Camera className="size-5" />}
              {saving ? "Carico..." : pendingCount ? `Carica ${pendingCount} foto` : unconfirmedCount ? "Conferma controllo" : "Scatta foto"}
            </button>
            <button type="button" onClick={clearCurrentSlot} className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/10 active:scale-95">
              {activePreview ? <X className="size-5" /> : <RotateCcw className="size-5" />}
            </button>
          </div>

          {message ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white">
              {message}
            </div>
          ) : (
            <p className="mt-2 text-center text-[8px] font-bold uppercase tracking-[0.08em] text-white/35">
              Per salvare HEIC usa il tasto upload e scegli la foto originale dalla libreria.
            </p>
          )}
        </div>
      </section>

      <section className="bg-[#f7f1f4] px-3 py-4 text-[#1f1f1f]">
        <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-black/5 p-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-black/35">Archivio Drive</p>
              <h3 className="text-[22px] font-black leading-none">Ordini in corso</h3>
            </div>
            <label className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca ordine o nome..."
                className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm font-bold outline-none"
              />
            </label>
          </div>

          <div className="divide-y divide-black/5">
            {loading ? (
              <div className="p-6 text-sm font-bold text-black/45">Caricamento lista...</div>
            ) : groupedOrders.length ? (
              groupedOrders.map((order) => {
                const count = order.slots.size;
                const nextSlotIndex = nextMissingSlot(order.slots);
                const complete = count >= PHOTO_STEPS.length;
                return (
                <div key={order.orderNumber} className="grid w-full gap-3 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => continueOrderByNumber(order.orderNumber)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#FFD6EA] text-[#1f1f1f]">
                        <Camera className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[19px] font-black leading-none">#{order.orderNumber}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${complete ? "bg-emerald-100 text-emerald-700" : "bg-[#FFD6EA] text-[#1f1f1f]"}`}>
                            {count}/4
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[12px] font-semibold text-black/45">
                          {complete ? "Completo" : `Continua: ${PHOTO_STEPS[nextSlotIndex]?.label}`} · {order.uploadedBy} · {formatDate(order.lastDate)}
                        </p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-black/30" />
                    </button>
                    {order.lastDriveUrl ? (
                      <a
                        href={order.lastDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-11 shrink-0 place-items-center rounded-2xl border border-black/10 text-black transition hover:bg-black/[0.03]"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
                    {PHOTO_STEPS.map((step) => {
                      const done = order.slots.has(step.id);
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => {
                            setOrderNumber(order.orderNumber);
                            setActiveSlot(step.id - 1);
                            setMessage(`Ordine #${order.orderNumber}: ${step.label}.`);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`min-w-0 rounded-2xl border px-2 py-2 text-left text-[9px] font-black uppercase leading-3 ${
                            done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-black/10 bg-black/[0.02] text-black/45"
                          }`}
                        >
                          <span className="mb-1 flex items-center justify-between">
                            {step.id}
                            {done ? <Check className="size-3" /> : null}
                          </span>
                          <span className="block truncate">{step.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
              })
            ) : (
              <div className="p-6 text-sm font-bold text-black/45">Nessuna foto caricata.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
