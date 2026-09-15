import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { ShippingPrintButton } from "@/components/shipping-print-button";
import { getCachedLabeledOrder } from "@/lib/shipping-label-orders";

export const dynamic = "force-dynamic";

export default async function ShippingPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, active: true },
  });
  if (!user?.active || !(await canAccessForUser(prisma, "/shipping", user))) redirect("/dashboard");

  const { orderId } = await params;
  const { tipo } = await searchParams;
  if (!/^\d+$/.test(orderId) || (tipo !== "comanda" && tipo !== "grazie")) notFound();
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) notFound();

  let order = getCachedLabeledOrder(orderId);
  if (!order) {
    let response = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}.json`, {
      headers: { "X-Shopify-Access-Token": token },
      cache: "no-store",
    });
    if (response.status === 429) {
      const retrySeconds = Math.min(Number(response.headers.get("retry-after") || 2), 3);
      await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
      response = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}.json`, {
        headers: { "X-Shopify-Access-Token": token },
        cache: "no-store",
      });
    }
    if (response.ok) order = (await response.json()).order;
  }
  if (!order) notFound();

  const firstName = String(order.customer?.first_name || order.shipping_address?.first_name || "").trim();
  const customerName = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") ||
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || "Cliente";
  const address = order.shipping_address || {};
  const items = (order.line_items || []).filter((item: any) => item.requires_shipping !== false);
  const variantIds = items.map((item: any) => item.variant_id ? String(item.variant_id) : "").filter(Boolean);
  const products = variantIds.length ? await prisma.inventoryProduct.findMany({
    where: { OR: [{ shopify_variant_id: { in: variantIds } }, { sku: { in: variantIds.map((id: string) => `SHOP-${id}`) } }] },
    select: { shopify_variant_id: true, sku: true, barcode: true, image_url: true },
  }).catch(() => []) : [];
  const productByVariant = new Map(products.map((product) => [product.shopify_variant_id || product.sku.replace(/^SHOP-/, ""), product]));

  return (
    <main className="min-h-screen bg-[#F4F4F2] px-4 py-8 text-[#181818] print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[760px] items-center justify-between gap-3 print:hidden">
        <a href="/shipping" className="text-sm font-medium underline">← Torna alle spedizioni</a>
        <ShippingPrintButton />
      </div>
      <article className="mx-auto min-h-[900px] max-w-[760px] bg-white px-8 py-11 shadow-sm sm:px-14 print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b border-[#181818] pb-8">
          <img src="/logo.png" alt="Paradise Beauty" className="mx-auto h-auto w-[210px] object-contain" />
        </header>

        {tipo === "comanda" ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DDD] py-9">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#777]">Preparazione ordine</p>
                <h1 className="mt-2 text-3xl font-light uppercase tracking-[0.04em]">Comanda</h1>
              </div>
              <p className="text-lg font-medium">{order.name}</p>
            </div>
            <section className="grid gap-7 border-b border-[#DDD] py-8 sm:grid-cols-2">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em]">Cliente</h2>
                <p className="mt-3 text-sm">{customerName}</p>
                <p className="mt-1 text-sm">{address.address1}</p>
                {address.address2 && <p className="text-sm">{address.address2}</p>}
                <p className="text-sm">{address.zip} {address.city} {address.province}</p>
                <p className="text-sm">{address.country}</p>
              </div>
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em]">Spedizione</h2>
                <p className="mt-3 text-sm">{order.shipping_lines?.[0]?.title || "Spedizione"}</p>
                {order.fulfillments?.[0]?.tracking_number && <p className="mt-1 text-sm">Tracking {order.fulfillments[0].tracking_number}</p>}
              </div>
            </section>
            <section className="py-8">
              <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em]">Articoli nel pacco</h2>
              <div className="divide-y divide-[#DDD] border-y border-[#181818]">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-5 py-4 text-sm">
                    <div className="flex items-center gap-4">
                      {productByVariant.get(String(item.variant_id))?.image_url ? (
                        <img
                          src={productByVariant.get(String(item.variant_id))!.image_url!}
                          alt={item.title}
                          className="size-20 shrink-0 border border-[#DDD] bg-white object-contain"
                        />
                      ) : (
                        <span className="flex size-20 shrink-0 items-center justify-center border border-[#DDD] text-center text-[10px] text-[#888]">Foto non disponibile</span>
                      )}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-[#777]">{item.variant_title || item.sku || ""}</p>
                        {productByVariant.get(String(item.variant_id))?.barcode && <p className="mt-1 font-mono text-xs">{productByVariant.get(String(item.variant_id))!.barcode}</p>}
                      </div>
                    </div>
                    <span className="shrink-0 font-medium">× {item.quantity}</span>
                  </div>
                ))}
              </div>
            </section>
            <footer className="mt-12 grid gap-7 border-t border-[#DDD] pt-6 text-xs sm:grid-cols-2">
              <p>□ Articoli verificati<br />□ Pacco fotografato<br />□ Etichetta applicata</p>
              <p>Preparato da ____________________<br />Data ____________________</p>
            </footer>
          </>
        ) : (
          <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#777]">Un pensiero per te</p>
            <h1 className="mt-8 max-w-lg font-serif text-5xl leading-[1.06] font-normal sm:text-6xl">Grazie{firstName ? `, ${firstName}` : ""}.</h1>
            <p className="mt-10 max-w-sm text-base leading-7 text-[#555]">
              Grazie per aver scelto Paradise Beauty. Abbiamo preparato il tuo ordine con cura, pensando a ogni dettaglio.
            </p>
            <p className="mt-12 font-serif text-2xl italic">Con affetto, Paradise</p>
            <p className="mt-16 text-[11px] uppercase tracking-[0.2em] text-[#777]">{order.name}</p>
          </div>
        )}
      </article>
    </main>
  );
}
