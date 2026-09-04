import { prisma } from "@/lib/prisma";

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 800): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Retrieves a single Shopify order name (e.g., #22727) given its 13-digit Shopify order ID,
 * caching the result in the database.
 */
export async function getShopifyOrderName(orderId: string | number | null | undefined): Promise<string | null> {
  if (!orderId) return null;
  const idStr = String(orderId).trim();
  if (!idStr || !/^\d+$/.test(idStr)) return null;

  try {
    // 1. Check cache first
    const cached = await prisma.shopifyOrderCache.findUnique({
      where: { order_id: idStr },
    });
    if (cached) {
      return cached.order_name;
    }

    // 2. Fetch from Shopify
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify shop domain or access token not configured.");
      return null;
    }

    const response = await fetchWithTimeout(`https://${shop}/admin/api/2024-04/orders/${idStr}.json`, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    }, 1000);

    if (!response.ok) {
      console.error(`Failed to fetch Shopify order ${idStr}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const orderName = data?.order?.name || null;

    if (orderName) {
      // 3. Save to cache
      await prisma.shopifyOrderCache.upsert({
        where: { order_id: idStr },
        update: { order_name: orderName },
        create: { order_id: idStr, order_name: orderName },
      }).catch((cacheErr) => {
        console.error("Failed to cache Shopify order:", cacheErr);
      });
      return orderName;
    }
  } catch (error) {
    console.error(`Error in getShopifyOrderName for ID ${idStr}:`, error);
  }

  return null;
}

/**
 * Bulk resolves a list of Shopify order IDs into their names, utilizing the cache database
 * and querying Shopify concurrently (with a concurrency limit) for any missing ones.
 */
export async function getShopifyOrderNamesBulk(orderIds: (string | number | null | undefined)[]): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  const cleanIds = Array.from(
    new Set(
      orderIds
        .map((id) => String(id || "").trim())
        .filter((id) => id && /^\d+$/.test(id))
    )
  );

  if (cleanIds.length === 0) return resultMap;

  try {
    // 1. Load what we have from the database cache
    const cachedRecords = await prisma.shopifyOrderCache.findMany({
      where: { order_id: { in: cleanIds } },
    });

    for (const record of cachedRecords) {
      resultMap.set(record.order_id, record.order_name);
    }

    // 2. Identify missing IDs
    const missingIds = cleanIds.filter((id) => !resultMap.has(id));

    if (missingIds.length > 0) {
      // 3. Fetch missing IDs from Shopify in chunks of 50 to avoid API limits.
      // Limit to 100 missing IDs per page load (2 requests of 50) to keep it extremely fast.
      const idsToFetch = missingIds.slice(0, 100);

      const shop = process.env.SHOPIFY_SHOP_DOMAIN;
      const token = process.env.SHOPIFY_ACCESS_TOKEN;

      if (shop && token && idsToFetch.length > 0) {
        const chunkSize = 50;
        const chunks: string[][] = [];
        for (let i = 0; i < idsToFetch.length; i += chunkSize) {
          chunks.push(idsToFetch.slice(i, i + chunkSize));
        }

        console.log(`Resolving ${idsToFetch.length} missing Shopify order names in ${chunks.length} chunks...`);

        const fetchPromises = chunks.map(async (chunk) => {
          try {
            const url = `https://${shop}/admin/api/2024-04/orders.json?ids=${chunk.join(",")}&fields=id,name`;
            const res = await fetchWithTimeout(url, {
              headers: {
                "X-Shopify-Access-Token": token,
                "Content-Type": "application/json",
              },
            }, 1500);

            if (res.ok) {
              const data = await res.json();
              const orders = data?.orders || [];

              for (const order of orders) {
                const idStr = String(order.id);
                const orderName = order.name;
                if (orderName) {
                  resultMap.set(idStr, orderName);
                  // Cache it
                  await prisma.shopifyOrderCache.upsert({
                    where: { order_id: idStr },
                    update: { order_name: orderName },
                    create: { order_id: idStr, order_name: orderName },
                  }).catch((err) => console.error("Prisma bulk upsert failed:", err));
                }
              }
            } else {
              console.error(`Failed to fetch Shopify orders chunk: ${res.status} ${res.statusText}`);
            }
          } catch (e) {
            console.error(`Error resolving Shopify orders chunk:`, e);
          }
        });

        // Resolve concurrently
        await Promise.all(fetchPromises);
      }
    }
  } catch (error) {
    console.error("Error in getShopifyOrderNamesBulk:", error);
  }

  return resultMap;
}

