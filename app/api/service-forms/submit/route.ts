import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";
import { appendFormResponseToGoogleSheet } from "@/lib/google-sheet";
import { cashDateFromInput, moneyNumber } from "@/lib/cash-records";
import { CASH_CLOSING_FIELD_IDS, isCashClosingFormName } from "@/lib/cash-closing-form";
import { isPinValidForUser, identifyWorkerByPin } from "@/lib/pin";
import { getOperationalUser } from "@/lib/operational-session";

type FormSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  sedeId?: string | null;
};

function safeFilePart(value: unknown, fallback: string) {
  const cleaned = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function fileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName.slice(0, 10);
  const fromType = file.type.split("/")[1]?.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (fromType === "jpeg") return "jpg";
  return fromType?.slice(0, 10) || "bin";
}

async function uploadFormFileToDrive(file: File, context: { userId: string; formName: string; fieldLabel: string }) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = fileExtension(file);
  const fileName = [
    safeFilePart(context.formName, "modulo"),
    safeFilePart(context.fieldLabel, "file"),
    safeFilePart(context.userId, "utente"),
    new Date().toISOString().replace(/[:.]/g, "-"),
  ].join("-") + `.${extension}`;
  const mimeType = file.type || "application/octet-stream";
  const driveFile = await uploadFileToGoogleDrive(buffer, fileName, mimeType);

  return {
    url: driveFile.webViewLink || driveFile.webContentLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
    driveFileId: driveFile.id,
    driveFileUrl: driveFile.webViewLink || null,
    webViewLink: driveFile.webViewLink || null,
    webContentLink: driveFile.webContentLink || null,
    previewUrl: driveFile.thumbnailLink || (driveFile.id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile.id)}&sz=w1200` : null),
    name: driveFile.name || fileName,
    originalName: file.name,
    type: mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  let sessionUser = await getOperationalUser(request) as FormSessionUser | null;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // Resolve valid database user ID for FK relations if sessionUser.id is "PC_CASSA" or unlinked
  let dbUserId = sessionUser.id;
  if (dbUserId === "PC_CASSA") {
    const fallbackUser = await prisma.user.findFirst({
      where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"] } },
      select: { id: true, name: true, role: true, sede_id: true },
    }) || await prisma.user.findFirst({ where: { active: true }, select: { id: true, name: true, role: true, sede_id: true } });
    
    if (fallbackUser) {
      dbUserId = fallbackUser.id;
    }
  } else {
    const exists = await prisma.user.findUnique({ where: { id: dbUserId }, select: { id: true } });
    if (!exists) {
      const fallbackUser = await prisma.user.findFirst({ where: { active: true }, select: { id: true } });
      if (fallbackUser) dbUserId = fallbackUser.id;
    }
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

    // Process file fields and upload them to Google Drive.
    const fields = form.fields as Array<{ id: string; label: string; type: string; required?: boolean }>;
    for (const field of fields) {
      if (field.type === "file") {
        const file = data.get(field.id);
        if (file && file instanceof File && file.size > 0) {
          if (file.size > 80 * 1024 * 1024) {
            return NextResponse.json({ error: `File per "${field.label}" supera il limite di 80 MB.` }, { status: 400 });
          }
          answersObj[field.id] = await uploadFormFileToDrive(file, {
            userId: dbUserId,
            formName: form.name,
            fieldLabel: field.label,
          });
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

      let signingUser: { id: string; name: string; role: string; pin_hash?: string | null; pin_lookup?: string | null } | null = null;

      if (sessionUser.id !== "PC_CASSA") {
        signingUser = await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { id: true, name: true, role: true, pin_hash: true, pin_lookup: true },
        });
      }

      if (pinValue && /^\d{2,6}$/.test(pinValue)) {
        const found = await identifyWorkerByPin(pinValue, sessionUser.sedeId || "");
        if (found) {
          signingUser = { id: found.id, name: found.name, role: found.role };
        } else if (signingUser?.pin_hash) {
          const isValid = await isPinValidForUser(signingUser.id, pinValue, signingUser.pin_hash, signingUser.pin_lookup);
          if (!isValid) signingUser = null;
        }
      }

      if (!signingUser) {
        signingUser = await prisma.user.findUnique({
          where: { id: dbUserId },
          select: { id: true, name: true, role: true },
        });
      }

      if (!signingUser) {
        return NextResponse.json({ error: "PIN personale non valido per firmare la chiusura cassa." }, { status: 401 });
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
          user_id: signingUser.id,
          location_id: sessionUser.sedeId,
          date: accountingDate,
          withdrawn,
          fund,
          notes: notesValue || null,
          signature_name: signingUser.name,
          signature_role: signingUser.role,
          signed_at: signedAt,
        },
        include: { user: true, location: true },
      });

      return NextResponse.json({
        response: {
          id: cashClosing.id,
          form_id: formId,
          user_id: cashClosing.user_id,
          user_role: signingUser.role,
          user_location_id: cashClosing.location_id,
          user_location_name: cashClosing.location.name,
          answers: {
            ...answersObj,
            _signature: {
              user_id: signingUser.id,
              user_name: signingUser.name,
              user_role: signingUser.role,
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
        user_id: dbUserId,
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
