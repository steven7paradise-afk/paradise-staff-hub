import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const allowedRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
const adminRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidato non trovato" }, { status: 404 });
    }

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Failed to fetch candidate:", error);
    return NextResponse.json({ error: "Errore durante il recupero del candidato" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Remove immutable fields if present
    delete body.id;
    delete body.created_at;
    delete body.updated_at;

    // Parse dates if they are passed as strings
    if (body.birth_date) body.birth_date = new Date(body.birth_date);
    if (body.video_date) body.video_date = new Date(body.video_date);
    if (body.interview_date) body.interview_date = new Date(body.interview_date);

    const updatedCandidate = await prisma.candidate.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updatedCandidate);
  } catch (error) {
    console.error("Failed to update candidate:", error);
    return NextResponse.json({ error: "Errore durante l'aggiornamento del candidato" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.candidate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete candidate:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione del candidato" }, { status: 500 });
  }
}
