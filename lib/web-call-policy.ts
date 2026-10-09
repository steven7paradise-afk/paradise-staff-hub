export const webCallCookie = process.env.NODE_ENV === "production" ? "__Host-myparadise-calls" : "myparadise-calls";
export function webCallOriginAllowed(origin: string | null, requestOrigin: string) {
  if (!origin) return false;
  return origin === requestOrigin;
}
export function webCallActionAllowed(operation: string, action: unknown) {
  return operation === "calls" ? ["start", "accept", "join", "decline", "end"].includes(String(action)) : operation === "directory" && action === "create";
}
