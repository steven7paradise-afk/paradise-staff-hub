import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { isPinAlreadyAssigned, pinLookup } from "@/lib/pin";
import { UserRole } from "@prisma/client";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

type RouteParams = { params: Promise<{ id: string }> };

function temporaryPassword() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Paradise-${suffix}!`;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await request.json();

    const {
      name,
      email,
      role,
      sede_id,
      pin,
      whatsapp_phone,
      contract_start,
      employee_status,
      manager_id,
      access_list,
      hr_notes,
    } = data;

    if (!name || !email || !pin || !role) {
      return NextResponse.json({ error: "Nome, email, PIN e ruolo sono obbligatori." }, { status: 400 });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: "Il PIN deve essere composto da 4 a 6 cifre." }, { status: 400 });
    }

    if (await isPinAlreadyAssigned(pin)) {
      return NextResponse.json({ error: "Questo PIN è già assegnato a un altro dipendente." }, { status: 409 });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidato non trovato." }, { status: 404 });
    }

    const password = temporaryPassword();

    // Create the User / Employee
    const user = await prisma.user.create({
      data: {
        name,
        email: email.trim().toLowerCase(),
        password_hash: await bcrypt.hash(password, 12),
        pin_hash: await bcrypt.hash(pin, 12),
        pin_lookup: pinLookup(pin),
        role: role as UserRole,
        sede_id: sede_id || null,
        whatsapp_phone: whatsapp_phone || null,
        contract_start: contract_start ? new Date(contract_start) : null,
        mansione: role,
        employee_status: employee_status || "In prova",
        access_list: access_list || [],
        hr_notes: hr_notes || null,
        manager_id: manager_id || null,
        candidate_id: id,
        active: true,
      },
    });

    // Update the Candidate status to Assunti and record employee creation
    await prisma.candidate.update({
      where: { id },
      data: {
        status: "Assunti",
        final_judgment: "Assunto",
        employee_created: true,
        created_user_id: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        temporaryPassword: password,
      },
    });
  } catch (error) {
    console.error("Failed to hire candidate:", error);
    return NextResponse.json({ error: "Errore durante l'assunzione del candidato." }, { status: 500 });
  }
}
