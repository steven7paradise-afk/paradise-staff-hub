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
 * Appends a staff comment/note to a Shopify order's note field.
 * Handles inputs representing either order name (e.g. #22910) or direct order ID.
 */
export async function appendShopifyOrderNote(orderName: string, userName: string, message: string): Promise<boolean> {
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

    // 3. Format the new note block
    const newNoteBlock = `Staff: ${userName}\n${message}`;
    const updatedNote = currentNote.trim()
      ? `${currentNote.trim()}\n\n${newNoteBlock}`
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
export async function getShopifyOrderNoteText(orderName: string): Promise<string | null> {
  try {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      console.warn("Shopify shop domain or access token not configured.");
      return null;
    }

    const cleanName = orderName.trim();
    if (!cleanName) return null;

    let orderId: string | number | null = null;

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
        return data?.order?.note || null;
      }
    }

    // 2. Otherwise search by name
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
        return orders[0].note || null;
      }

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
          return ordersNoHash[0].note || null;
        }
      }
    }
  } catch (error) {
    console.error("Error in getShopifyOrderNoteText:", error);
  }
  return null;
}

/**
 * Updates status and note metafields on a Shopify order.
 * Handles inputs representing either order name (e.g. #22910) or direct order ID.
 */
export async function updateShopifyOrderMetafields(
  orderName: string,
  status: string,
  note: string
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

    const success = statoRes.ok || noteRes.ok;
    if (success) {
      console.log(`Successfully updated Shopify order metafields for order ${cleanName}`);
    }
    return success;
  } catch (error) {
    console.error(`Error updating Shopify order metafields for ${orderName}:`, error);
    return false;
  }
}


