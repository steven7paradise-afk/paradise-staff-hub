export const connectionMessage = "Connessione temporaneamente non disponibile. Attendi qualche secondo e riprova.";
export class WebApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
  get temporary() { return this.status === 0 || this.status >= 500; }
}
export async function readWebResponse(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new WebApiError(response.status === 401 ? "Sessione scaduta. Accedi di nuovo." : connectionMessage, response.ok ? 502 : response.status); }
  if (!response.ok) throw new WebApiError(response.status >= 500 ? connectionMessage : typeof data?.error === "string" ? data.error : "Operazione non disponibile. Riprova.", response.status);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new WebApiError(connectionMessage, 502);
  return data;
}
export async function webRequest(url: string, body?: object) {
  // Retry only reads: a failed mutation may already have reached the server.
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
      return await readWebResponse(response);
    } catch (e) {
      const error = e instanceof WebApiError ? e : new WebApiError(connectionMessage, 0);
      if (body || !error.temporary || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
}
