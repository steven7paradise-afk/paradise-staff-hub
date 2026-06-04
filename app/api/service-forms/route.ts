import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const role = session.user.role as Role;
  const isManager = managementRoles.has(role);

  try {
    if (isManager) {
      // Admins see all forms
      const forms = await prisma.serviceForm.findMany({
        orderBy: { created_at: "desc" },
      });
      return NextResponse.json(forms);
    } else {
      // Staff sees only active, targeted forms
      const locationId = session.user.sedeId;
      const allActiveForms = await prisma.serviceForm.findMany({
        where: { active: true },
        orderBy: { created_at: "desc" },
      });

      // Filter based on allowed roles and locations in JS (stored as JSON)
      const allowedForms = allActiveForms.filter((form) => {
        const allowedRoles = form.allowed_roles as string[] | null;
        const allowedLocations = form.allowed_location_ids as string[] | null;

        const roleMatch = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);
        const locationMatch = !allowedLocations || allowedLocations.length === 0 || (locationId && allowedLocations.includes(locationId));

        return roleMatch && locationMatch;
      });

      return NextResponse.json(allowedForms);
    }
  } catch (error) {
    console.error("Failed to fetch service forms:", error);
    return NextResponse.json({ error: "Errore durante il recupero dei moduli" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, category, icon, active, allowed_roles, allowed_location_ids, fields } = body;

    if (!name || !fields || !Array.isArray(fields)) {
      return NextResponse.json({ error: "Nome e campi del modulo obbligatori." }, { status: 400 });
    }

    const form = await prisma.serviceForm.create({
      data: {
        name,
        description: description || null,
        category: category || "Generale",
        icon: icon || "FORM",
        active: active !== false,
        allowed_roles: allowed_roles || null,
        allowed_location_ids: allowed_location_ids || null,
        fields,
        created_by_id: session.user.id,
      },
    });

    return NextResponse.json(form);
  } catch (error) {
    console.error("Failed to create service form:", error);
    return NextResponse.json({ error: "Errore durante la creazione del modulo" }, { status: 500 });
  }
}
