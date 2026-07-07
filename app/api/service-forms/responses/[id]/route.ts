import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      include: {
        user: true,
        form: true,
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch form response:", error);
    return NextResponse.json({ error: "Errore durante il recupero della risposta" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, comments, answers, statusNote, internalNotes } = body;

    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (internalNotes !== undefined) {
      dataToUpdate.internal_notes = internalNotes;
    }
    if (status) {
      dataToUpdate.status = status;

      // Track status changes in the activity log field
      const currentLog = Array.isArray(response.activity_log) ? (response.activity_log as any[]) : [];
      const newLogEntry = {
        type: "STATUS_CHANGE",
        from: response.status,
        to: status,
        note: statusNote || "",
        by: session.user.name || "Staff",
        at: new Date().toISOString(),
      };
      dataToUpdate.activity_log = [...currentLog, newLogEntry];
    }
    if (comments) dataToUpdate.comments = comments; // JSON array of comments
    if (answers) {
      const orderNum = String(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").trim();
      if (orderNum) {
        const { getShopifyOrderDetails } = await import("@/lib/shopify");
        const details = await getShopifyOrderDetails(orderNum).catch(() => null);
        if (details) {
          if (details.lineItems.length > 0) {
            answers[CLIENT_CONTROL_FIELD_IDS.productsList] = details.lineItems.join(", ");
            answers[CLIENT_CONTROL_FIELD_IDS.products] = true;
          }
          if (details.clientName && !answers[CLIENT_CONTROL_FIELD_IDS.clientName]) {
            answers[CLIENT_CONTROL_FIELD_IDS.clientName] = details.clientName;
          }
          if (details.email && !answers[CLIENT_CONTROL_FIELD_IDS.email]) {
            answers[CLIENT_CONTROL_FIELD_IDS.email] = details.email;
          }
          if (details.phone && !answers[CLIENT_CONTROL_FIELD_IDS.phone]) {
            answers[CLIENT_CONTROL_FIELD_IDS.phone] = details.phone;
          }
          if (details.totalPrice !== null) {
            answers[CLIENT_CONTROL_FIELD_IDS.paid] = details.totalPrice;
            answers["client_control_shopify_expected_paid"] = details.totalPrice;
          }
          answers["client_control_shopify_order_note"] = details.note || "";
        }
      }
      dataToUpdate.answers = answers; // JSON object of answers
    }

    const updatedResponse = await prisma.serviceFormResponse.update({
      where: { id },
      data: dataToUpdate,
      include: {
        user: true,
        form: true,
      }
    });

    // Automatically sync status change notes to the matching Shopify order
    if (status) {
      const title = String((updatedResponse.answers as any)?.order_title || "").trim();
      let shopifyOrderName: string | null = null;
      const titleMatch = title.match(/#\d+/);
      if (titleMatch) {
        shopifyOrderName = titleMatch[0];
      } else if (/^22\d{3}$/.test(title)) {
        shopifyOrderName = `#${title}`;
      } else {
        const answersObj = (updatedResponse.answers as Record<string, any>) || {};
        for (const val of Object.values(answersObj)) {
          if (typeof val === "string") {
            const match = val.match(/#\d+/);
            if (match) {
              shopifyOrderName = match[0];
              break;
            }
            if (/^22\d{3}$/.test(val)) {
              shopifyOrderName = `#${val}`;
              break;
            }
          }
        }
      }

      if (shopifyOrderName) {
        const { appendShopifyOrderNote, updateShopifyOrderMetafields } = await import("@/lib/shopify");
        const STATUS_LABELS: Record<string, string> = {
          NEW: "Nuovo ordine",
          PREPARING: "Preparando ordine",
          ORDERED: "Ordinato",
          READY: "Arrivato / pronto",
          COMPLETED: "Completato",
        };
        const statusLabelText = STATUS_LABELS[status] || status;
        
        // 1. Sync custom status note as an order note (comment history on Shopify)
        if (statusNote && statusNote.trim()) {
          await appendShopifyOrderNote(
            shopifyOrderName,
            session.user.name || "Staff",
            `Stato cambiato in "${statusLabelText}": ${statusNote.trim()}`
          ).catch((err) => console.error("Failed to sync note to Shopify:", err));
        }

        // 2. Sync status, latest custom note, and collaborator as Shopify Metafields!
        const collaboratorName = Array.isArray(answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff])
          ? answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff].join(", ")
          : typeof answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff] === "string"
            ? answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]
            : "";

        await updateShopifyOrderMetafields(
          shopifyOrderName,
          statusLabelText,
          statusNote || "",
          collaboratorName
        ).catch((err) => console.error("Failed to update Shopify metafields:", err));
      }
    }

    return NextResponse.json(updatedResponse);
  } catch (error) {
    console.error("Failed to update form response:", error);
    return NextResponse.json({ error: "Errore durante l'aggiornamento della risposta" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, user_location_id: true },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    await prisma.serviceFormResponse.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete form response:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione della risposta" }, { status: 500 });
  }
}
