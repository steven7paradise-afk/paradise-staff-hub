import { appointmentSalonSlugFromName, isCashierAppointmentSalon } from "@/lib/appointment-salon-url";
import { canAssignAppointmentOfficeStaff } from "@/lib/appointment-office-staff";
import { NextRequest, NextResponse } from "next/server";
import { canWorkAcrossAppointmentLocations, isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";
import { randomUUID } from "node:crypto";
import { publishAppointmentChange } from "@/lib/appointment-realtime";
import { readAppointmentEditRevisions, visibleAgendaRange } from "@/lib/appointment-range-revision";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";
import { appendShopifyOrderNote } from "@/lib/shopify";
import { formatShopifyStaffNames } from "@/lib/shopify-staff-label";

const SETTING_KEY = "appointment_team_overrides";
const STAFF_ALIAS_SETTING_KEY = "appointment_staff_aliases";

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

type StaffAlias = {
  userId: string;
  externalName: string;
  updatedAt: string;
  updatedBy: string;
};

function normalizeStaffAliases(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, StaffAlias>;
}

function isGenericStaffPlaceholder(value?: string | null) {
  return /^(staff disponibile|staff assente paradise|non assegnat[oi])$/i.test(
    String(value || "").replace(/\|.*$/g, "").replace(/\s+/g, " ").trim(),
  );
}

export async function POST(request: NextRequest) {
  const operationalUser = await getOperationalUser(request, {
    requirePcWorker: true,
    preferAuthenticatedAdmin: true,
  });
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
    const sourceTeammates: StoredTeammate[] = Array.isArray(body?.sourceTeammates)
      ? body.sourceTeammates
          .map((value: unknown) => {
            if (!value || typeof value !== "object") return null;
            const candidate = value as Record<string, unknown>;
            const id = String(candidate.id || "").trim();
            const name = String(candidate.name || "").trim();
            return id && name ? { id, name } : null;
          })
          .filter((value: StoredTeammate | null): value is StoredTeammate => Boolean(value))
      : [];
    const signedBy = operationalUser?.isPC ? "" : String(body?.signedBy || "").trim();

    if (!bookingId || !requestedTeammates.length) {
      return NextResponse.json({ error: "Appuntamento o collaboratrice mancante." }, { status: 400 });
    }

    const operatorProfile = await prisma.user.findUnique({ where: { id: operationalUser!.id }, select: { location: { select: { name: true } } } });
    const requestedIds = [...new Set(requestedTeammates.map((teammate) => teammate.id))];
    const activeUsers = await prisma.user.findMany({
      where: { id: { in: requestedIds }, active: true },
      select: {
        id: true,
        name: true,
        photo_url: true,
        role: true,
        location: { select: { name: true } },
      },
    });
    const usersById = new Map(
      activeUsers
        .filter((user) => canAssignAppointmentOfficeStaff(operatorProfile?.location?.name, user.location?.name) || isCashierAppointmentSalon(appointmentSalonSlugFromName(user.location?.name)) || canWorkAcrossAppointmentLocations(user.role) || isAlwaysActiveAppointmentStaff(user.name, user.id))
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
        { error: "Una delle persone selezionate non è abilitata: scegli personale del salone oppure un admin o super admin attivo." },
        { status: 400 },
      );
    }

    const updatedBy = signedBy ? signedBy : sessionUserName;
    const storedUpdatedBy = signedBy ? `${signedBy} (Cassa: ${sessionUserName})` : updatedBy;
    const teammateNames = teammates.map((teammate) => teammate.name).join(", ");
    const salonRoster = await prisma.user.findMany({
      where: {
        active: true,
      },
      select: { id: true, name: true, role: true, location: { select: { name: true } } },
    });
    const shopifyTeammateNames = formatShopifyStaffNames(
      teammates.map((teammate) => teammate.name),
      salonRoster
        .filter((user) => canAssignAppointmentOfficeStaff(operatorProfile?.location?.name, user.location?.name) || isCashierAppointmentSalon(appointmentSalonSlugFromName(user.location?.name)) || canWorkAcrossAppointmentLocations(user.role) || isAlwaysActiveAppointmentStaff(user.name, user.id))
        .map((user) => user.name),
    ).join(", ");

    const nextOverride: TeamOverride = {
      teammates,
      updatedAt: new Date().toISOString(),
      updatedBy: storedUpdatedBy,
      orderName: orderName || null,
    };

    const agendaRange = visibleAgendaRange(body.range);
    const agendaRevision = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO settings (id, key, value)
        VALUES (${randomUUID()}, ${SETTING_KEY}, '{}'::jsonb)
        ON CONFLICT (key) DO NOTHING
      `;
      if (agendaRange) {
        await tx.$queryRaw`SELECT id FROM settings WHERE key = ${SETTING_KEY} FOR UPDATE`;
      }
      const revision = agendaRange
        ? await readAppointmentEditRevisions(tx, agendaRange, bookingId, { kind: "team", teammates })
        : undefined;
      await tx.$executeRaw`
        UPDATE settings
        SET value = (CASE WHEN jsonb_typeof(value) = 'object' THEN value ELSE '{}'::jsonb END)
          || jsonb_build_object(${bookingId}::text, ${JSON.stringify(nextOverride)}::jsonb)
        WHERE key = ${SETTING_KEY}
      `;
      await publishAppointmentChange(tx);
      return revision;
    });

    try {
      if (sourceTeammates.length === 1 && teammates.length === 1 && !isGenericStaffPlaceholder(sourceTeammates[0].name)) {
        const source = sourceTeammates[0];
        const sourceIsLocalUser = await prisma.user.findUnique({
          where: { id: source.id },
          select: { id: true },
        });
        if (!sourceIsLocalUser && source.id !== teammates[0].id) {
          const aliasSetting = await prisma.setting.findUnique({
            where: { key: STAFF_ALIAS_SETTING_KEY },
          });
          const currentAliases = normalizeStaffAliases(aliasSetting?.value);
          const nextAlias: StaffAlias = {
            userId: teammates[0].id,
            externalName: source.name,
            updatedAt: new Date().toISOString(),
            updatedBy: storedUpdatedBy,
          };
          await prisma.setting.upsert({
            where: { key: STAFF_ALIAS_SETTING_KEY },
            update: { value: { ...currentAliases, [source.id]: nextAlias } },
            create: {
              key: STAFF_ALIAS_SETTING_KEY,
              value: { [source.id]: nextAlias },
            },
          });
        }
      }
    } catch (error) {
      console.error("Appointment team saved, but staff alias update failed:", error);
    }

    const teamComment = await prisma.shopifyOrderComment.create({
      data: {
        order_name: bookingId,
        user_name: updatedBy,
        user_role: sessionUserRole,
        message: `Collaboratrice assegnata in Paradise Staff Hub: ${teammateNames}.${signedBy ? ` [Tramite cassa: ${sessionUserName}]` : ""}`,
      },
    }).catch((error) => {
      console.error("Appointment team saved, but audit note creation failed:", error);
      return null;
    });

    let shopifyNoteSaved = false;
    if (orderName) {
      shopifyNoteSaved = await appendShopifyOrderNote(
        orderName,
        updatedBy,
        `Collaboratrice assegnata da Paradise Staff Hub: ${shopifyTeammateNames}.`,
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
      agendaRevision,
    });
  } catch (error) {
    console.error("Failed to save appointment team override:", error);
    return NextResponse.json({ error: "Errore durante il salvataggio della collaboratrice." }, { status: 500 });
  }
}
