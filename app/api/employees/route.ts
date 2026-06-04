import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { emailTemplates, sendEmail } from "@/lib/email";
import { isPinAlreadyAssigned, pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

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
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const data = await request.json();
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

  if (!name || !email || password.length < 8 || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Nome, email, password valida e PIN da 4 a 6 numeri sono obbligatori." }, { status: 400 });
  }
  if (!Object.values(UserRole).includes(role)) {
    return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
  }
  if (await isPinAlreadyAssigned(pin)) {
    return NextResponse.json({ error: "Questo PIN e gia assegnato a un altro lavoratore. Inserisci un codice unico." }, { status: 409 });
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
      active: data.active !== false,
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
}
