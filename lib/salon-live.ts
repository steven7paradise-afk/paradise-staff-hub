import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { APPOINTMENT_EVENTS_CHANNEL, APPOINTMENT_REVISION_KEY } from "./cowlendar-webhook";
import { appointmentSalonSlugFromName } from "./appointment-salon-url";
export class SalonLiveError extends Error {}
export async function bookingDeskLocation(serviceTitle: string, fallbackLocationId: string) {
  const slug = appointmentSalonSlugFromName(serviceTitle);
  if (!slug) return fallbackLocationId;
  const locations = await prisma.location.findMany({ where: { active: true }, select: { id: true, name: true } });
  const matches = locations.filter(l => appointmentSalonSlugFromName(l.name) === slug);
  if (matches.length !== 1) throw new SalonLiveError("Sede dell’appuntamento non univoca: chiedi alla cassa di verificarla.");
  return matches[0].id;
}
export const liveKey = (location: string, id: string) => `salon_live:${location}:${id}`;
export async function liveChanged(tx: Prisma.TransactionClient) {
  const revision = randomUUID();
  await tx.setting.upsert({ where: { key: APPOINTMENT_REVISION_KEY }, create: { key: APPOINTMENT_REVISION_KEY, value: revision }, update: { value: revision } });
  await tx.$queryRaw`SELECT pg_notify(${APPOINTMENT_EVENTS_CHANNEL}, ${revision})::text`;
}
// Also refresh clients on attendance changes without sending personal data through NOTIFY.
export async function publishLiveChange() { await prisma.$transaction(liveChanged); }

export async function productByBarcode(barcode: string) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) throw new SalonLiveError("Catalogo Shopify non configurato.");
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    cache: "no-store", signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ query: `query($query:String!) { shop { currencyCode } productVariants(first:20,query:$query) { nodes { id title barcode price product { title status } } } }`, variables: { query: `barcode:"${barcode}"` } }),
  });
  if (!response.ok) throw new SalonLiveError("Catalogo Shopify non disponibile. Riprova.");
  const json = await response.json();
  if (json.errors || !json.data) throw new SalonLiveError("Impossibile leggere il catalogo Shopify. Verificare i permessi prodotti.");
  type Variant = { id: string; title: string; barcode: string; price: string; product: { title: string; status: string } };
  const matches = (json.data.productVariants.nodes as Variant[]).filter(v => v.barcode === barcode && v.product.status === "ACTIVE");
  if (matches.length !== 1) throw new SalonLiveError(matches.length ? "Codice presente su più prodotti: verifica con la cassa." : "Prodotto non trovato: verifica il codice a barre.");
  const v = matches[0];
  return { variantId: v.id, title: [v.product.title, v.title === "Default Title" ? "" : v.title].filter(Boolean).join(" · "), barcode, price: v.price, currency: String(json.data.shop.currencyCode) };
}
