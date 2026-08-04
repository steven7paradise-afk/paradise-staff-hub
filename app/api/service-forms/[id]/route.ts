import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOperationalUser } from "@/lib/operational-session";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const form = await prisma.serviceForm.findUnique({
      where: { id },
      include: { responses: { take: 50, orderBy: { created_at: "desc" }, include: { user: true } } },
    });

    if (!form) {
      return NextResponse.json({ error: "Modulo non trovato" }, { status: 404 });
    }

    return NextResponse.json(form);
  } catch (error) {
    console.error("Failed to fetch service form details:", error);
    return NextResponse.json({ error: "Errore durante il recupero dei dettagli del modulo" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, category, icon, active, allowed_roles, allowed_location_ids, fields, notify_roles, notify_user_ids } = body;

    if (!name || !fields || !Array.isArray(fields)) {
      return NextResponse.json({ error: "Nome e campi del modulo obbligatori." }, { status: 400 });
    }

    const updatedForm = await prisma.serviceForm.update({
      where: { id },
      data: {
        name,
        description: description || null,
        category: category || "Generale",
        icon: icon || "FORM",
        active: active !== false,
        allowed_roles: allowed_roles || null,
        allowed_location_ids: allowed_location_ids || null,
        fields,
        notify_roles: notify_roles || null,
        notify_user_ids: notify_user_ids || null,
      },
    });

    return NextResponse.json(updatedForm);
  } catch (error) {
    console.error("Failed to update service form:", error);
    return NextResponse.json({ error: "Errore durante l'aggiornamento del modulo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await prisma.serviceForm.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service form:", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione del modulo" }, { status: 500 });
  }
}
