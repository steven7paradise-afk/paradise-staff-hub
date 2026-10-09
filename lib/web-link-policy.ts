import { createHash, timingSafeEqual } from "crypto";
export type WebLink = { proof: string; browser: string; expires: number; userId?: string; sessionId?: string };
export const webLinkHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function webLinkAllowed(link: WebLink | undefined, secret: string, kind: "proof" | "browser", now = Date.now()) {
  if (!link || link.expires <= now || !/^[a-f0-9]{64}$/.test(link[kind])) return false;
  return timingSafeEqual(Buffer.from(webLinkHash(secret), "hex"), Buffer.from(link[kind], "hex"));
}
