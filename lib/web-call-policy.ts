export const webCallCookie = process.env.NODE_ENV === "production" ? "__Host-myparadise-calls" : "myparadise-calls";
export function webCallOriginAllowed(origin: string | null, requestOrigin: string, host?: string | null) {
  if (!origin) return false;
  // Next's internal URL can use the container hostname behind the production proxy.
  const publicHosts = ["my.staff-paradise.tech", "www.staff-paradise.tech", "staff-paradise.tech"];
  const expected = host && publicHosts.includes(host) ? `https://${host}` : requestOrigin;
  return origin === expected;
}
export function webCallActionAllowed(operation: string, action: unknown) {
  return operation === "chat" ? ["send", "read", "mute"].includes(String(action)) : operation === "calls" ? ["start", "accept", "join", "decline", "end"].includes(String(action)) : operation === "directory" && action === "create";
}
