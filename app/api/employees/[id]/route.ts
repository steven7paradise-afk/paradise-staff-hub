import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isPinAlreadyAssigned, pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const data = await request.json();
  const pin = data.pin ? String(data.pin) : "";
  const password = data.password ? String(data.password) : "";
  const role = String(data.role ?? "DIPENDENTE") as UserRole;
  const birthDate = data.birthDate ? new Date(String(data.birthDate)) : null;
  const contractStart = data.contractStart ? new Date(String(data.contractStart)) : null;
  const contractEnd = data.contractEnd ? new Date(String(data.contractEnd)) : null;

  if (pin && !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Il PIN deve avere da 4 a 6 numeri." }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: "La password deve avere almeno 8 caratteri." }, { status: 400 });
  }
  if (!Object.values(UserRole).includes(role)) {
    return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
  }
  if (pin && await isPinAlreadyAssigned(pin, id)) {
    return NextResponse.json({ error: "Questo PIN e gia assegnato a un altro lavoratore. Inserisci un codice unico." }, { status: 409 });
  }

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: String(data.name ?? current.name).trim(),
      email: String(data.email ?? current.email).trim().toLowerCase(),
      role,
      sede_id: data.sedeId ? String(data.sedeId) : null,
      birth_date: birthDate,
      fiscal_code: data.fiscalCode ? String(data.fiscalCode).trim().toUpperCase() : null,
      contract_start: contractStart,
      contract_end: contractEnd,
      photo_url: data.photoUrl ? String(data.photoUrl).trim() : null,
      whatsapp_phone: data.whatsappPhone ? String(data.whatsappPhone).trim() : null,
      active: data.active !== false,
      ...(pin ? { pin_hash: await bcrypt.hash(pin, 12), pin_lookup: pinLookup(pin) } : {}),
      ...(password ? { password_hash: await bcrypt.hash(password, 12) } : {}),
    },
  });

  return NextResponse.json({ ...user, password_hash: undefined, pin_hash: undefined, pinConfigured: Boolean(user.pin_hash) });
}
