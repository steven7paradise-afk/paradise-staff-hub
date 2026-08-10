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

    // Mode 'client_orders' or 'today': return list of orders for this specific client or created TODAY
    if (mode === "today" || mode === "client_orders") {
      const clientNameParam = searchParams.get("clientName")?.trim() || "";
      const emailParam = searchParams.get("email")?.trim() || "";
      const phoneParam = searchParams.get("phone")?.trim() || "";

      const fetchHeaders = {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      };

      const fetchAllPages = async (initialUrl: string) => {
        const orders: any[] = [];
        let nextUrl: string | null = initialUrl;
        let page = 0;

        try {
          while (nextUrl && page < 4) {
            const res = await fetch(nextUrl, {
              headers: fetchHeaders,
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) break;

            const data = await res.json();
            if (Array.isArray(data?.orders)) orders.push(...data.orders);

            const nextMatch = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/i);
            nextUrl = nextMatch?.[1] || null;
            page += 1;
          }
        } catch {
          // Return any pages already loaded if Shopify times out.
        }

        return orders;
      };

      const fetchPromises: Promise<any[]>[] = [];

      if (emailParam) {
        fetchPromises.push(
          fetchAllPages(
            `https://${shop}/admin/api/2024-04/orders.json?status=any&limit=250&email=${encodeURIComponent(emailParam)}&fields=id,name,customer,email,phone,shipping_address,billing_address,total_price,line_items,note,created_at`
          )
        );
      }

      if (phoneParam) {
        fetchPromises.push(
          fetchAllPages(
            `https://${shop}/admin/api/2024-04/orders.json?status=any&limit=250&phone=${encodeURIComponent(phoneParam)}&fields=id,name,customer,email,phone,shipping_address,billing_address,total_price,line_items,note,created_at`
          )
        );
      }

      // The broad feed covers name-only matches when email/phone are unavailable.
      fetchPromises.push(
        fetchAllPages(
          `https://${shop}/admin/api/2024-04/orders.json?status=any&limit=250&fields=id,name,customer,email,phone,shipping_address,billing_address,total_price,line_items,note,created_at`
        )
      );

      const results = await Promise.all(fetchPromises);
      const rawOrders = results.flat();

      // Deduplicate rawOrders by order.id
      const uniqueOrderMap = new Map<string, any>();
      for (const ord of rawOrders) {
        if (ord && ord.id && !uniqueOrderMap.has(String(ord.id))) {
          uniqueOrderMap.set(String(ord.id), ord);
        }
      }
      const allFetchedOrders = Array.from(uniqueOrderMap.values());

      const cleanPhone = (p?: string | null) => (p || "").replace(/\D/g, "");
      const targetPhone = cleanPhone(phoneParam);
      const targetEmail = emailParam.toLowerCase();
      const targetName = clientNameParam
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const nameParts = targetName.split(/\s+/).filter((p) => p.length > 1);

      // Filter ONLY for this client's orders across all dates
      let filteredOrders = allFetchedOrders.filter((order: any) => {
        const oEmail = (order.customer?.email || "").trim().toLowerCase();
        const oPhone = cleanPhone(order.customer?.phone || order.phone);
        const firstName = (order.customer?.first_name || "").trim().toLowerCase();
        const lastName = (order.customer?.last_name || "").trim().toLowerCase();
        const oFullName = `${firstName} ${lastName}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

        // 1. Match Phone
        if (targetPhone && oPhone && (targetPhone === oPhone || targetPhone.endsWith(oPhone) || oPhone.endsWith(targetPhone))) {
          return true;
        }
        // 2. Match Email
        if (targetEmail && oEmail && targetEmail === oEmail) {
          return true;
        }
        // 3. Match Full Name (exact match or first + last name match)
        if (targetName && oFullName) {
          if (targetName === oFullName) return true;
          if (nameParts.length >= 2 && oFullName.includes(nameParts[0]) && oFullName.includes(nameParts[nameParts.length - 1])) {
            return true;
          }
        }
        return false;
      });

      // Sort by creation date DESC (newest first)
      filteredOrders.sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      // The generic "today" mode may fall back to today's feed. Client mode must
      // never expose orders belonging to another customer.
      if (mode === "today" && filteredOrders.length === 0) {
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
        filteredOrders = allFetchedOrders.filter((order: any) => {
          if (!order.created_at) return false;
          const orderDay = new Date(order.created_at).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
          return orderDay === todayStr;
        });

        // Fallback to 10 most recent orders if none today
        if (filteredOrders.length === 0) {
          filteredOrders = allFetchedOrders.slice(0, 10);
        }
      }

      const ordersList = filteredOrders.map((order: any) => {
        const firstName = String(order.customer?.first_name || "").trim();
        const lastName = String(order.customer?.last_name || "").trim();
        const clientName = [firstName, lastName].filter(Boolean).join(" ") || "Cliente Shopify";
        const lineSummary = Array.isArray(order.line_items) ? order.line_items.map((i: any) => i.title).join(", ") : "";
        const address = order.shipping_address || order.billing_address || order.customer?.default_address || null;
        const addressLine = address
          ? [address.address1, address.address2].filter(Boolean).join(", ")
          : "";

        return {
          id: String(order.id),
          orderName: order.name,
          clientName,
          firstName,
          lastName,
          totalPrice: order.total_price ? parseFloat(order.total_price) : 0,
          email: order.customer?.email || order.email || "",
          phone: order.customer?.phone || order.phone || address?.phone || "",
          addressLine,
          city: address?.city || "",
          postalCode: address?.zip || "",
          province: address?.province || "",
          country: address?.country || "",
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
      id: String(matchingOrder.id),
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
