import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYMENT_EVENTS_CHANNEL = "paradise_payment_changes";
export const PAYMENT_REVISION_KEY = "shopify_payments_revision";

export function verifyShopifyPaymentSignature(raw: Buffer, signature: string, secret: string) {
  if (!secret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
