import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export function magazzinoResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache", "X-Content-Type-Options": "nosniff", ...extraHeaders },
  });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function normalizedIp(value: string) {
  const ip = value.trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");
  if (ip.includes("%") || !isIP(ip)) return null;
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
}

/** Only enable behind the verified ingress: it must overwrite proto and append its peer to XFF. */
export function authorizeMagazzino(request: Request): { ip: string } | Response {
  const trustProxy = process.env.MAGAZZINO_TRUST_PROXY === "true";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = trustProxy ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
  if (!secure) return magazzinoResponse({ ok: false }, 403);

  const key = process.env.MAGAZZINO_API_KEY ?? "";
  const supplied = /^Bearer ([A-Za-z0-9_-]{43,256})$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const matches = timingSafeEqual(digest(supplied), digest(key));
  if (key.length < 43) return magazzinoResponse({ ok: false }, 503);
  if (!matches) return magazzinoResponse({ ok: false }, 401, { "WWW-Authenticate": "Bearer" });

  // Next does not expose a TCP peer. Never invent an IP from an untrusted header.
  if (!trustProxy) return magazzinoResponse({ ok: false }, 503);
  const chain = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  const ip = normalizedIp(chain.at(-1) ?? "");
  if (!ip) return magazzinoResponse({ ok: false }, 503);

  const configured = process.env.MAGAZZINO_ALLOWED_IPS?.trim();
  if (configured) {
    const allowed = configured.split(",").map(normalizedIp);
    if (allowed.some(value => value === null)) return magazzinoResponse({ ok: false }, 503);
    if (!allowed.includes(ip)) return magazzinoResponse({ ok: false }, 403);
  }
  // Query parameters are never an alternative channel for credentials.
  if (new URL(request.url).search) return magazzinoResponse({ ok: false }, 400);
  return { ip };
}

/** Bounded even for chunked/slow requests; never include input in an error. */
export async function readMagazzinoPinBody(request: Request, timeoutMs = 5_000): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new Error("invalid_body");
  const maximum = 256;
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new Error("invalid_body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_body");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error("invalid_body")); }, timeoutMs);
  });
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maximum) { void reader.cancel().catch(() => {}); throw new Error("invalid_body"); }
        chunks.push(value);
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("pin" in body)) throw new Error("invalid_body");
      return (body as { pin: unknown }).pin;
    } finally {
      reader.releaseLock();
    }
  };
  try { return await Promise.race([read(), timeout]); }
  finally { clearTimeout(timer); }
}
