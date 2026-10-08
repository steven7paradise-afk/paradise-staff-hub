import { createHmac } from "node:crypto";
import { ChatError } from "./chat-policy";

export function callsReady() {
  return process.env.CALLS_ENABLED === "true" && !!process.env.LIVEKIT_API_KEY && !!process.env.LIVEKIT_API_SECRET && !!process.env.LIVEKIT_URL;
}
export function callToken(identity: string, grants: Record<string, unknown>) {
  if (!callsReady()) throw new ChatError("Le chiamate sono in preparazione.", 503);
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: process.env.LIVEKIT_API_KEY, sub: identity, nbf: now - 5, exp: now + 60, video: grants })}`;
  return `${data}.${createHmac("sha256", process.env.LIVEKIT_API_SECRET!).update(data).digest("base64url")}`;
}
export async function roomOperation(operation: "CreateRoom" | "DeleteRoom", room: string) {
  const origin = new URL(process.env.LIVEKIT_URL!);
  if (origin.protocol !== "wss:" && origin.protocol !== "https:") throw new ChatError("Configurazione chiamate non valida.", 503);
  origin.protocol = "https:";
  const token = callToken("myparadise-server", { roomCreate: true });
  const response = await fetch(new URL(`/twirp/livekit.RoomService/${operation}`, origin), {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(operation === "CreateRoom" ? { name: room, empty_timeout: 60, departure_timeout: 20, max_participants: 2 } : { room }),
    signal: AbortSignal.timeout(7000), cache: "no-store",
  });
  if (!response.ok && !(operation === "DeleteRoom" && response.status === 404)) throw new ChatError("Il servizio audio non risponde. Riprova.", 503);
}
