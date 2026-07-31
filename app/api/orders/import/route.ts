import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOrderForm } from "@/lib/order-form";

function parseCustomDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.toLowerCase().replace(/\s+/g, " ").trim();
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) return new Date(parsed);

  const normalized = clean.replace(/\b(de|di)\b/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10);
    
    let hour = 12;
    let min = 0;
    if (parts[3] && parts[3].includes(":")) {
      const timeParts = parts[3].split(":");
      hour = parseInt(timeParts[0], 10) || 12;
      min = parseInt(timeParts[1], 10) || 0;
    }
    
    const months: Record<string, number> = {
      gen: 0, gennaio: 0, ene: 0, enero: 0, jan: 0, january: 0,
      feb: 1, febbraio: 1, febr: 1, febrero: 1, february: 1,
      mar: 2, marzo: 2, march: 2,
      apr: 3, aprile: 3, abr: 3, abril: 3, april: 3,
      mag: 4, maggio: 4, may: 4, mayo: 4,
      giu: 5, giugno: 5, jun: 5, junio: 5, june: 5,
      lug: 6, luglio: 6, jul: 6, julio: 6, july: 6,
      ago: 7, agosto: 7, aug: 7, august: 7,
      set: 8, settembre: 8, sep: 8, sept: 8, septiembre: 8, september: 8,
      ott: 9, ottobre: 9, oct: 9, october: 9,
      nov: 10, novembre: 10, noviembre: 10, november: 10,
      dic: 11, dicembre: 11, december: 11
    };
    
    let monthIdx = -1;
    for (const [key, idx] of Object.entries(months)) {
      if (monthStr.startsWith(key) || key.startsWith(monthStr)) {
        monthIdx = idx;
        break;
      }
    }
    
    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      return new Date(year, monthIdx, day, hour, min);
    }
  }
  
  return new Date();
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const role = session.user.role;
    const canManageOrders =
      ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role) ||
      session.user.id === "cmpo4y9900001jr09bg1dnqxs" ||
      session.user.id === "cmpms4o9h0003l809zof30mni" ||
      !!session.user.email?.toLowerCase().includes("jessica") ||
      !!session.user.email?.toLowerCase().includes("darwin");

    if (!canManageOrders) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const data = await req.json();
    const { orders } = data as { 
      orders: { 
        clientName: string; 
        rows: Record<string, string>[];
        status?: string;
        createdAt?: string;
      }[] 
    };

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    const orderForm = await ensureOrderForm(session.user.id);
    if (!orderForm) {
      return NextResponse.json({ error: "Modulo ordine non trovato" }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { sede_id: true, location: true },
    });

    const responses = await Promise.all(
      orders.map(async (order) => {
        // Construct the multiline details description
        const notes = order.rows.map((r, index) => {
          const details = Object.entries(r)
            .filter(([k, v]) => typeof v === "string" && v.trim() !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
          return `--- RIGA ${index + 1} ---\n${details}`;
        }).join("\n\n");

        const answers: Record<string, any> = {};

        const titleField = (orderForm.fields as any[]).find((f) => f.id === "order_title" || normalizeKey(f.label) === "nomeordine")?.id;
        const itemsField = (orderForm.fields as any[]).find((f) => f.id === "order_items" || normalizeKey(f.label) === "cosardinare")?.id;
        const supplierField = (orderForm.fields as any[]).find((f) => f.id === "order_supplier" || normalizeKey(f.label) === "fornitorelinkacquisto")?.id;
        const priorityField = (orderForm.fields as any[]).find((f) => f.id === "order_priority" || normalizeKey(f.label) === "priorita")?.id;

        const titleFieldId = titleField || "order_title";
        const itemsFieldId = itemsField || "order_items";
        const supplierFieldId = supplierField || "order_supplier";
        const priorityFieldId = priorityField || "order_priority";

        answers[titleFieldId] = `Ordine per: ${order.clientName}`;
        answers[itemsFieldId] = notes;
        answers[supplierFieldId] = "Importato da CSV";
        answers[priorityFieldId] = "Normale";

        // Map CSV fields to form fields dynamically
        for (const field of (orderForm.fields as any[])) {
          if (field.id === titleFieldId || field.id === itemsFieldId || field.id === supplierFieldId || field.id === priorityFieldId) {
            continue;
          }

          // Hardcode Nome cognome since it is filtered out from raw rows
          if (field.id === "field_1782212649889") {
            answers[field.id] = order.clientName;
            continue;
          }

          const normLabel = normalizeKey(field.label);
          const firstRow = order.rows[0];
          if (!firstRow) continue;

          // Define aliases for matching common synonyms
          const aliases: Record<string, string[]> = {
            "field_1782212680362": ["email", "mail", "email address"],
            "field_1782212690129": ["telefono", "cellulare", "phone"],
            "field_1782212712780": ["disponibilita", "sono::"],
            "field_1782221517924": ["ordine shopify", "numero ordine shopify", "shopify"]
          };

          const fieldAliases = aliases[field.id] || [];

          // 1. Exact match pass
          let csvKey = Object.keys(firstRow).find((k) => {
            const normK = normalizeKey(k);
            if (!normK || !normLabel) return false;
            
            const exactMatch = normK === normLabel;
            if (exactMatch) return true;
            
            return fieldAliases.some(alias => normalizeKey(alias) === normK);
          });

          // 2. Fuzzy match pass
          if (!csvKey) {
            csvKey = Object.keys(firstRow).find((k) => {
              const normK = normalizeKey(k);
              if (!normK || !normLabel) return false;
              
              const fuzzyMatch = normK.includes(normLabel) || normLabel.includes(normK);
              if (fuzzyMatch) return true;
              
              return fieldAliases.some(alias => {
                const normAlias = normalizeKey(alias);
                return normK.includes(normAlias) || normAlias.includes(normK);
              });
            });
          }

          if (csvKey) {
            const values = order.rows
              .map((r) => String(r[csvKey] || "").trim())
              .filter(Boolean);
            const uniqueValues = Array.from(new Set(values));

            if (uniqueValues.length > 0) {
              if (field.type === "select") {
                const val = uniqueValues[0];
                const matchedOption = (field.options as string[] || []).find((o) => 
                  normalizeKey(o).includes(normalizeKey(val)) || 
                  normalizeKey(val).includes(normalizeKey(o))
                );
                answers[field.id] = matchedOption || val;
              } else if (field.type === "date") {
                const dateVal = parseCustomDate(uniqueValues[0]);
                answers[field.id] = dateVal.toISOString().split("T")[0];
              } else {
                answers[field.id] = uniqueValues.join(" / ");
              }
            }
          }
        }

        const targetDate = order.createdAt ? new Date(order.createdAt) : new Date();

        return prisma.serviceFormResponse.create({
          data: {
            form_id: orderForm.id,
            user_id: session.user.id,
            user_role: role,
            user_location_id: user?.sede_id ?? null,
            user_location_name: user?.location?.name ?? "Nessuna sede",
            answers,
            status: order.status || "NEW",
            priority: "Normale",
            assigned_to_id: null,
            internal_notes: [],
            comments: [],
            created_at: targetDate,
            updated_at: targetDate,
            activity_log: [
              {
                type: "STATUS_CHANGE",
                from: "NEW",
                to: order.status || "NEW",
                note: "Ordine importato da CSV",
                by: session.user.name ?? "Utente sconosciuto",
                at: new Date().toISOString(),
              },
            ],
          },
        });
      })
    );

    return NextResponse.json({ success: true, count: responses.length });
  } catch (error) {
    console.error("Errore importazione CSV:", error);
    return NextResponse.json({ error: "Errore durante l'importazione" }, { status: 500 });
  }
}
