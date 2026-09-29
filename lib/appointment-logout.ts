export async function endAppointmentWorkerSession(request: typeof fetch = fetch): Promise<string | null> {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("appointments:session-ending"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await request("/api/appointments/pc/logout", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("Logout non riuscito. Riprova.");
    const data = await response.json();
    const destination = data?.redirectTo;
    return typeof destination === "string" && /^\/appointments\/(buenos-aires|duomo|ufficio)\?choose=1$/.test(destination) ? destination : null;
  } catch {
    throw new Error("Impossibile completare l'uscita. Controlla la connessione e riprova.");
  } finally { clearTimeout(timeout); }
}