/**
 * Resolves the real Shopify admin order ID from either the visible order name
 * (e.g. #24492) or a direct Shopify order ID.
 */
export async function getShopifyOrderIdentity(orderNameOrId: string): Promise<{
  id: string;
  name: string | null;
  adminUrl: string;
} | null> {
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify shop domain or access token not configured.");
      return null;
    }

    const cleanName = orderNameOrId.trim();
    if (!cleanName) return null;

    const headers = {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    };

    let orderData: any = null;
    const numeric = cleanName.replace("#", "");

    if (/^\d{12,}$/.test(numeric)) {
      const directRes = await fetchWithTimeout(`https://${shop}/admin/api/2024-04/orders/${numeric}.json?fields=id,name`, { headers }, 1500);
      if (directRes.ok) {
        const directData = await directRes.json();
        orderData = directData?.order;
      }
    }

    if (!orderData) {
      const searchName = cleanName.startsWith("#") || !/^\d+$/.test(cleanName) ? cleanName : `#${cleanName}`;
      const searchRes = await fetchWithTimeout(
        `https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(searchName)}&status=any&fields=id,name&limit=1`,
        { headers },
        1500
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        orderData = searchData?.orders?.[0] ?? null;
      }
    }

    if (!orderData) {
      const fallbackRes = await fetchWithTimeout(
        `https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(numeric)}&status=any&fields=id,name&limit=1`,
        { headers },
        1500
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        orderData = fallbackData?.orders?.[0] ?? null;
      }
    }

    if (!orderData?.id) return null;

    return {
      id: String(orderData.id),
      name: orderData.name ? String(orderData.name) : null,
      adminUrl: `https://admin.shopify.com/store/c1uzax-u0/orders/${orderData.id}`,
    };
  } catch (error) {
    console.error(`Error resolving Shopify order identity for ${orderNameOrId}:`, error);
    return null;
  }
}

/**
 * Helper to extract all valid Shopify order codes/IDs from string or array of strings
 */
export function extractShopifyOrderCodes(...inputs: (string | null | undefined)[]): string[] {
  const codes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    const str = String(input);
    const matches = str.match(/#?\d{4,}/g) || [];
    for (const m of matches) {
      const clean = m.trim();
      if (clean) codes.push(clean);
    }
  }
  return Array.from(new Set(codes));
}

/**
 * Appends a staff comment/note to a Shopify order's note field.
 * Prevents duplicating the exact same note text multiple times.
 */
