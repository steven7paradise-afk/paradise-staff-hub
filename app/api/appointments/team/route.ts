import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";
import { appendShopifyOrderNote } from "@/lib/shopify";

const SETTING_KEY = "appointment_team_overrides";

type StoredTeammate = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

type TeamOverride = {
  teammates: StoredTeammate[];
  updatedAt: string;
  updatedBy: string;
  orderName?: string | null;
};

function normalizeTeamOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, TeamOverride>;
}

function isBuenosAiresLocation(value?: string | null) {
  const normalized = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("buenos") || normalized.includes("corso");
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request);
  const isAuthorized = Boolean(operationalUser?.id);
  const sessionUserName = operationalUser?.name || operationalUser?.email || operationalUser?.id || "Staff";
  const sessionUserRole = operationalUser?.role || "DIPENDENTE";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const orderName = String(body?.orderName || "").trim();
    const requestedTeammates: StoredTeammate[] = Array.isArray(body?.teammates)
      ? body.teammates
          .map((value: unknown) => {
            if (!value || typeof value !== "object") return null;
            const candidate = value as Record<string, unknown>;
            const id = String(candidate.id || "").trim();
            const name = String(candidate.name || "").trim();
            const photoUrl = candidate.photoUrl ? String(candidate.photoUrl).trim() : null;
            return id && name ? { id, name, photoUrl } : null;
          })
          .filter((value: StoredTeammate | null): value is StoredTeammate => Boolean(value))
      : [];
    const signedBy = String(body?.signedBy || "").trim();

    if (!bookingId || !requestedTeammates.length) {
      return NextResponse.json({ error: "Appuntamento o collaboratrice mancante." }, { status: 400 });
    }

    const requestedIds = [...new Set(requestedTeammates.map((teammate) => teammate.id))];
    const matchingUsers = await prisma.user.findMany({
      where: { id: { in: requestedIds }, active: true },
      select: {
        id: true,
        name: true,
        photo_url: true,
        location: { select: { name: true } },
      },
    });
    const usersById = new Map(
      matchingUsers
        .filter((user) => isBuenosAiresLocation(user.location?.name))
        .map((user) => [user.id, user]),
    );
    const teammates = requestedIds.flatMap((id) => {
      const user = usersById.get(id);
      return user
        ? [{ id: user.id, name: user.name, photoUrl: user.photo_url || null }]
        : [];
    });

    if (teammates.length !== requestedIds.length) {
      return NextResponse.json(
        { error: "Una delle collaboratrici selezionate non appartiene al Salone Buenos Aires." },
        { status: 400 },
      );
    }

    const updatedBy = signedBy ? signedBy : sessionUserName;
    const storedUpdatedBy = signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy;
    const teammateNames = teammates.map((teammate) => teammate.name).join(", ");

    const currentSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const currentOverrides = normalizeTeamOverrides(currentSetting?.value);
    const nextOverride: TeamOverride = {
      teammates,
      updatedAt: new Date().toISOString(),
      updatedBy: storedUpdatedBy,
      orderName: orderName || null,
    };

    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: {
        value: {
          ...currentOverrides,
          [bookingId]: nextOverride,
        },
      },
      create: {
        key: SETTING_KEY,
        value: {
          ...currentOverrides,
          [bookingId]: nextOverride,
        },
      },
    });

    const teamComment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: bookingId,
        user_name: updatedBy,
        user_role: sessionUserRole,
        message: `Collaboratrice assegnata in Paradise Staff Hub: ${teammateNames}.${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`,
      },
    });

    let shopifyNoteSaved = false;
    if (orderName) {
      shopifyNoteSaved = await appendShopifyOrderNote(
        orderName,
        updatedBy,
        `Collaboratrice assegnata da Paradise Staff Hub: ${teammateNames}.`,
      ).catch((error) => {
        console.error("Failed to append appointment team to Shopify note:", error);
        return false;
      });
    }

    return NextResponse.json({
      success: true,
      override: nextOverride,
      teamComment,
      shopifyNoteSaved,
    });
  } catch (error) {
    console.error("Failed to save appointment team override:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della collaboratrice." }, { status: 500 });
  }
}
