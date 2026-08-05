import { NextRequest, NextResponse } from "next/server";
import { getShopifyOrderDetails, isFuzzyNameMatch } from "@/lib/shopify";
import { getOperationalUser } from "@/lib/operational-session";

export async function GET(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "";
  const mode = searchParams.get("mode")?.trim() || "";

  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      return NextResponse.json({ error: "Shopify non configurato correttamente." }, { status: 500 });
    }

    // Mode 'today': return list of recent orders for quick selection
    if (mode === "today") {
      const res = await fetch(`https://${shop}/admin/api/2024-04/orders.json?limit=50&status=any&fields=id,name,customer,total_price,line_items,note,created_at`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Errore nel caricamento degli ordini recenti." }, { status: res.status });
      }

      const data = await res.json();
      const ordersList = (data?.orders || []).map((order: any) => {
        const firstName = String(order.customer?.first_name || "").trim();
        const lastName = String(order.customer?.last_name || "").trim();
        const clientName = [firstName, lastName].filter(Boolean).join(" ") || "Cliente Shopify";
        const lineSummary = Array.isArray(order.line_items) ? order.line_items.map((i: any) => i.title).join(", ") : "";

        return {
          id: String(order.id),
          orderName: order.name,
          clientName,
          totalPrice: order.total_price ? parseFloat(order.total_price) : 0,
          email: order.customer?.email || "",
          phone: order.customer?.phone || "",
          serviceTitle: lineSummary,
          note: order.note || "",
          createdAt: order.created_at,
        };
      });

      return NextResponse.json({ orders: ordersList });
    }

    // A. If query is empty: fetch the absolute most recent order
    if (!query) {
      const res = await fetch(`https://${shop}/admin/api/2024-04/orders.json?limit=1&status=any&fields=name`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Errore nel caricamento dell'ultimo ordine Shopify." }, { status: res.status });
      }

      const data = await res.json();
      const latestOrder = data?.orders?.[0];
      if (!latestOrder) {
        return NextResponse.json({ error: "Nessun ordine trovato su Shopify." }, { status: 404 });
      }

      const details = await getShopifyOrderDetails(latestOrder.name);
      if (!details) {
        return NextResponse.json({ error: `Impossibile caricare i dettagli per l'ordine ${latestOrder.name}.` }, { status: 404 });
      }

      return NextResponse.json({
        orderName: latestOrder.name,
        ...details,
      });
    }

    // B. If query is a specific order number (e.g. starts with # or is just numeric)
    const isOrderNumber = query.startsWith("#") || /^\d+$/.test(query);

    if (isOrderNumber) {
      const details = await getShopifyOrderDetails(query);
      if (!details) {
        return NextResponse.json({ error: `Ordine ${query} non trovato su Shopify.` }, { status: 404 });
      }
      return NextResponse.json({
        orderName: query.startsWith("#") ? query : `#${query}`,
        ...details,
      });
    }

    // C. If query is a text string (assumed to be a customer name): search the last 30 orders
    const res = await fetch(`https://${shop}/admin/api/2024-04/orders.json?limit=30&status=any&fields=id,name,customer,total_price,line_items,note`, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Errore durante la ricerca degli ordini recenti." }, { status: res.status });
    }

    const data = await res.json();
    const orders = data?.orders || [];

    // Find the latest order matching the customer name fuzzy match
    const matchingOrder = orders.find((order: any) => {
      const firstName = String(order.customer?.first_name || "").trim();
      const lastName = String(order.customer?.last_name || "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      return isFuzzyNameMatch(fullName, query);
    });

    if (!matchingOrder) {
      return NextResponse.json({ error: `Nessun ordine recente trovato per il cliente "${query}".` }, { status: 404 });
    }

    const firstName = String(matchingOrder.customer?.first_name || "").trim();
    const lastName = String(matchingOrder.customer?.last_name || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return NextResponse.json({
      orderName: matchingOrder.name,
      clientName: fullName || null,
      totalPrice: matchingOrder.total_price ? parseFloat(matchingOrder.total_price) : null,
      lineItems: Array.isArray(matchingOrder.line_items) 
        ? matchingOrder.line_items.map((item: any) => ({
            title: item.title,
            quantity: item.quantity ? parseInt(item.quantity) : 1,
            price: item.price ? parseFloat(item.price) : 0,
          })) 
        : [],
      note: matchingOrder.note || null,
      email: matchingOrder.customer?.email || null,
      phone: matchingOrder.customer?.phone || null,
    });

  } catch (error) {
    console.error("Shopify order lookup error:", error);
    return NextResponse.json({ error: "Errore interno durante il recupero dei dati da Shopify." }, { status: 500 });
  }
}