export async function appendShopifyOrderNote(orderName: string, userName: string, message: string): Promise<boolean> {
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify shop domain or access token not configured.");
      return false;
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) return true;

    const cleanName = orderName.trim();
    if (!cleanName) return false;

    let orderId: string | number | null = null;
    let currentNote = "";

    // 1. If it looks like a direct 13-digit ID, try loading directly
    if (/^\d{12,}$/.test(cleanName.replace("#", ""))) {
      const directId = cleanName.replace("#", "");
      const res = await fetch(`https://${shop}/admin/api/2024-04/orders/${directId}.json`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          orderId = data.order.id;
          currentNote = data.order.note || "";
        }
      }
    }

    // 2. Otherwise search by order name
    if (!orderId) {
      let searchQuery = cleanName;
      if (!searchQuery.startsWith("#") && /^\d+$/.test(searchQuery)) {
        searchQuery = `#${searchQuery}`;
      }

      const searchRes = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(searchQuery)}&status=any`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (!searchRes.ok) {
        console.error(`Failed to search Shopify order by name ${searchQuery}: ${searchRes.status}`);
        return false;
      }

      const searchData = await searchRes.json();
      const orders = searchData?.orders || [];
      if (orders.length === 0) {
        // Try searching without the '#' prefix
        const nameWithoutHash = searchQuery.replace("#", "");
        const searchResNoHash = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(nameWithoutHash)}&status=any`, {
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
        });
        if (searchResNoHash.ok) {
          const searchDataNoHash = await searchResNoHash.json();
          const ordersNoHash = searchDataNoHash?.orders || [];
          if (ordersNoHash.length > 0) {
            const o = ordersNoHash[0];
            orderId = o.id;
            currentNote = o.note || "";
          }
        }
      } else {
        const o = orders[0];
        orderId = o.id;
        currentNote = o.note || "";
      }
    }

    if (!orderId) {
      console.warn(`No Shopify order found with name/ID ${cleanName}`);
      return false;
    }

    const cleanCurrent = currentNote.trim();

    // DEDUPLICATION FIX: Filter out lines that are ALREADY present in the existing note!
    const existingLines = new Set(
      cleanCurrent
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    );

    const inputLines = cleanMessage
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const uniqueLines = inputLines.filter((line) => !existingLines.has(line));

    if (uniqueLines.length === 0) {
      console.log(`[Shopify Note] All lines already present in order ${cleanName}, skipping duplicate append.`);
      return true;
    }

    const deduplicatedMessage = uniqueLines.join("\n");

    // 3. Format the new note block
    const newNoteBlock = `Staff: ${userName}\n${deduplicatedMessage}`;
    const updatedNote = cleanCurrent
      ? `${cleanCurrent}\n\n${newNoteBlock}`
      : newNoteBlock;

    // 4. Update the order note in Shopify
    const updateRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}.json`, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          note: updatedNote,
        },
      }),
    });

    if (!updateRes.ok) {
      console.error(`Failed to update Shopify order note for order ${cleanName} (${orderId}): ${updateRes.status}`);
      return false;
    }

    console.log(`Successfully appended note to Shopify order ${cleanName}`);
    return true;
  } catch (error) {
    console.error(`Error appending Shopify order note for ${orderName}:`, error);
    return false;
  }
}

/**
 * Fetches the current note field of a Shopify order directly.
 * Handles inputs representing either order name (e.g. #22910) or direct order ID.
 */
async function getShopifyOrderByNameOrId(orderName: string): Promise<any | null> {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shop || !token) {
    console.warn("Shopify shop domain or access token not configured.");
    return null;
  }

  const cleanName = orderName.trim();
  if (!cleanName) return null;

  if (/^\d{12,}$/.test(cleanName.replace("#", ""))) {
    const directId = cleanName.replace("#", "");
    const res = await fetch(`https://${shop}/admin/api/2024-04/orders/${directId}.json`, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data?.order || null;
    }
  }

  let searchQuery = cleanName;
  if (!searchQuery.startsWith("#") && /^\d+$/.test(searchQuery)) {
    searchQuery = `#${searchQuery}`;
  }

  const searchRes = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(searchQuery)}&status=any`, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const orders = searchData?.orders || [];
    if (orders.length > 0) return orders[0];

    const nameWithoutHash = searchQuery.replace("#", "");
    const searchResNoHash = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(nameWithoutHash)}&status=any`, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });
    if (searchResNoHash.ok) {
      const searchDataNoHash = await searchResNoHash.json();
      const ordersNoHash = searchDataNoHash?.orders || [];
      if (ordersNoHash.length > 0) return ordersNoHash[0];
    }
  }

  return null;
}

