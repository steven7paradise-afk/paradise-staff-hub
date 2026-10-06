import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isOrderBlockState, ORDER_BLOCK_STATES, verifyOrderBlockToken } from "@/lib/shopify-order-block";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store" };
class OrderBlockError extends Error {}
const errorMessage = (error: unknown) => error instanceof OrderBlockError ? error.message : "Servizio non disponibile. Aggiorna e riprova.";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
function actor(request: Request) {
  return verifyOrderBlockToken(request.headers.get("authorization")?.replace(/^Bearer /, "") || "", {
    secret: process.env.SHOPIFY_API_SECRET || "", clientId: process.env.SHOPIFY_API_KEY || "",
    shop: process.env.SHOPIFY_SHOP_DOMAIN || "", users: (process.env.SHOPIFY_ORDER_BLOCK_USER_IDS || "").split(",").map(s => s.trim()),
  });
}
async function graphql(query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2026-04/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN || "" },
    body: JSON.stringify({ query, variables }), cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) throw new OrderBlockError("Shopify non disponibile. Riprova.");
  return payload.data;
}
async function findOrder(id: string) {
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(id)) throw new OrderBlockError("Ordine non valido");
  const data = await graphql("query($id: ID!) { order(id: $id) { name } }", { id });
  if (!data.order) throw new OrderBlockError("Ordine Shopify non trovato");
  const number = data.order.name.replace(/^#/, "");
  // Exact matches only: never associate a phone number or a number in free-form notes.
  const candidates = await prisma.serviceFormResponse.findMany({
    where: { form: { name: "Modulo Ordine" }, OR: ["order_shopify_order", "field_1782221517924", "order_title"].flatMap(key =>
      [number, `#${number}`].map(value => ({ answers: { path: [key], equals: value } }))) }, take: 2,
    select: { id: true, status: true, updated_at: true, activity_log: true },
  });
  if (candidates.length !== 1) throw new OrderBlockError(candidates.length ? "Più moduli collegati: gestisci l’ordine da Staff Hub." : "Nessun Modulo Ordine collegato. Crealo prima in Staff Hub.");
  return { ...candidates[0], name: data.order.name };
}
export async function GET(request: Request) {
  try { actor(request); } catch { return json({ error: "Accesso non autorizzato al blocco ordini." }, 401); }
  try {
    const order = await findOrder(new URL(request.url).searchParams.get("orderId") || "");
    const log = Array.isArray(order.activity_log) ? order.activity_log : [];
    return json({ id: order.id, name: order.name, status: order.status, version: order.updated_at.toISOString(), lastUpdate: log.at(-1) || null });
  } catch (error) { return json({ error: errorMessage(error) }, 400); }
}
export async function POST(request: Request) {
  let userId: string;
  try { userId = actor(request); } catch { return json({ error: "Accesso non autorizzato al blocco ordini." }, 401); }
  try {
    const raw = await request.text();
    if (raw.length > 8000) return json({ error: "Richiesta troppo grande" }, 413);
    const body = JSON.parse(raw);
    if (!isOrderBlockState(body.status) || typeof body.note !== "string" || body.note.length > 2000 || typeof body.version !== "string") return json({ error: "Stato o nota non validi" }, 400);
    const order = await findOrder(body.orderId);
    if (!isOrderBlockState(order.status)) return json({ error: "Questo modulo non è modificabile dal blocco." }, 409);
    if (order.updated_at.toISOString() !== body.version) return json({ error: "L’ordine è stato modificato. Premi Aggiorna prima di salvare." }, 409);
    const by = `Shopify · utente ${userId}`;
    const stamp = new Date().toISOString();
    const status = body.status as keyof typeof ORDER_BLOCK_STATES;
    await prisma.$transaction(async tx => {
      const log = Array.isArray(order.activity_log) ? order.activity_log : [];
      const changed = await tx.serviceFormResponse.updateMany({ where: { id: order.id, updated_at: order.updated_at }, data: {
        status, activity_log: [...log, { type: "STATUS_CHANGE", from: order.status, to: status, note: body.note.trim(), by, byId: `shopify:${userId}`, at: stamp }],
      } });
      if (!changed.count) throw new OrderBlockError("L’ordine è stato modificato. Premi Aggiorna.");
      const fields = [
        { key: "stato_ordine", value: ORDER_BLOCK_STATES[status], type: "single_line_text_field" },
        { key: "paradise_ultimo_aggiornamento", value: JSON.stringify({ by, at: stamp, note: body.note.trim() }), type: "json" },
      ].map(field => ({ ...field, namespace: "custom", ownerId: body.orderId }));
      const result = await graphql("mutation($fields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $fields) { userErrors { message } } }", { fields });
      if (result.metafieldsSet.userErrors.length) throw new OrderBlockError("Shopify non ha accettato lo stato. Controlla la definizione del campo Stato Ordine.");
    }, { timeout: 15000, maxWait: 3000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return json({ ok: true });
  } catch (error) { return json({ error: errorMessage(error) }, 400); }
}
