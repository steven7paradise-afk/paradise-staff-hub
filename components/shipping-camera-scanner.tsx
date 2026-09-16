"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, Check, Flashlight, FlashlightOff, Loader2, X } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import styles from "./shipping-camera-scanner.module.css";

type CameraCapabilities = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step: number } };

export function ShippingCameraScanner({ target, onRead, onClose }: { target: "TRACKING" | "BARCODE"; onRead: (code: string) => void; onClose: () => void }) {
  const id = `shipping-camera-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lifecycle = useRef<Promise<void>>(Promise.resolve());
  const callbacks = useRef({ onRead, onClose });
  callbacks.current = { onRead, onClose };
  const dialog = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"starting" | "ready" | "read" | "error">("starting");
  const [error, setError] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") callbacks.current.onClose();
      if (event.key !== "Tab") return;
      const elements = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") || [])];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keys); previous?.focus(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let locked = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped: Promise<void> | null = null;
    const stop = () => stopped ||= (async () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (scanner?.isScanning) await scanner.stop().catch(() => {});
      if (scannerRef.current === scanner) scannerRef.current = null;
    })();
    const accept = (code: string) => {
      if (cancelled || locked || !code.trim()) return;
      locked = true; setState("read");
      if (navigator.vibrate) navigator.vibrate(60);
      void stop().then(() => { if (!cancelled) callbacks.current.onRead(code.trim()); });
    };
    setState("starting"); setError(""); setTorch(false); setTorchAvailable(false); setZoomRange(null);
    const start = lifecycle.current.then(async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode(id, { verbose: false, useBarCodeDetectorIfSupported: true,
        formatsToSupport: target === "BARCODE" ? [F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8, F.QR_CODE] : [F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE, F.EAN_13] });
      scannerRef.current = scanner;
      const portrait = window.matchMedia("(max-width: 640px)").matches;
      // Read the whole camera frame: long labels must not fall outside a tiny crop.
      await scanner.start({ facingMode: "environment" }, {
        fps: 8, disableFlip: true,
        videoConstraints: { facingMode: { ideal: "environment" }, width: { ideal: portrait ? 720 : 1280 }, height: { ideal: portrait ? 1280 : 720 }, aspectRatio: { ideal: portrait ? .75 : 16 / 9 } },
      }, accept, () => {});
      if (cancelled) { await stop(); return; }
      if (locked) return;
      setState("ready");
      // Decode sensor pixels directly: fullscreen object-fit must not distort bars.
      void import("@/lib/shipping-frame-decoder").then(({ createShippingFrameDecoder }) => {
        if (cancelled || locked) return;
        const decode = createShippingFrameDecoder(target);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        let frame = 0;
        const scan = () => {
          if (cancelled || locked || !context) return;
          const video = document.getElementById(id)?.querySelector("video");
          if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
            // Alternate full image and a central crop, keeping the original aspect ratio.
            const sourceHeight = video.videoHeight * (frame++ % 2 ? .6 : 1);
            const scale = Math.min(1, 1280 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(sourceHeight * scale);
            context.drawImage(video, 0, (video.videoHeight - sourceHeight) / 2, video.videoWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            try {
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = decode(image.data, image.width, image.height);
              if (code) { accept(code); return; }
            } catch { /* A frame may be unavailable while the camera changes exposure. */ }
          }
          fallbackTimer = setTimeout(scan, 350);
        };
        fallbackTimer = setTimeout(scan, 100);
      }).catch(() => { /* The primary decoder remains active if the extra chunk fails. */ });
      try {
        const capabilities = scanner.getRunningTrackCapabilities() as CameraCapabilities;
        setTorchAvailable(Boolean(capabilities.torch));
        if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
          setZoomRange(capabilities.zoom); setZoom(scanner.getRunningTrackSettings().zoom ?? capabilities.zoom.min);
        }
        await scanner.applyVideoConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      } catch { /* Optional camera controls are not supported on every device. */ }
    }).catch(async () => {
      await stop();
      if (!cancelled) { setState("error"); setError("Non riesco ad accedere alla fotocamera. Controlla i permessi o usa il lettore esterno."); }
    });
    lifecycle.current = start;
    return () => { cancelled = true; lifecycle.current = start.then(stop); };
  }, [id, target, attempt]);

  async function adjust(value: { torch?: boolean; zoom?: number }) {
    if (!scannerRef.current || adjusting) return;
    setAdjusting(true); setError("");
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [value as MediaTrackConstraintSet] });
      if (value.torch !== undefined) setTorch(value.torch);
      if (value.zoom !== undefined) setZoom(value.zoom);
    } catch { setError("Questo controllo non è disponibile sulla fotocamera. Puoi continuare a scansionare."); }
    finally { setAdjusting(false); }
  }

  return createPortal(<div className={styles.backdrop}>
    <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <header className={styles.header}><div><span>SCANNER {target === "BARCODE" ? "PRODOTTO" : "SPEDIZIONE"}</span><h2 id={`${id}-title`}>Inquadra il codice a barre</h2></div><button type="button" aria-label="Chiudi fotocamera" onClick={onClose}><X size={22}/></button></header>
      <div className={styles.viewport} data-state={state}>
        <div id={id} className={styles.reader}/>
        <div className={styles.guide} aria-hidden="true"><i/><i/><i/><i/>{state === "ready" && <div className={styles.laser}/>}</div>
        {state === "starting" && <div className={styles.message}><Loader2 className={styles.spinner} size={26}/><span>Avvio fotocamera…</span></div>}
        {state === "read" && <div className={styles.message}><Check size={32}/><span>Codice letto</span></div>}
        {state === "error" && <div className={styles.message}><Barcode size={30}/><p>{error}</p><button onClick={()=>setAttempt(value=>value+1)}>Riprova</button></div>}
      </div>
      <footer className={styles.footer}>
        <div className={styles.status} role="status"><span data-ready={state === "ready"}/>{state === "ready" ? "Scansione automatica attiva" : state === "read" ? "Controllo del codice…" : state === "error" ? "Fotocamera non disponibile" : "Connessione alla fotocamera"}</div>
        <p>Centra tutta l’etichetta. Tieni il telefono fermo e lascia mettere a fuoco.</p>
        {error && state !== "error" && <p role="alert">{error}</p>}
        <div className={styles.controls}>
          {torchAvailable && <button aria-label={torch ? "Spegni luce" : "Accendi luce"} aria-pressed={torch} disabled={adjusting || state !== "ready"} onClick={()=>void adjust({torch:!torch})}>{torch ? <FlashlightOff size={19}/> : <Flashlight size={19}/>}</button>}
          {zoomRange && <label>Zoom<input aria-label="Zoom fotocamera" type="range" min={zoomRange.min} max={Math.min(zoomRange.max,4)} step={zoomRange.step || .1} value={zoom} disabled={adjusting || state !== "ready"} onChange={event=>void adjust({zoom:Number(event.target.value)})}/></label>}
          <button className={styles.manual} onClick={onClose}>Usa lettore o codice manuale</button>
        </div>
      </footer>
    </div>
  </div>, document.body);
}
