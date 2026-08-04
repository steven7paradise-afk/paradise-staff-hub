import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadPrivateDocument } from "@/lib/supabase-storage";
import { appendFormResponseToGoogleSheet } from "@/lib/google-sheet";
import { cashDateFromInput, moneyNumber } from "@/lib/cash-records";
import { CASH_CLOSING_FIELD_IDS, isCashClosingFormName } from "@/lib/cash-closing-form";
import { isPinValidForUser } from "@/lib/pin";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";

type FormSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  sedeId?: string | null;
};

export async function POST(request: NextRequest) {
  const session = await auth();
  let sessionUser = session?.user as FormSessionUser | undefined;
  const pcAuth = !sessionUser
    ? await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value)
    : null;

  if (!sessionUser && pcAuth) {
    const selectedWorkerName = request.cookies.get(appointmentsPcWorkerCookieName)?.value
      ? decodeURIComponent(request.cookies.get(appointmentsPcWorkerCookieName)?.value || "")
      : "";
    const selectedWorker = selectedWorkerName
      ? await prisma.user.findFirst({
          where: { name: selectedWorkerName, active: true, sede_id: pcAuth.locationId },
          select: { id: true, name: true, email: true, role: true, sede_id: true },
        })
      : null;

    sessionUser = selectedWorker
      ? {
          id: selectedWorker.id,
          name: selectedWorker.name,
          email: selectedWorker.email,
          role: selectedWorker.role,
          sedeId: selectedWorker.sede_id,
        }
      : {
          id: "u-super-admin",
          name: pcAuth.name,
          email: "cassa@paradise.tech",
          role: "RESPONSABILE",
          sedeId: pcAuth.locationId,
        };
  }

  if (!sessionUser?.id) {
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
    const isCashClosing = isCashClosingFormName(form.name, form.category);

    // Process file fields and upload them to Supabase
    const fields = form.fields as Array<{ id: string; label: string; type: string; required?: boolean }>;
    for (const field of fields) {
      if (field.type === "file") {
        const file = data.get(field.id);
        if (file && file instanceof File && file.size > 0) {
          if (file.size > 80 * 1024 * 1024) {
            return NextResponse.json({ error: `File per "${field.label}" supera il limite di 80 MB.` }, { status: 400 });
          }
          const storagePath = await uploadPrivateDocument(sessionUser.id, file);
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

    const location = sessionUser.sedeId
      ? await prisma.location.findUnique({ where: { id: sessionUser.sedeId } })
      : null;

    if (isCashClosing) {
      const pinField = fields.find((field) => field.type === "pin" || field.id === CASH_CLOSING_FIELD_IDS.pin || field.label.toUpperCase().includes("PIN"));
      const pinValue = pinField ? String(answersObj[pinField.id] ?? "").trim() : "";
      if (!/^\d{4,6}$/.test(pinValue)) {
        return NextResponse.json({ error: "Inserisci il PIN personale per firmare la chiusura cassa." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, name: true, role: true, pin_hash: true, pin_lookup: true },
      });

      if (!user?.pin_hash || !(await isPinValidForUser(user.id, pinValue, user.pin_hash, user.pin_lookup))) {
        return NextResponse.json({ error: "PIN personale non valido. La chiusura cassa non e stata firmata." }, { status: 401 });
      }

      const fundValue = Number(String(answersObj[CASH_CLOSING_FIELD_IDS.fund] ?? "").replace(",", "."));
      const notesValue = String(answersObj[CASH_CLOSING_FIELD_IDS.notes] ?? "").trim();
      if (Number.isFinite(fundValue) && Math.abs(fundValue - 50) > 0.009 && !notesValue) {
        return NextResponse.json({ error: "Il fondo cassa e diverso da € 50,00: inserisci una nota di giustificazione." }, { status: 400 });
      }

      if (pinField) {
        delete answersObj[pinField.id];
      }

      if (!location || !sessionUser.sedeId) {
        return NextResponse.json({ error: "Sede non assegnata: impossibile registrare la chiusura cassa." }, { status: 400 });
      }

      const accountingDate = cashDateFromInput(answersObj[CASH_CLOSING_FIELD_IDS.date]);
      const withdrawn = moneyNumber(answersObj[CASH_CLOSING_FIELD_IDS.withdrawn]);
      const fund = moneyNumber(answersObj[CASH_CLOSING_FIELD_IDS.fund]);
      if (!accountingDate || withdrawn < 0 || !Number.isFinite(fund)) {
        return NextResponse.json({ error: "Data, importo prelevato e fondo cassa sono obbligatori." }, { status: 400 });
      }

      const signedAt = new Date();
      const cashClosing = await prisma.cashClosing.create({
        data: {
          user_id: user.id,
          location_id: sessionUser.sedeId,
          date: accountingDate,
          withdrawn,
          fund,
          notes: notesValue || null,
          signature_name: user.name,
          signature_role: user.role,
          signed_at: signedAt,
        },
        include: { user: true, location: true },
      });

      return NextResponse.json({
        response: {
          id: cashClosing.id,
          form_id: formId,
          user_id: cashClosing.user_id,
          user_role: user.role,
          user_location_id: cashClosing.location_id,
          user_location_name: cashClosing.location.name,
          answers: {
            ...answersObj,
            _signature: {
              user_id: user.id,
              user_name: user.name,
              user_role: user.role,
              signed_at: signedAt.toISOString(),
            },
          },
          status: "COMPLETED",
          created_at: cashClosing.created_at,
          updated_at: cashClosing.updated_at,
          user: cashClosing.user,
        },
        googleSheetSync: { success: true, skipped: true, target: "cash_closings" },
      });
    }

    const response = await prisma.serviceFormResponse.create({
      data: {
        form_id: formId,
        user_id: sessionUser.id,
        user_role: sessionUser.role,
        user_location_id: sessionUser.sedeId || null,
        user_location_name: location?.name || null,
        answers: answersObj,
      },
      include: {
        user: true,
        form: true,
      },
    });

    // Automatically create a Candidate record if the form is for candidatura
    if (form.name.toUpperCase().includes("CANDIDATURA")) {
      try {
        let nameVal = "";
        let emailVal = "";
        let phoneVal = "";
        let birthVal: string | null = null;
        let roleVal = "Altro";
        let notesVal = "";

        const formFields = form.fields as Array<{ id: string; label: string; type: string }>;
        for (const field of formFields) {
          const labelUpper = field.label.toUpperCase();
          const val = answersObj[field.id];
          if (!val) continue;

          if (labelUpper.includes("NOME")) {
            nameVal = String(val).trim();
          } else if (labelUpper.includes("EMAIL")) {
            emailVal = String(val).trim();
          } else if (labelUpper.includes("TELEFONO") || labelUpper.includes("NUMERO") || labelUpper.includes("CELLULARE")) {
            phoneVal = String(val).trim();
          } else if (labelUpper.includes("NASCITA") || labelUpper.includes("DATA")) {
            birthVal = String(val).trim();
          } else if (labelUpper.includes("RUOLO") || labelUpper.includes("MANSIONE") || labelUpper.includes("PROFESSIONE")) {
            roleVal = String(val).trim();
          } else if (labelUpper.includes("NOTE") || labelUpper.includes("COMMENTI")) {
            notesVal = String(val).trim();
          }
        }

        if (nameVal) {
          const nameParts = nameVal.split(/\s+/);
          const first_name = nameParts[0] || "Nuovo";
          const last_name = nameParts.slice(1).join(" ") || "Candidato";
          
          await prisma.candidate.create({
            data: {
              first_name,
              last_name,
              phone: phoneVal || "Non fornito",
              email: emailVal || "candidato@paradise.it",
              birth_date: birthVal ? new Date(birthVal) : null,
              profession: roleVal,
              preferred_location: location?.name || "Tutte",
              availability: "Immediata",
              experience: "Meno di 1 anno",
              initial_notes: notesVal || "Inserito automaticamente tramite form in salone.",
              status: "Nuova candidatura",
            }
          });
        }
      } catch (candError) {
        console.error("Failed to automatically create candidate from form submission:", candError);
      }
    }

    // Try syncing to Google Sheets
    let googleSheetSync = { success: true };
    try {
      await appendFormResponseToGoogleSheet({
        formName: form.name,
        fields,
        employeeName: sessionUser.name ?? "Dipendente",
        employeeEmail: sessionUser.email ?? "",
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
      let notifyRoles = form.notify_roles as string[] | null;
      let notifyUserIds = form.notify_user_ids as string[] | null;
      let recipients: any[] = [];

      if ((notifyRoles && notifyRoles.length > 0) || (notifyUserIds && notifyUserIds.length > 0)) {
        if (notifyRoles && notifyRoles.length > 0) {
          const matchedUsers = await prisma.user.findMany({
            where: {
              active: true,
              role: { in: notifyRoles as any[] },
            },
          });
          const roleRecipients = matchedUsers.filter((u) => {
            if (u.role === "ZERO" || u.role === "SUPER_ADMIN" || u.role === "ADMIN") return true;
            if (!sessionUser.sedeId) return true;
            return u.sede_id === sessionUser.sedeId;
          });
          recipients.push(...roleRecipients);
        }

        if (notifyUserIds && notifyUserIds.length > 0) {
          const matchedUsers = await prisma.user.findMany({
            where: {
              active: true,
              id: { in: notifyUserIds },
            },
          });
          recipients.push(...matchedUsers);
        }

        const seen = new Set();
        recipients = recipients.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      } else {
        recipients = sessionUser.sedeId
          ? await prisma.user.findMany({
              where: {
                active: true,
                role: "RESPONSABILE",
                sede_id: sessionUser.sedeId,
              },
            })
          : [];

        if (recipients.length === 0) {
          recipients = await prisma.user.findMany({
            where: {
              active: true,
              role: { in: ["ADMIN", "SUPER_ADMIN"] },
            },
          });
        }
      }

      if (recipients.length > 0) {
        const { createNotifications } = await import("@/lib/notifications");
        const { sendEmail, emailTemplates } = await import("@/lib/email");

        // Send app notification (triggers Chrome push & WhatsApp if phone exists)
        await createNotifications(
          recipients.map((r) => ({
            user_id: r.id,
            title: `Modulo Compilato: ${form.name}`,
            message: `Il dipendente ${sessionUser.name ?? "Dipendente"} ha inviato una risposta per il modulo "${form.name}".`,
            type: "FORM",
            action_url: `/service-forms/responses/${response.id}`,
          }))
        );

        // Send Email
        const emailTemplate = emailTemplates.formResponseSubmitted(
          sessionUser.name ?? "Dipendente",
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
