import { authorizeMagazzino, magazzinoResponse } from "@/lib/magazzino/access";
import { consumeMagazzinoRate } from "@/lib/magazzino/rate-limit";
import { listMagazzinoWorkers } from "@/lib/magazzino/workers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = authorizeMagazzino(request);
  if (access instanceof Response) return access;
  try {
    const rate = await consumeMagazzinoRate("roster", access.ip);
    if (!rate.allowed) return magazzinoResponse({ ok: false }, 429, { "Retry-After": String(rate.retryAfter) });
    return magazzinoResponse(await listMagazzinoWorkers());
  } catch {
    return magazzinoResponse({ ok: false }, 503);
  }
}
