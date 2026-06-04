import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadPrivateDocument } from "@/lib/supabase-storage";
import { appendFormResponseToGoogleSheet } from "@/lib/google-sheet";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const data = await request.formData();
    const formId = String(data.get("formId") ?? "");
    const answersStr = String(data.get("answers") ?? "{}");

    if (!formId) {
      return NextResponse.json({ error: "ID modulo obbligatorio." }, { status: 400 });
    }

    const form = await prisma.serviceForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      return NextResponse.json({ error: "Modulo non trovato." }, { status: 404 });
    }

    const answersObj = JSON.parse(answersStr);

    // Process file fields and upload them to Supabase
    const fields = form.fields as Array<{ id: string; label: string; type: string; required?: boolean }>;
    for (const field of fields) {
      if (field.type === "file") {
        const file = data.get(field.id);
        if (file && file instanceof File && file.size > 0) {
          if (file.size > 15 * 1024 * 1024) {
            return NextResponse.json({ error: `File per "${field.label}" supera il limite di 15 MB.` }, { status: 400 });
          }
          const storagePath = await uploadPrivateDocument(session.user.id, file);
          // Store the path, original name, and mime type
          answersObj[field.id] = {
            storagePath,
            name: file.name,
            type: file.type,
          };
        } else {
          // Keep null if empty
          answersObj[field.id] = null;
        }
      }
    }

    const location = session.user.sedeId
      ? await prisma.location.findUnique({ where: { id: session.user.sedeId } })
      : null;

    const response = await prisma.serviceFormResponse.create({
      data: {
        form_id: formId,
        user_id: session.user.id,
        user_role: session.user.role,
        user_location_id: session.user.sedeId || null,
        user_location_name: location?.name || null,
        answers: answersObj,
      },
      include: {
        user: true,
      },
    });

    // Try syncing to Google Sheets
    let googleSheetSync = { success: true };
    try {
      await appendFormResponseToGoogleSheet({
        formName: form.name,
        fields,
        employeeName: session.user.name ?? "Dipendente",
        employeeEmail: session.user.email ?? "",
        locationName: location?.name ?? "Nessuna sede",
        answers: answersObj,
      });
    } catch (sheetError) {
      console.error("Google Sheet synchronization failed:", sheetError);
      googleSheetSync = {
        success: false,
        // @ts-ignore
        error: sheetError instanceof Error ? sheetError.message : "Sync error",
      };
    }

    // Notify Responsabili of that salon (or Admin/Super Admin as fallback)
    try {
      let recipients = session.user.sedeId
        ? await prisma.user.findMany({
            where: {
              active: true,
              role: "RESPONSABILE",
              sede_id: session.user.sedeId,
            },
          })
        : [];

      if (recipients.length === 0) {
        // Fallback to admins/super admins if there are no Responsabili in that salon
        recipients = await prisma.user.findMany({
          where: {
            active: true,
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
          },
        });
      }

      if (recipients.length > 0) {
        const { createNotifications } = await import("@/lib/notifications");
        const { sendEmail, emailTemplates } = await import("@/lib/email");

        // Send app notification (triggers Chrome push & WhatsApp if phone exists)
        await createNotifications(
          recipients.map((r) => ({
            user_id: r.id,
            title: `Modulo Compilato: ${form.name}`,
            message: `Il dipendente ${session.user.name ?? "Dipendente"} ha inviato una risposta per il modulo "${form.name}".`,
            type: "FORM",
            action_url: "/settings/forms",
          }))
        );

        // Send Email
        const emailTemplate = emailTemplates.formResponseSubmitted(
          session.user.name ?? "Dipendente",
          form.name,
          location?.name ?? "Nessuna sede"
        );

        await Promise.allSettled(
          recipients.map((r) =>
            sendEmail({
              to: r.email,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            })
          )
        );
      }
    } catch (notificationError) {
      console.error("Failed to send form submission notifications:", notificationError);
    }

    return NextResponse.json({ response, googleSheetSync });
  } catch (error) {
    console.error("Form submission failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invio del modulo fallito." }, { status: 500 });
  }
}
