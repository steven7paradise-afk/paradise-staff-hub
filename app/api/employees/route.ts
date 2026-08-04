import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { isPinAlreadyAssigned, pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function readableCreateError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    const target = Array.isArray((error as { meta?: { target?: unknown } }).meta?.target)
      ? ((error as { meta?: { target?: string[] } }).meta?.target ?? []).join(", ")
      : "";

    if (code === "P2002") {
      if (target.includes("email")) return "Questa email e gia assegnata a un altro collaboratore.";
      if (target.includes("pin_lookup")) return "Questo PIN e gia assegnato a un altro collaboratore.";
      return "Esiste gia un collaboratore con questi dati.";
    }
  }

  return error instanceof Error ? error.message : "Errore durante la creazione del collaboratore.";
}

function temporaryPassword() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Paradise-${suffix}!`;
}

async function uniquePin() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await isPinAlreadyAssigned(pin))) return pin;
  }
  throw new Error("Impossibile generare un PIN unico.");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !managementRoles.has(session.user.role)) {
      return apiError("Non autorizzato", 403);
    }

    const data = await request.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return apiError("Dati collaboratore non validi.", 400);
    }

    const email = String(data.email ?? "").trim().toLowerCase();
    const name = String(data.name ?? "").trim();
    const providedPassword = String(data.password ?? "");
    const providedPin = String(data.pin ?? "");
    const password = providedPassword || temporaryPassword();
    const pin = providedPin || await uniquePin();
    const role = String(data.role ?? "DIPENDENTE") as UserRole;
    const birthDate = data.birthDate ? new Date(String(data.birthDate)) : null;
    const contractStart = data.contractStart ? new Date(String(data.contractStart)) : null;
    const contractEnd = data.contractEnd ? new Date(String(data.contractEnd)) : null;
    const whatsappPhone = data.whatsappPhone ? String(data.whatsappPhone).trim() : null;
    const mansione = data.mansione ? String(data.mansione).trim() : null;

    if (!name || !email || password.length < 8 || !/^\d{2,6}$/.test(pin)) {
      return apiError("Nome, email, password valida e PIN da 4 a 6 numeri sono obbligatori.", 400);
    }
    if (!Object.values(UserRole).includes(role)) {
      return apiError("Ruolo non valido.", 400);
    }
    if (await isPinAlreadyAssigned(pin)) {
      return apiError("Questo PIN e gia assegnato a un altro lavoratore. Inserisci un codice unico.", 409);
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: await bcrypt.hash(password, 12),
        pin_hash: await bcrypt.hash(pin, 12),
        pin_lookup: pinLookup(pin),
        role,
        sede_id: data.sedeId ? String(data.sedeId) : null,
        birth_date: birthDate,
        fiscal_code: data.fiscalCode ? String(data.fiscalCode).trim().toUpperCase() : null,
        contract_start: contractStart,
        contract_end: contractEnd,
        photo_url: data.photoUrl ? String(data.photoUrl).trim() : null,
        whatsapp_phone: whatsappPhone,
        mansione,
        employee_status: data.employeeStatus ? String(data.employeeStatus) : "Attivo",
        google_calendar_id: data.googleCalendarId ? String(data.googleCalendarId).trim() : null,
        google_calendar_sync: data.googleCalendarSync !== undefined ? Boolean(data.googleCalendarSync) : false,
        active: data.active !== false,
        iban: data.iban ? String(data.iban).trim().toUpperCase() : null,
        manager_id: data.managerId ? String(data.managerId) : null,
        access_list: data.accessList !== undefined ? data.accessList : undefined,
        hr_notes: data.hrNotes ? String(data.hrNotes) : null,
        workforce_data: data.workforceData && typeof data.workforceData === "object" && !Array.isArray(data.workforceData) ? data.workforceData : undefined,
        contract_history: data.contractHistory !== undefined ? data.contractHistory : undefined,
        last_edited_by_id: session.user.id,
        last_edited_at: new Date(),
      },
    });

    let emailStatus: Awaited<ReturnType<typeof sendEmail>> | { skipped: true; reason: string };
    try {
      emailStatus = await sendEmail({ to: email, ...emailTemplates.accountCreated(name, email, password, pin) });
    } catch (error) {
      emailStatus = { skipped: true, reason: error instanceof Error ? error.message : "Email non inviata" };
    }

    return NextResponse.json({
      ...user,
      password_hash: undefined,
      pin_hash: undefined,
      pinConfigured: true,
      generatedCredentials: !providedPassword || !providedPin,
      emailStatus,
    });
  } catch (error) {
    console.error("Employee create error:", error);
    return apiError(readableCreateError(error), 500);
  }
}
