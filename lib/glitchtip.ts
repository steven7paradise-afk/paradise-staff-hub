import type { ErrorEvent } from "@sentry/nextjs";

// Public ingestion address, not an administrative credential.
export const glitchtipDsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN || "https://3128068f9eec4855a9bd4ecab829ff65@app.glitchtip.com/27909";

const technicalMessages = new Set(["Failed to fetch", "NetworkError", "Load failed", "Script error.", "ResizeObserver loop limit exceeded"]);
const errorTypes = new Set(["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError", "AggregateError"]);
const buildVersion = process.env.NEXT_PUBLIC_APP_BUILD_VERSION || "unknown";

function reactErrorCode(event: ErrorEvent) {
  for (const exception of event.exception?.values ?? []) {
    const match = String(exception.value || "").match(/(?:react error\s*#|\/errors\/)(\d+)/i);
    if (match) return match[1];
  }
  return null;
}

/** Keep the route useful for diagnostics without retaining query strings or record identifiers. */
export function safeGlitchtipRoute(value: string | null | undefined) {
  if (!value) return null;
  try {
    const pathname = new URL(value, "https://staff-paradise.invalid").pathname;
    return pathname
      .replace(/\/(?:[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}|[a-zA-Z0-9_-]{20,})(?=\/|$)/g, "/[id]")
      .replace(/\/(ordine|o|promos)\/[^/]+/g, "/$1/[id]")
      .replace(/\/service-forms\/responses\/[^/]+/g, "/service-forms/responses/[id]")
      .replace(/\/settings\/forms\/edit\/[^/]+/g, "/settings/forms/edit/[id]")
      .replace(/\/shipping\/stampa\/[^/]+/g, "/shipping/stampa/[id]");
  } catch {
    return null;
  }
}

function currentSafeRoute(event: ErrorEvent) {
  if (typeof window !== "undefined") return safeGlitchtipRoute(window.location.pathname);
  return safeGlitchtipRoute(event.request?.url);
}

/** Allowlist only technical diagnostics: never send requests, identities or free text. */
export function sanitizeGlitchtipEvent(event: ErrorEvent): ErrorEvent {
  const code = reactErrorCode(event);
  const route = currentSafeRoute(event);
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: process.env.NODE_ENV,
    release: buildVersion !== "unknown" ? buildVersion : undefined,
    tags: {
      ...(route ? { app_route: route } : {}),
      ...(code ? { react_error: code } : {}),
      ...(buildVersion !== "unknown" ? { app_build: buildVersion } : {}),
    },
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

/**
 * React 519 is an internal hydration sentinel, not an actionable application
 * failure. Hydration 418 remains visible once per route/build/browser session
 * so a single affected device cannot exhaust the free GlitchTip quota.
 */
export function prepareGlitchtipEvent(event: ErrorEvent): ErrorEvent | null {
  const code = reactErrorCode(event);
  if (code === "519") return null;

  if (code === "418" && typeof window !== "undefined") {
    const route = currentSafeRoute(event) || "unknown";
    const key = `glitchtip:hydration:${buildVersion}:${route}`;
    try {
      if (window.sessionStorage.getItem(key)) return null;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }

  return sanitizeGlitchtipEvent(event);
}

export const glitchtipOptions = {
  dsn: glitchtipDsn,
  release: buildVersion !== "unknown" ? buildVersion : undefined,
  enabled: process.env.NEXT_PUBLIC_GLITCHTIP_ENABLED !== "false",
  sendDefaultPii: false,
  autoSessionTracking: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  maxBreadcrumbs: 0,
  beforeSend: prepareGlitchtipEvent,
};
