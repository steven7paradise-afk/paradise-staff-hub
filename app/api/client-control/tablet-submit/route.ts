import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CLIENT_CONTROL_FIELD_IDS, ensureClientControlForm } from "@/lib/client-control-form";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { appendShopifyOrderNote, updateShopifyOrderMetafields } from "@/lib/shopify";

export const dynamic = "force-dynamic";

function moneyValue(value: unknown) {
  const text = String(value ?? "").replace(",", ".").trim();
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function boolValue(value: unknown) {
  return value === true;
}

function sameSalon(a?: string | null, b?: string | null) {
  const normalize = (value?: string | null) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/^salone\s+/, "")
      .replace(/^corso\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(a) === normalize(b);
}

export async function POST(request: NextRequest) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  const tabletDevice = requestedDevice
    ? await authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)).catch(() => null)
    : null;

  if (!tabletDevice) {
    return NextResponse.json({ error: "Tablet non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    salon?: string;
    clientName?: string;
    depositPaid?: string | number;
    paid?: string | number;
    staffIds?: string[];
    shopifyOrder?: string;
    instagramTag?: string;
    notes?: boolean;
    customNoteText?: string;
    beforeMedia?: boolean;
    afterMedia?: boolean;
    products?: boolean;
    review?: boolean;
    bookingId?: string | null;
    isFinito?: boolean;
  } | null;

  const isFinito = !!body?.isFinito;
  const salonName = textValue(body?.salon || tabletDevice.location?.name);
  const clientName = textValue(body?.clientName);
  const staffIds = Array.isArray(body?.staffIds) ? body!.staffIds.filter(Boolean) : [];

  if (!isFinito && (!salonName || !clientName || staffIds.length === 0)) {
    return NextResponse.json({ error: "Completa sede, nome cliente e collaboratore." }, { status: 400 });
  }

  const location =
    await prisma.location.findFirst({ where: { name: salonName, active: true } }) ??
    await prisma.location.findFirst({ where: { active: true, name: { contains: salonName.replace(/^Salone\s+/i, ""), mode: "insensitive" } } }) ??
    tabletDevice.location;

  let staffForSalon: any[] = [];
  if (!isFinito) {
    const selectedStaff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        active: true,
        role: { not: "SUPER_ADMIN" },
      },
      select: {
        id: true,
        name: true,
        sede_id: true,
        location: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    staffForSalon = selectedStaff.filter((employee) => sameSalon(employee.location?.name, location.name));
    if (staffForSalon.length === 0) {
      return NextResponse.json({ error: "Scegli almeno un collaboratore del salone selezionato." }, { status: 400 });
    }
  }

  const submitter = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
    },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });

  if (!submitter) {
    return NextResponse.json({ error: "Nessun admin disponibile per registrare il modulo tablet." }, { status: 400 });
  }

  const form = await ensureClientControlForm(submitter.id);
  const staffNames = staffForSalon.map((employee) => employee.name);
  const answers = isFinito ? {
    [CLIENT_CONTROL_FIELD_IDS.location]: location.name,
    [CLIENT_CONTROL_FIELD_IDS.clientName]: clientName || "Finito",
    [CLIENT_CONTROL_FIELD_IDS.correctness]: "Finito",
    booking_id: textValue(body?.bookingId),
    client_control_created_from: "Tablet Clock Finito",
  } : {
    [CLIENT_CONTROL_FIELD_IDS.location]: location.name,
    [CLIENT_CONTROL_FIELD_IDS.clientName]: clientName,
    [CLIENT_CONTROL_FIELD_IDS.depositPaid]: moneyValue(body?.depositPaid),
    [CLIENT_CONTROL_FIELD_IDS.paid]: moneyValue(body?.paid),
    [CLIENT_CONTROL_FIELD_IDS.serviceOwner]: staffNames[0],
    [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: staffNames,
    [CLIENT_CONTROL_FIELD_IDS.shopifyOrder]: textValue(body?.shopifyOrder),
    [CLIENT_CONTROL_FIELD_IDS.instagramTag]: textValue(body?.instagramTag),
    [CLIENT_CONTROL_FIELD_IDS.notes]: boolValue(body?.notes),
    client_control_notes_text: textValue(body?.customNoteText),
    booking_id: textValue(body?.bookingId),
    [CLIENT_CONTROL_FIELD_IDS.beforeMedia]: boolValue(body?.beforeMedia),
    [CLIENT_CONTROL_FIELD_IDS.afterMedia]: boolValue(body?.afterMedia),
    [CLIENT_CONTROL_FIELD_IDS.products]: boolValue(body?.products),
    [CLIENT_CONTROL_FIELD_IDS.review]: boolValue(body?.review),
    [CLIENT_CONTROL_FIELD_IDS.correctness]: "Controllato",
    client_control_created_from: "Tablet Clock",
  };

  const response = await prisma.serviceFormResponse.create({
    data: {
      form_id: form.id,
      user_id: submitter.id,
      user_role: "TABLET",
      user_location_id: location.id,
      user_location_name: location.name,
      answers,
      status: "NEW",
      priority: "MEDIA",
      activity_log: [
        {
          type: "CREATED_FROM_TABLET",
          text: `Appuntamento creato dal tablet ${tabletDevice.device_name}`,
          at: new Date().toISOString(),
        },
      ],
    },
    select: { id: true, created_at: true },
  });

  const shopifyOrder = textValue(body?.shopifyOrder);
  const customNote = textValue(body?.customNoteText);
  if (shopifyOrder) {
    const writerName = staffNames.join(" e ") || "Staff";
    const collaboratorName = staffNames.join(", ") || "";
    if (customNote) {
      appendShopifyOrderNote(shopifyOrder, writerName, customNote)
        .catch((err) => console.error("Failed to append tablet note to Shopify:", err));
    }
    updateShopifyOrderMetafields(
      shopifyOrder,
      "Controllato",
      customNote || "",
      collaboratorName
    ).catch((err) => console.error("Failed to update Shopify metafields from tablet submit:", err));
  }

  return NextResponse.json({ ok: true, id: response.id, createdAt: response.created_at.toISOString() });
}
