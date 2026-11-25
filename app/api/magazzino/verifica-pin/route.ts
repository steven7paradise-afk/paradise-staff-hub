import { authorizeMagazzino, magazzinoResponse, readMagazzinoPinBody } from "@/lib/magazzino/access";
import { consumeMagazzinoRate } from "@/lib/magazzino/rate-limit";
import { verifyMagazzinoPin } from "@/lib/magazzino/workers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = authorizeMagazzino(request);
  if (access instanceof Response) return access;
  try {
    const rate = await consumeMagazzinoRate("pin", access.ip);
    if (!rate.allowed) return magazzinoResponse({ ok: false }, 429, { "Retry-After": String(rate.retryAfter) });
    let pin: unknown;
    try { pin = await readMagazzinoPinBody(request); }
    catch { return magazzinoResponse({ ok: false }, 400); }
    return magazzinoResponse(await verifyMagazzinoPin(pin));
  } catch {
    // Do not log request bodies, credentials, raw database errors or worker records.
    return magazzinoResponse({ ok: false }, 503);
  }
}
