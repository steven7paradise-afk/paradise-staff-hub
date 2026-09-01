import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLIENT_CONTROL_FIELD_IDS } from "@/lib/client-control-form";
import { getOperationalUser } from "@/lib/operational-session";
import { formatShopifyStaffNames } from "@/lib/shopify-staff-label";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
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
  const user = await getOperationalUser(request);
  if (!user?.id) {
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
        by: user.name || "Staff",
        at: new Date().toISOString(),
      };
      dataToUpdate.activity_log = [...currentLog, newLogEntry];
    }
    if (comments) dataToUpdate.comments = comments; // JSON array of comments
    if (answers) {
      const orderNum = String(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").trim();
      const originalAnswers = (response.answers as Record<string, any>) || {};
      const originalCorrectness = originalAnswers[CLIENT_CONTROL_FIELD_IDS.correctness];
      const newCorrectness = answers[CLIENT_CONTROL_FIELD_IDS.correctness];

      if (orderNum) {
        const { getShopifyOrderDetails } = await import("@/lib/shopify");
        const details = await getShopifyOrderDetails(orderNum).catch(() => null);
        if (details) {
          if (details.lineItems.length > 0) {
            answers[CLIENT_CONTROL_FIELD_IDS.productsList] = details.lineItems.map(item => item.quantity > 1 ? `${item.title} (x${item.quantity})` : item.title).join(", ");
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
            if (answers[CLIENT_CONTROL_FIELD_IDS.paid] === undefined || answers[CLIENT_CONTROL_FIELD_IDS.paid] === null || answers[CLIENT_CONTROL_FIELD_IDS.paid] === "") {
              answers[CLIENT_CONTROL_FIELD_IDS.paid] = details.totalPrice;
            }
            answers["client_control_shopify_expected_paid"] = details.totalPrice;
          }
          answers["client_control_shopify_order_note"] = details.note || "";

          // Auto-mark as "Da controllare" if there's a payment mismatch, EXCEPT if the user explicitly changed correctness in this request
          const userExplicitlyChangedCorrectness = newCorrectness !== undefined && newCorrectness !== originalCorrectness;
          if (!userExplicitlyChangedCorrectness) {
            const declaredPaid = answers[CLIENT_CONTROL_FIELD_IDS.paid];
            if (declaredPaid !== undefined && declaredPaid !== null && declaredPaid !== "") {
              const declaredNum = parseFloat(String(declaredPaid).replace(",", "."));
              if (!Number.isNaN(declaredNum) && details.totalPrice !== null && declaredNum !== details.totalPrice) {
                answers[CLIENT_CONTROL_FIELD_IDS.correctness] = "Da controllare";
              }
            }
          }
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
            user.name || "Staff",
            `Stato cambiato in "${statusLabelText}": ${statusNote.trim()}`
          ).catch((err) => console.error("Failed to sync note to Shopify:", err));
        }

        // 2. Sync status, latest custom note, and collaborator as Shopify Metafields!
        const selectedStaffNames = Array.isArray(answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff])
          ? answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff].map((value: unknown) => String(value ?? "").trim()).filter(Boolean)
          : typeof answers?.[CLIENT_CONTROL_FIELD_IDS.serviceStaff] === "string"
            ? answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff].split(",").map((value: string) => value.trim()).filter(Boolean)
            : [];
        const activeStaffNames = await prisma.user.findMany({
          where: { active: true, role: { notIn: ["ZERO", "SUPER_ADMIN"] } },
          select: { name: true },
        });
        const collaboratorName = formatShopifyStaffNames(
          selectedStaffNames,
          activeStaffNames.map((employee) => employee.name),
        ).join(", ");

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
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!["ZERO", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: {
        id: true,
        user_location_id: true,
        form: { select: { name: true, category: true } },
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    // ZERO conserva il permesso storico sulle risposte. Admin e Super Admin
    // ricevono invece il permesso aggiuntivo soltanto per i moduli ordine.
    const formName = response.form?.name?.trim().toLowerCase() ?? "";
    const formCategory = response.form?.category?.trim().toLowerCase() ?? "";
    const isOrder = formName.includes("ordine") || formCategory.includes("ordini");
    if (user.role !== "ZERO" && !isOrder) {
      return NextResponse.json({ error: "Puoi eliminare soltanto gli ordini" }, { status: 403 });
    }

    await prisma.serviceFormResponse.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete form response:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione della risposta" }, { status: 500 });
  }
}
