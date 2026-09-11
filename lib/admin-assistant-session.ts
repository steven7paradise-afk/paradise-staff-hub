export const ADMIN_ASSISTANT_SESSION_TTL_MS = 40 * 60 * 1_000;

export function isClearAssistantCommand(value: string) {
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("it").replace(/[.!?]+$/g, "").trim();
  return normalized === "clear"
    || normalized === "reset"
    || /^(pulisci|pulisce|cancella|svuota|azzera)\s+(la\s+)?(chat|conversazione)$/.test(normalized)
    || /^(riparti|ricomincia)\s+da\s+zero$/.test(normalized);
}

export function readAssistantSession(rawValue: string | null, now = Date.now()): unknown[] | null {
  if (!rawValue) return null;
  try {
    const value = JSON.parse(rawValue) as { expiresAt?: unknown; messages?: unknown };
    if (typeof value.expiresAt !== "number" || value.expiresAt <= now || !Array.isArray(value.messages)) return null;
    return value.messages;
  } catch {
    return null;
  }
}

export function writeAssistantSession(messages: unknown[], now = Date.now()) {
  return JSON.stringify({ expiresAt: now + ADMIN_ASSISTANT_SESSION_TTL_MS, messages });
}
