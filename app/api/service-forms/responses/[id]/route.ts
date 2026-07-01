import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      include: {
        user: true,
        form: true,
      },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch form response:", error);
    return NextResponse.json({ error: "Errore durante il recupero della risposta" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, comments, answers } = body;

    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (comments) dataToUpdate.comments = comments; // JSON array of comments
    if (answers) dataToUpdate.answers = answers; // JSON object of answers

    const updatedResponse = await prisma.serviceFormResponse.update({
      where: { id },
      data: dataToUpdate,
      include: {
        user: true,
        form: true,
      }
    });

    return NextResponse.json(updatedResponse);
  } catch (error) {
    console.error("Failed to update form response:", error);
    return NextResponse.json({ error: "Errore durante l'aggiornamento della risposta" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
      select: { id: true, user_location_id: true },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    if (session.user.role === "RESPONSABILE" && session.user.sedeId && response.user_location_id !== session.user.sedeId) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    await prisma.serviceFormResponse.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete form response:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione della risposta" }, { status: 500 });
  }
}
