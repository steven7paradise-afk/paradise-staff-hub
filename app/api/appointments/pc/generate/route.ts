import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOneTimeCode } from "@/lib/appointments-pc-auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const role = dbUser.role;
  const isAuthorized = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Privilegi insufficienti" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const locationId = String(body?.locationId || "").trim();
    const name = String(body?.name || "").trim();

    if (!locationId || !name) {
      return NextResponse.json({ error: "Sede o nome del PC mancanti." }, { status: 400 });
    }

    const code = await generateOneTimeCode(locationId, name);
    const host = request.headers.get("host") || "www.staff-paradise.tech";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const link = `${protocol}://${host}/appointments/register?code=${code}`;

    return NextResponse.json({ success: true, code, link });
  } catch (error) {
    console.error("Errore durante la generazione del link PC:", error);
    return NextResponse.json({ error: "Impossibile generare il codice." }, { status: 500 });
  }
}