export async function getShopifyOrderNoteText(orderName: string): Promise<string | null> {
  try {
    const order = await getShopifyOrderByNameOrId(orderName);
    return order?.note || null;
  } catch (error) {
    console.error("Error in getShopifyOrderNoteText:", error);
  }
  return null;
}

export async function getShopifyOrderCowlendarText(orderName: string): Promise<string | null> {
  try {
    const order = await getShopifyOrderByNameOrId(orderName);
    if (!order) return null;

    const noteLines: string[] = [];
    const tags = String(order.tags || "").toLowerCase();
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    const noteLabelPattern = /(^|\s)(note|nota|memo|comment|commento|messaggio|message|richiesta|indicazione|istruzione|dettaglio|descrizione)(\s|$)/i;

    for (const item of lineItems) {
      const properties = Array.isArray(item.properties) ? item.properties : [];
      const visibleProperties = properties
        .map((property: any) => ({
          name: String(property?.name || "").trim(),
          value: property?.value,
        }))
        .filter((property: { name: string; value: unknown }) =>
          property.name &&
          !property.name.startsWith("__") &&
          property.value !== null &&
          property.value !== undefined &&
          String(property.value).trim() !== "",
        );

      if (!visibleProperties.length) continue;
      const looksLikeCowlendar =
        tags.includes("cowlendar") ||
        properties.some((property: any) => String(property?.name || "").startsWith("__cow_")) ||
        visibleProperties.some((property: { name: string }) => /data|telefono|staff|consenso|dichiaro|scelta|ripresa/i.test(property.name));
      if (!looksLikeCowlendar) continue;

      for (const property of visibleProperties) {
        const value = String(property.value).trim();
        if (noteLabelPattern.test(property.name)) {
          noteLines.push(`Nota prenotazione: ${value}`);
        }
      }
    }

    return [...new Set(noteLines)].join("\n") || null;
  } catch (error) {
    console.error("Error in getShopifyOrderCowlendarText:", error);
    return null;
  }
}

/**
 * Updates status and note metafields on a Shopify order.
 * Handles inputs representing either order name (e.g. #22910) or direct order ID.
 */
