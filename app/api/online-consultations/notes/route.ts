import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessForUser } from "@/lib/roles";
import { appendShopifyOrderNote } from "@/lib/shopify";

const SETTING_KEY = "online_consultation_internal_notes";

type StoredConsultationNote = {
  note: string;
  orderNumber?: string | null;
  updatedAt: string;
  updatedBy: string;
};

function normalizeNotes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, StoredConsultationNote>;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true, name: true, email: true },
  });

  const canEdit = accessUser
    ? await canAccessForUser(prisma, "/consulenza-online", accessUser)
    : false;

  if (!canEdit) {
    return NextResponse.json({ error: "Non hai il permesso di modificare queste note." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const appointmentUid = String(body?.appointmentUid || "").trim();
    const orderNumber = String(body?.orderNumber || "").trim();
    const note = String(body?.note || "").trim();

    if (!appointmentUid) {
      return NextResponse.json({ error: "Appuntamento non valido." }, { status: 400 });
    }

    if (note.length > 4000) {
      return NextResponse.json({ error: "La nota non può superare 4.000 caratteri." }, { status: 400 });
    }

    const updatedBy = accessUser?.name || accessUser?.email || "Staff";
    const currentSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const currentNotes = normalizeNotes(currentSetting?.value);
    const updatedAt = new Date().toISOString();
    const nextNotes = { ...currentNotes };

    if (note) {
      nextNotes[appointmentUid] = {
        note,
        orderNumber: orderNumber || null,
        updatedAt,
        updatedBy,
      };
    } else {
      delete nextNotes[appointmentUid];
    }

    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: nextNotes },
      create: { key: SETTING_KEY, value: nextNotes },
    });

    let shopifySynced = false;
    if (note && orderNumber) {
      shopifySynced = await appendShopifyOrderNote(
        orderNumber,
        updatedBy,
        `Nota interna consulenza online: ${note}`,
      );
    }

    return NextResponse.json({
      success: true,
      note: note
        ? { note, orderNumber: orderNumber || null, updatedAt, updatedBy }
        : null,
      shopifySynced,
      hasShopifyOrder: Boolean(orderNumber),
    });
  } catch (error) {
    console.error("Failed to save online consultation note:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della nota." }, { status: 500 });
  }
}
