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

    const isOwner = response.user_id === session.user.id;
    const isManager = managementRoles.has(session.user.role);

    const notifyUserIds = response.form?.notify_user_ids as string[] | null;
    const notifyRoles = response.form?.notify_roles as string[] | null;
    const isRecipient = 
      (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(session.user.id)) ||
      (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(session.user.role));

    if (!isOwner && !isManager && !isRecipient) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
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
    const { status, comments } = body;

    const response = await prisma.serviceFormResponse.findUnique({
      where: { id },
    });

    if (!response) {
      return NextResponse.json({ error: "Risposta non trovata" }, { status: 404 });
    }

    const isOwner = response.user_id === session.user.id;
    const isManager = managementRoles.has(session.user.role);

    // Fetch the form to check notification configurations
    const form = await prisma.serviceForm.findUnique({
      where: { id: response.form_id },
    });

    const notifyUserIds = form?.notify_user_ids as string[] | null;
    const notifyRoles = form?.notify_roles as string[] | null;
    const isRecipient = 
      (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.includes(session.user.id)) ||
      (notifyRoles && Array.isArray(notifyRoles) && notifyRoles.includes(session.user.role));

    if (!isOwner && !isManager && !isRecipient) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (comments) dataToUpdate.comments = comments; // JSON array of comments

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
