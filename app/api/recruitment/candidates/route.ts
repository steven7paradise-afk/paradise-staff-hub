import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(candidates);
  } catch (error) {
    console.error("Failed to fetch candidates:", error);
    return NextResponse.json({ error: "Errore durante il recupero dei candidati" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      first_name,
      last_name,
      phone,
      email,
      birth_date,
      profession,
      city,
      availability,
      preferred_location,
      experience,
      cv_url,
      instagram_url,
      initial_notes,
    } = body;

    if (!first_name || !last_name || !phone || !email || !profession || !availability || !preferred_location || !experience) {
      return NextResponse.json({ error: "Campi obbligatori mancanti" }, { status: 400 });
    }

    const candidate = await prisma.candidate.create({
      data: {
        first_name,
        last_name,
        phone,
        email,
        birth_date: birth_date ? new Date(birth_date) : null,
        profession,
        city,
        availability,
        preferred_location,
        experience,
        cv_url,
        instagram_url,
        initial_notes,
        status: "Nuova candidatura",
      },
    });

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Failed to create candidate:", error);
    return NextResponse.json({ error: "Errore durante la creazione del candidato" }, { status: 500 });
  }
}
