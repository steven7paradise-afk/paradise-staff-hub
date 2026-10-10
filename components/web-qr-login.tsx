"use client";
import { useEffect, useRef, useState } from "react";
import { webRequest, WebApiError, connectionMessage } from "@/lib/web-api-response";
import QRCode from "qrcode";
import styles from "./web-calls.module.css";

async function link(action: string, id?: string) {
  return webRequest("/api/mobile/web-link", { action, id });
}
export function WebQRLogin({ onLogin }: { onLogin: (user: { id: string; name: string; photo_url?: string | null }) => void }) {
  const [code, setCode] = useState<{ id: string; image: string; verification: string; expires: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const callback = useRef(onLogin); callback.current = onLogin;
  async function generate() {
    if (busy) return;
    setBusy(true); setError(""); setCode(null);
    try {
      const data = await link("create");
      const image = await QRCode.toDataURL(data.qr, { width: 280, margin: 3, errorCorrectionLevel: "H", color: { dark: "#241f24", light: "#ffffff" } });
      setCode({ id: data.id, image, verification: data.verification, expires: data.expires });
      setSeconds(Math.max(0, Math.ceil((data.expires - Date.now()) / 1000)));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!code) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => setSeconds(Math.max(0, Math.ceil((code.expires - Date.now()) / 1000))), 1000);
    const poll = async () => {
      if (Date.now() >= code.expires) return;
      try { const data = await link("poll", code.id); if (stopped) return; setError(old => old === connectionMessage ? "" : old); if (data.user) { callback.current(data.user); return; } }
      catch (e) { if (!stopped) { setError((e as Error).message); if (e instanceof WebApiError && e.temporary) { timer = setTimeout(poll, 3000); return; } setCode(null); } return; }
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 2000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(tick); };
  }, [code]);
  return <section className={styles.qrLogin}>
    <div><span className={styles.eyebrow}>MY PARADISE WEB</span><h1>Il tuo team.<br />A portata di QR.</h1><p>Collega il computer dal tuo telefono, senza inserire credenziali.</p>
      <ol><li>Apri l’app MyParadise sul telefono.</li><li>Vai in <strong>Profilo → Collega un computer</strong>.</li><li>Inquadra il QR e conferma il collegamento.</li></ol>
      <small>Autorizza solo un computer che stai usando personalmente. Non condividere questo codice.</small>
    </div>
    <div className={styles.qrCard}><h2>Inquadra per accedere</h2>
      {code && seconds > 0 ? <><div className={styles.qrFrame}><img className={styles.qrImage} src={code.image} alt="QR per collegare questo computer a MyParadise" /><img className={styles.qrLogo} src="/icon-192.png" alt="" aria-hidden="true" /></div><p>Confronta il codice sul telefono: <strong>{code.verification}</strong></p><small aria-live="off">Scade tra {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</small></> : <><div className={styles.qrPlaceholder} aria-hidden="true">⌘</div><p>{code ? "Il codice è scaduto." : "Accedi in modo sicuro dall’app MyParadise."}</p><button className={styles.primary} disabled={busy} onClick={() => void generate()}>{busy ? "Preparazione…" : code ? "Genera un nuovo QR" : "Mostra codice QR"}</button></>}
      {error && <p role="alert">{error}</p>}<small>Il collegamento dura 8 ore. Puoi uscire dal menu in alto.</small>
    </div>
  </section>;
}
