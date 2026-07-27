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
    email?: string;
    phone?: string;
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
    isNoShow?: boolean;
    clientPhoto?: string | null;
    photoPrimaFronte?: string | null;
    photoPrimaDietro?: string | null;
    photoDopoFronte?: string | null;
    photoDopoDietro?: string | null;
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
      return NextResponse.json({ error: "Nessun collaboratore attivo per questa sede." }, { status: 400 });
    }
  }

  const staffNames = staffForSalon.map((s) => s.name);

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
  const shopifyOrder = textValue(body?.shopifyOrder);
  let productsListStr = "";
  let shopifyClientName: string | null = null;
  let shopifyTotalPrice: number | null = null;
  let shopifyOrderNote = "";

  if (shopifyOrder) {
    const { getShopifyOrderDetails } = await import("@/lib/shopify");
    const details = await getShopifyOrderDetails(shopifyOrder).catch(() => null);
    if (details) {
      if (details.lineItems.length > 0) {
        productsListStr = details.lineItems.map((item: any) => item.quantity > 1 ? `${item.title} (x${item.quantity})` : item.title).join(", ");
      }
      shopifyClientName = details.clientName;
      shopifyTotalPrice = details.totalPrice;
      shopifyOrderNote = details.note || "";
    }
  }

  const isNoShow = !!body?.isNoShow;

  // Auto-mark as "Da controllare" if there's a payment mismatch
  let correctnessVal = isNoShow ? "No Show" : isFinito ? "Finito" : "Controllato";
  if (!isNoShow && shopifyTotalPrice !== null) {
    const declaredPaid = moneyValue(body?.paid);
    if (declaredPaid !== null && parseFloat(String(declaredPaid)) !== parseFloat(String(shopifyTotalPrice))) {
      correctnessVal = "Da controllare";
    }
  }

  // Upload helper for Google Drive
  const uploadToDriveHelper = async (base64String: string, suffix: string) => {
    const { uploadFileToGoogleDrive } = await import("@/lib/google-drive");
    const mimeType = base64String.split(";")[0].split(":")[1];
    const extension = mimeType.split("/")[1] || "png";
    const base64Data = base64String.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    
    const orderPart = shopifyOrder ? shopifyOrder.replace(/#/g, "").trim() : "SENZA-ORDINE";
    const namePart = (clientName || shopifyClientName || "CLIENTE").trim().replace(/[\s\t\n\/\\]+/g, "-");
    const cleanNamePart = namePart.replace(/[^a-zA-Z0-9-]/g, "");
    const fileName = `1-${orderPart}-${cleanNamePart}-${suffix}.${extension}`;
    
    const driveFile = await uploadFileToGoogleDrive(buffer, fileName, mimeType);
    
    return {
      driveFileId: driveFile.id,
      driveFileUrl: `/api/drive-image?id=${encodeURIComponent(driveFile.id)}`,
      webViewLink: driveFile.webViewLink,
      webContentLink: driveFile.webContentLink,
      name: fileName,
      type: mimeType,
    };
  };

  let uploadedPhotoAnswer = null;
  let answerPhotoPrimaFronte = null;
  let answerPhotoPrimaDietro = null;
  let answerPhotoDopoFronte = null;
  let answerPhotoDopoDietro = null;

  // Upload Photo Prima Fronte
  if (body?.photoPrimaFronte && body.photoPrimaFronte.startsWith("data:image/")) {
    try {
      answerPhotoPrimaFronte = await uploadToDriveHelper(body.photoPrimaFronte, "PRIMA-FRONTE");
    } catch (err: any) {
      console.error("Failed to upload photoPrimaFronte to Google Drive:", err);
      return NextResponse.json({ error: `Caricamento Prima Fronte fallito: ${err.message}` }, { status: 500 });
    }
  }

  // Upload Photo Prima Dietro
  if (body?.photoPrimaDietro && body.photoPrimaDietro.startsWith("data:image/")) {
    try {
      answerPhotoPrimaDietro = await uploadToDriveHelper(body.photoPrimaDietro, "PRIMA-DIETRO");
    } catch (err: any) {
      console.error("Failed to upload photoPrimaDietro to Google Drive:", err);
      return NextResponse.json({ error: `Caricamento Prima Dietro fallito: ${err.message}` }, { status: 500 });
    }
  }

  // Upload Photo Dopo Fronte
  if (body?.photoDopoFronte && body.photoDopoFronte.startsWith("data:image/")) {
    try {
      answerPhotoDopoFronte = await uploadToDriveHelper(body.photoDopoFronte, "DOPO-FRONTE");
    } catch (err: any) {
      console.error("Failed to upload photoDopoFronte to Google Drive:", err);
      return NextResponse.json({ error: `Caricamento Dopo Fronte fallito: ${err.message}` }, { status: 500 });
    }
  }

  // Upload Photo Dopo Dietro
  if (body?.photoDopoDietro && body.photoDopoDietro.startsWith("data:image/")) {
    try {
      answerPhotoDopoDietro = await uploadToDriveHelper(body.photoDopoDietro, "DOPO-DIETRO");
    } catch (err: any) {
      console.error("Failed to upload photoDopoDietro to Google Drive:", err);
      return NextResponse.json({ error: `Caricamento Dopo Dietro fallito: ${err.message}` }, { status: 500 });
    }
  }

  // Fallback for single photo if sent by older client software
  if (body?.clientPhoto && body.clientPhoto.startsWith("data:image/")) {
    try {
      uploadedPhotoAnswer = await uploadToDriveHelper(body.clientPhoto, "FOTO-VOLTO");
    } catch (err: any) {
      console.error("Failed to upload fallback clientPhoto to Google Drive:", err);
      return NextResponse.json({ error: `Caricamento foto volto fallito: ${err.message}` }, { status: 500 });
    }
  }

  // Use prima fronte as standard clientPhoto fallback if standard wasn't provided
  const mainPhotoValue = uploadedPhotoAnswer || answerPhotoPrimaFronte || undefined;

  const answers = isFinito ? {
    [CLIENT_CONTROL_FIELD_IDS.location]: location.name,
    [CLIENT_CONTROL_FIELD_IDS.clientName]: clientName || shopifyClientName || (isNoShow ? "No Show" : "Finito"),
    [CLIENT_CONTROL_FIELD_IDS.email]: textValue(body?.email),
    [CLIENT_CONTROL_FIELD_IDS.phone]: textValue(body?.phone),
    [CLIENT_CONTROL_FIELD_IDS.depositPaid]: moneyValue(body?.depositPaid),
    [CLIENT_CONTROL_FIELD_IDS.paid]: moneyValue(body?.paid) || shopifyTotalPrice,
    [CLIENT_CONTROL_FIELD_IDS.shopifyOrder]: shopifyOrder,
    [CLIENT_CONTROL_FIELD_IDS.products]: productsListStr !== "",
    [CLIENT_CONTROL_FIELD_IDS.productsList]: productsListStr,
    [CLIENT_CONTROL_FIELD_IDS.correctness]: correctnessVal,
    [CLIENT_CONTROL_FIELD_IDS.serviceOwner]: isNoShow ? "NO SHOW" : undefined,
    [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: isNoShow ? ["NO SHOW"] : undefined,
    [CLIENT_CONTROL_FIELD_IDS.clientPhoto]: mainPhotoValue,
    photo_prima_fronte: answerPhotoPrimaFronte || undefined,
    photo_prima_dietro: answerPhotoPrimaDietro || undefined,
    photo_dopo_fronte: answerPhotoDopoFronte || undefined,
    photo_dopo_dietro: answerPhotoDopoDietro || undefined,
    booking_id: textValue(body?.bookingId),
    client_control_created_from: isNoShow ? "Tablet Clock No Show" : "Tablet Clock Finito",
    client_control_notes_text: isNoShow ? "Cliente non si è presentata (No Show)" : undefined,
    client_control_shopify_order_note: shopifyOrderNote || "",
    client_control_shopify_expected_paid: shopifyTotalPrice,
  } : {
    [CLIENT_CONTROL_FIELD_IDS.location]: location.name,
    [CLIENT_CONTROL_FIELD_IDS.clientName]: clientName || shopifyClientName,
    [CLIENT_CONTROL_FIELD_IDS.email]: textValue(body?.email),
    [CLIENT_CONTROL_FIELD_IDS.phone]: textValue(body?.phone),
    [CLIENT_CONTROL_FIELD_IDS.depositPaid]: moneyValue(body?.depositPaid),
    [CLIENT_CONTROL_FIELD_IDS.paid]: moneyValue(body?.paid) || shopifyTotalPrice,
    [CLIENT_CONTROL_FIELD_IDS.serviceOwner]: staffNames[0],
    [CLIENT_CONTROL_FIELD_IDS.serviceStaff]: staffNames,
    [CLIENT_CONTROL_FIELD_IDS.shopifyOrder]: shopifyOrder,
    [CLIENT_CONTROL_FIELD_IDS.instagramTag]: textValue(body?.instagramTag),
    [CLIENT_CONTROL_FIELD_IDS.notes]: boolValue(body?.notes),
    client_control_notes_text: textValue(body?.customNoteText),
    booking_id: textValue(body?.bookingId),
    [CLIENT_CONTROL_FIELD_IDS.beforeMedia]: boolValue(body?.beforeMedia),
    [CLIENT_CONTROL_FIELD_IDS.afterMedia]: boolValue(body?.afterMedia),
    [CLIENT_CONTROL_FIELD_IDS.products]: boolValue(body?.products) || (productsListStr !== ""),
    [CLIENT_CONTROL_FIELD_IDS.productsList]: productsListStr,
    [CLIENT_CONTROL_FIELD_IDS.review]: boolValue(body?.review),
    [CLIENT_CONTROL_FIELD_IDS.correctness]: correctnessVal,
    [CLIENT_CONTROL_FIELD_IDS.clientPhoto]: mainPhotoValue,
    photo_prima_fronte: answerPhotoPrimaFronte || undefined,
    photo_prima_dietro: answerPhotoPrimaDietro || undefined,
    photo_dopo_fronte: answerPhotoDopoFronte || undefined,
    photo_dopo_dietro: answerPhotoDopoDietro || undefined,
    client_control_created_from: "Tablet Clock",
    client_control_shopify_order_note: shopifyOrderNote || "",
    client_control_shopify_expected_paid: shopifyTotalPrice,
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

  const customNote = isNoShow ? "Cliente non si è presentata (No Show)" : textValue(body?.customNoteText);
  if (shopifyOrder) {
    const writerName = isNoShow ? "NO SHOW" : (staffNames.join(" e ") || "Staff");
    const collaboratorName = isNoShow ? "NO SHOW" : (staffNames.join(", ") || "");
    appendShopifyOrderNote(shopifyOrder, writerName, customNote || "Stato cambiato")
      .catch((err) => console.error("Failed to append tablet note to Shopify:", err));
    updateShopifyOrderMetafields(
      shopifyOrder,
      isNoShow ? "No Show" : "Controllato",
      customNote || "",
      collaboratorName
    ).catch((err) => console.error("Failed to update Shopify metafields from tablet submit:", err));
  }

  return NextResponse.json({ ok: true, id: response.id, createdAt: response.created_at.toISOString() });
}