export async function updateShopifyOrderMetafields(
  orderName: string,
  status: string,
  note: string,
  collaborator?: string
): Promise<boolean> {
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify shop domain or access token not configured.");
      return false;
    }

    const cleanName = orderName.trim();
    if (!cleanName) return false;

    let orderId: string | number | null = null;

    // 1. Try direct ID query
    if (/^\d{12,}$/.test(cleanName.replace("#", ""))) {
      orderId = cleanName.replace("#", "");
    }

    // 2. Search by order name
    if (!orderId) {
      let searchQuery = cleanName;
      if (!searchQuery.startsWith("#") && /^\d+$/.test(searchQuery)) {
        searchQuery = `#${searchQuery}`;
      }

      const searchRes = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(searchQuery)}&status=any`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const orders = searchData?.orders || [];
        if (orders.length > 0) {
          orderId = orders[0].id;
        } else {
          // Try searching without the '#' prefix
          const nameWithoutHash = searchQuery.replace("#", "");
          const searchResNoHash = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(nameWithoutHash)}&status=any`, {
            headers: {
              "X-Shopify-Access-Token": token,
              "Content-Type": "application/json",
            },
          });
          if (searchResNoHash.ok) {
            const searchDataNoHash = await searchResNoHash.json();
            const ordersNoHash = searchDataNoHash?.orders || [];
            if (ordersNoHash.length > 0) {
              orderId = ordersNoHash[0].id;
            }
          }
        }
      }
    }

    if (!orderId) {
      console.warn(`No Shopify order found to update metafields for ${cleanName}`);
      return false;
    }

    // 3. Update the order metafields in Shopify using the POST metafields endpoint
    const headers = {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    };

    // Update Stato
    const statoRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}/metafields.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        metafield: {
          namespace: "custom",
          key: "stato_ordine",
          value: status,
          type: "single_line_text_field"
        }
      })
    });

    if (!statoRes.ok) {
      console.error(`Failed to update Shopify order stato_ordine for ${cleanName}: ${statoRes.status} ${await statoRes.text()}`);
    }

    // Update Note
    const noteRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}/metafields.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        metafield: {
          namespace: "custom",
          key: "note_ordine",
          value: note || "Nessuna nota",
          type: "multi_line_text_field"
        }
      })
    });

    if (!noteRes.ok) {
      console.error(`Failed to update Shopify order note_ordine for ${cleanName}: ${noteRes.status} ${await noteRes.text()}`);
    }

    // Update Collaboratore
    let collaboratorOk = true;
    if (collaborator) {
      const staffRes = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderId}/metafields.json`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metafield: {
            namespace: "custom",
            key: "collaboratore_ordine",
            value: collaborator,
            type: "single_line_text_field"
          }
        })
      });

      if (!staffRes.ok) {
        collaboratorOk = false;
        console.error(`Failed to update Shopify order collaboratore_ordine for ${cleanName}: ${staffRes.status} ${await staffRes.text()}`);
      }
    }

    const success = statoRes.ok || noteRes.ok || collaboratorOk;
    if (success) {
      console.log(`Successfully updated Shopify order metafields for order ${cleanName}`);
    }
    return success;
  } catch (error) {
    console.error(`Error updating Shopify order metafields for ${orderName}:`, error);
    return false;
  }
}

/**
 * Fetches recent Shopify orders (created in the last 24 hours) and returns sets of customer names and order names.
 */
export async function getRecentShopifyOrders(): Promise<{ customerNames: Set<string>; orderNames: Set<string>; customerEmails: Set<string> }> {
  const customerNames = new Set<string>();
  const orderNames = new Set<string>();
  const customerEmails = new Set<string>();
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      return { customerNames, orderNames, customerEmails };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const minDate = oneDayAgo.toISOString();

    const url = `https://${shop}/admin/api/2024-04/orders.json?created_at_min=${encodeURIComponent(minDate)}&status=any&limit=250&fields=name,customer`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const orders = data?.orders || [];
      for (const order of orders) {
        const orderName = String(order.name || "").trim().toLowerCase().replace(/^#/, "");
        if (orderName) {
          orderNames.add(orderName);
        }
        const firstName = String(order.customer?.first_name || "").trim();
        const lastName = String(order.customer?.last_name || "").trim();
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const cleanName = fullName.toLowerCase().trim();
        if (cleanName) {
          customerNames.add(cleanName);
        }
        const email = String(order.customer?.email || "").trim().toLowerCase();
        if (email) {
          customerEmails.add(email);
        }
      }
    } else {
      console.error(`Failed to fetch recent Shopify orders: ${res.status}`);
    }
  } catch (error) {
    console.error("Error in getRecentShopifyOrders:", error);
  }
  return { customerNames, orderNames, customerEmails };
}

/**
 * Fetches the details of a Shopify order given its name or ID.
 */
