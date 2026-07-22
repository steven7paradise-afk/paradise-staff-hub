"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { AlertCircle, Loader2, KeyRound, Mail } from "lucide-react";
import { Button, Field } from "@/components/ui";

const DEFAULT_LOGIN_DESTINATION = "/dashboard";

function normalizeLoginDestination(value?: string | null, fallback = DEFAULT_LOGIN_DESTINATION) {
  if (!value) return fallback;

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const isCurrentOrigin = typeof window !== "undefined" && parsed.origin === window.location.origin;
    const isLocalhostRedirect = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);

    if (isCurrentOrigin || isLocalhostRedirect) {
      const destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return destination.startsWith("/") ? destination : fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

type LoginFormVariant = "default" | "mobile-overlay";

export function LoginForm({ variant = "default" }: { variant?: LoginFormVariant }) {
  const [loginMode, setLoginMode] = useState<"email" | "pin">("pin");
  const [expandedMode, setExpandedMode] = useState<"email" | "pin" | null>(
    variant === "mobile-overlay" ? null : "pin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const isMobileOverlay = variant === "mobile-overlay";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setError("");
    setLoading(true);

    try {
      const callbackUrl = normalizeLoginDestination(
        new URLSearchParams(window.location.search).get("callbackUrl"),
      );

      await signOut({ redirect: false });

      let result;
      if (loginMode === "pin") {
        result = await signIn("credentials", {
          pin,
          redirect: false,
          callbackUrl,
        });
      } else {
        result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl,
        });
      }

      if (result?.error) {
        submittingRef.current = false;
        setLoading(false);
        setError(loginMode === "pin" ? "PIN personale non corretto." : "Email o password non corretti.");
        return;
      }

      const destination = normalizeLoginDestination(result?.url, callbackUrl);
      router.prefetch(destination);
      window.location.replace(destination);
    } catch {
      submittingRef.current = false;
      setLoading(false);
      setError("Accesso non completato. Controlla la connessione e riprova.");
    }
  }

  return (
    <div className={isMobileOverlay ? "space-y-4" : "space-y-5"}>
      {isMobileOverlay ? null : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black/40 dark:text-white/40">
            Metodo di accesso
          </p>
          <p className="text-sm leading-relaxed text-black/55 dark:text-white/55">
            Scegli accesso rapido con PIN oppure login classico con email e password.
          </p>
        </div>
      )}

      <div
        className={
          isMobileOverlay
            ? "grid grid-cols-2 gap-3"
            : "grid grid-cols-2 gap-2 rounded-[22px] border border-black/5 bg-[#FFF4F8] p-1.5 dark:border-white/5 dark:bg-white/5"
        }
      >
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoginMode("pin");
            setExpandedMode("pin");
            setError("");
          }}
          className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
            isMobileOverlay
              ? expandedMode === "pin"
                ? "rounded-2xl border border-white/30 bg-white text-black shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                : "rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/18"
              : loginMode === "pin"
                ? "rounded-[18px] bg-white text-black shadow-[0_10px_30px_rgba(17,17,17,0.08)] dark:bg-neutral-800 dark:text-white"
                : "rounded-[18px] text-black/55 hover:bg-white/70 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <KeyRound className="size-4" />
          PIN
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoginMode("email");
            setExpandedMode("email");
            setError("");
          }}
          className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
            isMobileOverlay
              ? expandedMode === "email"
                ? "rounded-2xl border border-white/30 bg-white text-black shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                : "rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/18"
              : loginMode === "email"
                ? "rounded-[18px] bg-white text-black shadow-[0_10px_30px_rgba(17,17,17,0.08)] dark:bg-neutral-800 dark:text-white"
                : "rounded-[18px] text-black/55 hover:bg-white/70 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <Mail className="size-4" />
          Email
        </button>
      </div>

      {isMobileOverlay && !expandedMode ? null : (
        <form className="space-y-4" onSubmit={submit}>
        {loginMode === "pin" ? (
          <div className="space-y-2">
            <label
              htmlFor="login-pin"
              className={`block text-[11px] font-bold uppercase tracking-[0.22em] ${
                isMobileOverlay ? "text-white/70" : "text-black/45 dark:text-white/45"
              }`}
            >
              PIN personale
            </label>
            <Field
              id="login-pin"
              name="pin"
              type="password"
              placeholder="Inserisci il tuo PIN a 6 cifre"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={loading}
              required
              className={
                isMobileOverlay
                  ? "border-white/20 bg-white/10 text-white placeholder:text-white/45"
                  : undefined
              }
            />
            <p className={`text-xs leading-relaxed ${isMobileOverlay ? "text-white/65" : "text-black/45 dark:text-white/45"}`}>
              Usa lo stesso PIN che utilizzi sul tablet per timbrare.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className={`block text-[11px] font-bold uppercase tracking-[0.22em] ${
                  isMobileOverlay ? "text-white/70" : "text-black/45 dark:text-white/45"
                }`}
              >
                Email
              </label>
              <Field
                id="login-email"
                name="email"
                type="email"
                placeholder="email@paradisebeauty.it"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmail((current) => current.trim().toLowerCase())}
                disabled={loading}
                required
                className={
                  isMobileOverlay
                    ? "border-white/20 bg-white/10 text-white placeholder:text-white/45"
                    : undefined
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className={`block text-[11px] font-bold uppercase tracking-[0.22em] ${
                  isMobileOverlay ? "text-white/70" : "text-black/45 dark:text-white/45"
                }`}
              >
                Password
              </label>
              <Field
                id="login-password"
                name="password"
                type="password"
                placeholder="Inserisci la tua password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
                className={
                  isMobileOverlay
                    ? "border-white/20 bg-white/10 text-white placeholder:text-white/45"
                    : undefined
                }
              />
            </div>

            <p className={`text-xs leading-relaxed ${isMobileOverlay ? "text-white/65" : "text-black/45 dark:text-white/45"}`}>
              Inserisci la tua email completa e la password personale.
            </p>
          </>
        )}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 animate-pulse-danger flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 animate-bounce" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          className={`w-full py-3 text-sm font-bold transition active:scale-[0.97] disabled:pointer-events-none disabled:cursor-wait disabled:opacity-70 ${
            isMobileOverlay
              ? "rounded-2xl bg-white text-black hover:bg-white/90"
              : "rounded-[18px]"
          }`}
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Accesso in corso...
            </span>
          ) : (
            "Entra nel pannello"
          )}
        </Button>
        </form>
      )}
    </div>
  );
}
