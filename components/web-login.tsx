"use client";

import { useState, type FormEvent } from "react";
import { WebQRLogin } from "./web-qr-login";
import { webRequest } from "@/lib/web-api-response";
import styles from "./web-calls.module.css";

type User = { id: string; name: string; photo_url?: string | null };

export function WebLogin({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"password" | "qr">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await webRequest("/api/mobile/web-calls/login", { email: email.trim(), password });
      setPassword("");
      onLogin(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Accesso non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <nav className={styles.loginMethods} aria-label="Metodo di accesso">
      <button type="button" disabled={busy} aria-pressed={mode === "password"} onClick={() => { setMode("password"); setError(""); }}>Email e password</button>
      <button type="button" disabled={busy} aria-pressed={mode === "qr"} onClick={() => { setMode("qr"); setPassword(""); setError(""); }}>Codice QR</button>
    </nav>
    {mode === "qr" ? <WebQRLogin onLogin={onLogin} /> : <section className={styles.login}>
      <div><span className={styles.eyebrow}>MY PARADISE WEB</span><h1>Il tuo team.<br />Anche dal computer.</h1><p>Accedi con la stessa email e password che usi nell’app MyParadise, per ritrovare le tue chat e chiamare i colleghi.</p><p>Puoi anche collegare il computer usando il codice QR dal tuo telefono.</p></div>
      <form onSubmit={submit} aria-busy={busy}>
        <h2>Accedi a MyParadise</h2>
        <label htmlFor="web-login-email">Email<input id="web-login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label htmlFor="web-login-password">Password<input id="web-login-password" name="password" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Accesso in corso…" : "Accedi"}</button>
        <p>Hai dimenticato la password? Rivolgiti al tuo responsabile.</p>
        <p>La sessione dura 8 ore. Esci al termine se usi un computer condiviso.</p>
      </form>
    </section>}
  </>;
}