export async function getShopifyOrderDetails(orderName: string): Promise<{
  id: string;
  clientName: string | null;
  totalPrice: number | null;
  paidAmount: number;
  lineItems: Array<{ title: string; quantity: number; price: number }>;
  note: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  financialStatus: string | null;
  paymentGateways: string[];
  paymentMethod: "CARTA" | "CASHMATIC" | "CONTANTI" | "MISTO" | "DA_VERIFICARE";
  paymentBreakdown: Array<{
    method: "CARTA" | "CASHMATIC" | "CONTANTI" | "DA_VERIFICARE";
    gateway: string;
    amount: number;
    reference: string | null;
    processedAt: string | null;
  }>;
  paymentReference: string | null;
  transactionStatus: string | null;
  transactionProcessedAt: string | null;
} | null> {
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify configuration missing.");
      return null;
    }

    const cleanName = orderName.trim();
    if (!cleanName) return null;

    let orderData: any = null;

    // 1. Try direct ID query
    if (/^\d{12,}$/.test(cleanName.replace("#", ""))) {
      const directId = cleanName.replace("#", "");
      const res = await fetch(`https://${shop}/admin/api/2024-04/orders/${directId}.json`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        orderData = data?.order;
      }
    }

    // 2. Search by order name
    if (!orderData) {
      let searchQuery = cleanName;
      if (!searchQuery.startsWith("#") && /^\d+$/.test(searchQuery)) {
        searchQuery = `#${searchQuery}`;
      }

      const searchRes = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(searchQuery)}&status=any`, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const orders = searchData?.orders || [];
        if (orders.length > 0) {
          orderData = orders[0];
        } else {
          // Try searching without the '#' prefix
          const nameWithoutHash = searchQuery.replace("#", "");
          const searchResNoHash = await fetch(`https://${shop}/admin/api/2024-04/orders.json?name=${encodeURIComponent(nameWithoutHash)}&status=any`, {
            headers: {
              "X-Shopify-Access-Token": token,
              "Content-Type": "application/json",
            },
          });
          if (searchResNoHash.ok) {
            const searchDataNoHash = await searchResNoHash.json();
            const ordersNoHash = searchDataNoHash?.orders || [];
            if (ordersNoHash.length > 0) {
              orderData = ordersNoHash[0];
            }
          }
        }
      }
    }

    if (orderData) {
      const firstName = String(orderData.customer?.first_name || "").trim();
      const lastName = String(orderData.customer?.last_name || "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const clientName = fullName || null;

      const totalPrice = orderData.total_price ? parseFloat(orderData.total_price) : null;
      
      const lineItems = Array.isArray(orderData.line_items) 
        ? orderData.line_items.map((item: any) => ({
            title: item.title,
            quantity: item.quantity ? parseInt(item.quantity) : 1,
            price: item.price ? parseFloat(item.price) : 0,
          })) 
        : [];

      const note = orderData.note || null;
      const email = orderData.customer?.email || null;
      const phone = orderData.customer?.phone || null;
      const createdAt = orderData.created_at ? String(orderData.created_at) : null;
      const financialStatus = orderData.financial_status ? String(orderData.financial_status) : null;
      let paymentTransaction: any = null;
      let successfulPaymentTransactions: any[] = [];
      try {
        const transactionResponse = await fetch(`https://${shop}/admin/api/2024-04/orders/${orderData.id}/transactions.json`, {
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
        });
        if (transactionResponse.ok) {
          const transactionData = await transactionResponse.json();
          const transactions = Array.isArray(transactionData?.transactions) ? transactionData.transactions : [];
          successfulPaymentTransactions = transactions.filter((transaction: any) =>
            String(transaction.status).toLowerCase() === "success" &&
            ["sale", "capture"].includes(String(transaction.kind).toLowerCase())
          );
          paymentTransaction = successfulPaymentTransactions[0]
            ?? transactions.find((transaction: any) => String(transaction.status).toLowerCase() === "success")
            ?? transactions[0]
            ?? null;
        }
      } catch (transactionError) {
        console.error(`Error fetching Shopify transactions for ${orderData.id}:`, transactionError);
      }

      const paymentGateways = Array.isArray(orderData.payment_gateway_names)
        ? orderData.payment_gateway_names.map((gateway: unknown) => String(gateway).trim()).filter(Boolean)
        : paymentTransaction?.gateway || orderData.gateway
          ? [String(paymentTransaction?.gateway || orderData.gateway).trim()]
          : [];
      const rawPaymentBreakdown = successfulPaymentTransactions
        .map((transaction: any) => {
          const gateway = String(transaction.gateway || "").trim();
          const amount = Number.parseFloat(String(transaction.amount || "0"));
          return {
            method: classifyShopifyPaymentMethod([gateway]),
            gateway,
            amount: Number.isFinite(amount) ? amount : 0,
            reference: transaction.authorization ? String(transaction.authorization) : transaction.id ? String(transaction.id) : null,
            processedAt: transaction.processed_at ? String(transaction.processed_at) : transaction.created_at ? String(transaction.created_at) : null,
          };
        })
        .filter((transaction) => transaction.amount > 0);
      const paymentBreakdown = Array.from(
        rawPaymentBreakdown.reduce((groups, transaction) => {
          const key = `${transaction.method}:${transaction.gateway}`;
          const current = groups.get(key);
          groups.set(key, current
            ? { ...current, amount: current.amount + transaction.amount }
            : transaction);
          return groups;
        }, new Map<string, (typeof rawPaymentBreakdown)[number]>()).values(),
      );
      const recognizedMethods = new Set(paymentBreakdown.map((transaction) => transaction.method).filter((method) => method !== "DA_VERIFICARE"));
      const paymentMethod = recognizedMethods.size > 1
        ? "MISTO" as const
        : paymentBreakdown[0]?.method ?? classifyShopifyPaymentMethod(paymentGateways);
      const paidAmount = paymentBreakdown.reduce((total, payment) => total + payment.amount, 0);

      return {
        id: String(orderData.id),
        clientName,
        totalPrice,
        paidAmount,
        lineItems,
        note,
        email,
        phone,
        createdAt,
        financialStatus,
        paymentGateways,
        paymentMethod,
        paymentBreakdown,
        paymentReference: paymentTransaction?.authorization ? String(paymentTransaction.authorization) : paymentTransaction?.id ? String(paymentTransaction.id) : null,
        transactionStatus: paymentTransaction?.status ? String(paymentTransaction.status) : null,
        transactionProcessedAt: paymentTransaction?.processed_at ? String(paymentTransaction.processed_at) : paymentTransaction?.created_at ? String(paymentTransaction.created_at) : null,
      };
    }
  } catch (error) {
    console.error("Error fetching Shopify order details:", error);
  }
  return null;
}

