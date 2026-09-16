import type { ErrorEvent } from "@sentry/nextjs";

// Public ingestion address, not an administrative credential.
export const glitchtipDsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN || "https://3128068f9eec4855a9bd4ecab829ff65@app.glitchtip.com/27909";

const technicalMessages = new Set(["Failed to fetch", "NetworkError", "Load failed", "Script error.", "ResizeObserver loop limit exceeded"]);
const errorTypes = new Set(["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError", "AggregateError"]);

/** Allowlist only technical diagnostics: never send requests, identities or free text. */
export function sanitizeGlitchtipEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: process.env.NODE_ENV,
    exception: { values: event.exception?.values?.map(exception => ({
      type: errorTypes.has(exception.type || "") ? exception.type : "Error",
      value: technicalMessages.has(exception.value || "") ? exception.value : "Application error (private message omitted)",
      stacktrace: { frames: exception.stacktrace?.frames?.map(frame => ({
        // Retain only the source basename; paths, queries and local usernames are omitted.
        filename: frame.filename?.split(/[?#]/)[0].split(/[\\/]/).pop(),
        function: frame.function?.replace(/[^a-zA-Z0-9_.$<> ]/g, "").slice(0, 120),
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      })) },
    })) },
  };
}

export const glitchtipOptions = {
  dsn: glitchtipDsn,
  enabled: process.env.NEXT_PUBLIC_GLITCHTIP_ENABLED !== "false",
  sendDefaultPii: false,
  autoSessionTracking: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  maxBreadcrumbs: 0,
  beforeSend: sanitizeGlitchtipEvent,
};