export function classifyShopifyPaymentMethod(gateways: string[]): "CARTA" | "CASHMATIC" | "CONTANTI" | "DA_VERIFICARE" {
  const normalized = gateways.join(" ").toLowerCase();
  if (!normalized) return "DA_VERIFICARE";

  // Cashmatic is an automatic cash device, but operationally it belongs to
  // the same accounting bucket as cash. Keep one label and one filter.
  if (/cashmatic|selfpay|inpay/.test(normalized)) {
    return "CONTANTI";
  }

  if (/\bcash\b|contant|cash on delivery|pagamento manuale|manual payment/.test(normalized)) {
    return "CONTANTI";
  }

  if (/shopify payments|shopify_payments|card|carta|credit|debit|visa|mastercard|amex|stripe|pos|sumup|nexi|klarna|scalapay|satispay|paypal/.test(normalized)) {
    return "CARTA";
  }

  return "DA_VERIFICARE";
}

function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = a[i - 1] === b[j - 1] 
        ? tmp[i - 1][j - 1] 
        : Math.min(tmp[i - 1][j - 1] + 1, tmp[i][j - 1] + 1, tmp[i - 1][j] + 1);
    }
  }
  return tmp[a.length][b.length];
}

export function isFuzzyNameMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
  const n2 = name2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
  
  if (!n1 || !n2) return false;
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

  const words1 = n1.split(/\s+/).filter(w => w.length > 1);
  const words2 = n2.split(/\s+/).filter(w => w.length > 1);

  if (words1.length === 0 || words2.length === 0) return false;

  let matches = 0;
  for (const w1 of words1) {
    let found = false;
    for (const w2 of words2) {
      if (w1 === w2) {
        found = true;
        break;
      }
      const distance = getLevenshteinDistance(w1, w2);
      const maxDist = Math.max(1, Math.min(2, Math.floor(w1.length / 3)));
      if (distance <= maxDist) {
        found = true;
        break;
      }
    }
    if (found) {
      matches++;
    }
  }

  const minRequired = Math.min(words1.length, words2.length);
  return matches >= minRequired;
}
