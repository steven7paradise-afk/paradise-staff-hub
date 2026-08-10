import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLIENT_CONTROL_FIELD_IDS, ensureClientControlForm } from "@/lib/client-control-form";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";
import { appendShopifyOrderNote, updateShopifyOrderMetafields, extractShopifyOrderCodes, isFuzzyNameMatch } from "@/lib/shopify";
import { getOperationalUser } from "@/lib/operational-session";

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
  const session = await auth();
  const operationalUser = await getOperationalUser(request);
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? "";
  const tabletDevice = requestedDevice
    ? await authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)).catch(() => null)
    : null;
  const canSubmitFromDashboard = ["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(String(session?.user?.role ?? ""));
  const canSubmitFromSelectedPcProfile = Boolean(operationalUser?.isPC && operationalUser.id !== "PC_CASSA");

  if (!tabletDevice && !canSubmitFromDashboard && !canSubmitFromSelectedPcProfile) {
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
    secondShopifyOrder?: string;
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
    customGrammi?: string;
    customLunghezza?: string;
    customFasce?: string;
    customAtteggiamento?: string;
    customExtraNote?: string;
    manualPaymentMethod?: "CARTA" | "SHOPIFY" | "CONTANTI";
  } | null;

  const isFinito = !!body?.isFinito;
  const salonName = textValue(body?.salon || tabletDevice?.location?.name);
  const clientName = textValue(body?.clientName);
  const staffIds = Array.isArray(body?.staffIds) ? body!.staffIds.filter(Boolean) : [];

  if (!isFinito && (!salonName || !clientName || staffIds.length === 0)) {
    return NextResponse.json({ error: "Completa sede, nome cliente e collaboratore." }, { status: 400 });
  }

  const location =
    await prisma.location.findFirst({ where: { name: salonName, active: true } }) ??
    await prisma.location.findFirst({ where: { active: true, name: { contains: salonName.replace(/^Salone\s+/i, ""), mode: "insensitive" } } }) ??
    tabletDevice?.location ??
    await prisma.location.findFirst({ where: { active: true }, orderBy: { name: "asc" } });

  if (!location) {
    return NextResponse.json({ error: "Sede non trovata." }, { status: 400 });
  }

  let staffForSalon: any[] = [];
  if (!isFinito) {
    const selectedStaff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        active: true,
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
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

  const submitter = operationalUser?.id && operationalUser.id !== "PC_CASSA"
    ? { id: operationalUser.id }
    : await prisma.user.findFirst({
        where: {
          active: true,
          role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] },
        },
        orderBy: { created_at: "asc" },
        select: { id: true },
      });

  if (!submitter) {
    return NextResponse.json({ error: "Nessun admin disponibile per registrare il modulo tablet." }, { status: 400 });
  }

  const form = await ensureClientControlForm(submitter.id);
  const shopifyOrder = textValue(body?.shopifyOrder);
  const secondShopifyOrder = textValue(body?.secondShopifyOrder);
  const isNoShow = !!body?.isNoShow;
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

  const secondOrderDetails = secondShopifyOrder
    ? await import("@/lib/shopify").then(({ getShopifyOrderDetails }) =>
        getShopifyOrderDetails(secondShopifyOrder).catch(() => null)
      )
    : null;
  const detectedPaymentMethod = secondOrderDetails?.paymentMethod ?? "DA_VERIFICARE";
  const submittedManualPaymentMethod = textValue(body?.manualPaymentMethod).toUpperCase();
  const manualPaymentMethod = (["CARTA", "SHOPIFY", "CONTANTI"] as const).find(
    (method) => method === submittedManualPaymentMethod,
  );
  const verifiedPaymentMethod = detectedPaymentMethod === "DA_VERIFICARE"
    ? manualPaymentMethod ?? "DA_VERIFICARE"
    : detectedPaymentMethod;
  const verifiedPaymentStatus = String(secondOrderDetails?.financialStatus ?? "").toLowerCase();
  const submittedEmail = textValue(body?.email).toLowerCase();
  const submittedPhone = textValue(body?.phone).replace(/\D/g, "");
  const orderEmail = textValue(secondOrderDetails?.email).toLowerCase();
  const orderPhone = textValue(secondOrderDetails?.phone).replace(/\D/g, "");
  const identityChecks = [
    Boolean(submittedEmail && orderEmail && submittedEmail === orderEmail),
    Boolean(submittedPhone && orderPhone && (submittedPhone.endsWith(orderPhone) || orderPhone.endsWith(submittedPhone))),
    Boolean(clientName && secondOrderDetails?.clientName && isFuzzyNameMatch(secondOrderDetails.clientName, clientName)),
  ];
  const hasComparableIdentity = Boolean(
    (submittedEmail && orderEmail) ||
    (submittedPhone && orderPhone) ||
    (clientName && secondOrderDetails?.clientName)
  );
  const finalOrderMatchesClient = hasComparableIdentity && identityChecks.some(Boolean);
  const isFinalPaymentVerified = Boolean(
    secondOrderDetails &&
    verifiedPaymentStatus === "paid" &&
    verifiedPaymentMethod !== "DA_VERIFICARE" &&
    finalOrderMatchesClient
  );

  if (!isFinito && !isNoShow) {
    if (!secondShopifyOrder) {
      return NextResponse.json({ error: "Inserisci il 2° codice ordine del pagamento finale." }, { status: 400 });
    }
    if (!secondOrderDetails) {
      return NextResponse.json({ error: `Ordine finale ${secondShopifyOrder} non trovato su Shopify.` }, { status: 400 });
    }
    if (verifiedPaymentStatus !== "paid") {
      return NextResponse.json({ error: "Il secondo ordine Shopify non risulta pagato. Il controllo non può essere completato." }, { status: 400 });
    }
    if (verifiedPaymentMethod === "DA_VERIFICARE") {
      return NextResponse.json({
        code: "PAYMENT_METHOD_REQUIRED",
        error: "Shopify non ha indicato chiaramente il metodo di pagamento. Seleziona il metodo usato dalla cliente.",
        paymentGateways: secondOrderDetails.paymentGateways,
      }, { status: 422 });
    }
    if (!finalOrderMatchesClient) {
      return NextResponse.json({ error: "Il secondo ordine Shopify non appartiene alla cliente selezionata. Verifica il numero ordine." }, { status: 400 });
    }
  }

  // Auto-mark as "Da controllare" if there's a payment mismatch
  let correctnessVal = isNoShow ? "No Show" : isFinito ? "Finito" : "Controllato";

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

  const paymentGatewayAnswer = detectedPaymentMethod === "DA_VERIFICARE" && manualPaymentMethod
    ? `Dichiarato manualmente: ${manualPaymentMethod}${secondOrderDetails?.paymentGateways.length ? ` · Shopify: ${secondOrderDetails.paymentGateways.join(", ")}` : ""}`
    : secondOrderDetails?.paymentGateways.join(", ") || "";

  const answers = isFinito ? {
    [CLIENT_CONTROL_FIELD_IDS.location]: location.name,
    [CLIENT_CONTROL_FIELD_IDS.clientName]: clientName || shopifyClientName || (isNoShow ? "No Show" : "Finito"),
    [CLIENT_CONTROL_FIELD_IDS.email]: textValue(body?.email),
    [CLIENT_CONTROL_FIELD_IDS.phone]: textValue(body?.phone),
    [CLIENT_CONTROL_FIELD_IDS.depositPaid]: moneyValue(body?.depositPaid),
    [CLIENT_CONTROL_FIELD_IDS.paid]: secondOrderDetails?.totalPrice ?? (moneyValue(body?.paid) || shopifyTotalPrice),
    [CLIENT_CONTROL_FIELD_IDS.paymentMethod]: verifiedPaymentMethod,
    [CLIENT_CONTROL_FIELD_IDS.paymentGateway]: paymentGatewayAnswer,
    [CLIENT_CONTROL_FIELD_IDS.paymentStatus]: secondOrderDetails?.financialStatus || "",
    [CLIENT_CONTROL_FIELD_IDS.paymentVerified]: isFinalPaymentVerified,
    [CLIENT_CONTROL_FIELD_IDS.paymentReference]: secondOrderDetails?.paymentReference || "",
    [CLIENT_CONTROL_FIELD_IDS.paymentProcessedAt]: secondOrderDetails?.transactionProcessedAt || "",
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
    [CLIENT_CONTROL_FIELD_IDS.paid]: secondOrderDetails?.totalPrice ?? (moneyValue(body?.paid) || shopifyTotalPrice),
    [CLIENT_CONTROL_FIELD_IDS.paymentMethod]: verifiedPaymentMethod,
    [CLIENT_CONTROL_FIELD_IDS.paymentGateway]: paymentGatewayAnswer,
    [CLIENT_CONTROL_FIELD_IDS.paymentStatus]: secondOrderDetails?.financialStatus || "",
    [CLIENT_CONTROL_FIELD_IDS.paymentVerified]: isFinalPaymentVerified,
    [CLIENT_CONTROL_FIELD_IDS.paymentReference]: secondOrderDetails?.paymentReference || "",
    [CLIENT_CONTROL_FIELD_IDS.paymentProcessedAt]: secondOrderDetails?.transactionProcessedAt || "",
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
    second_shopify_order: secondShopifyOrder,
    custom_grammi: textValue(body?.customGrammi),
    custom_lunghezza: textValue(body?.customLunghezza),
    custom_fasce: textValue(body?.customFasce),
    custom_atteggiamento: textValue(body?.customAtteggiamento),
    custom_extra_note: textValue(body?.customExtraNote),
    client_control_created_from: "Tablet Clock",
    client_control_shopify_order_note: shopifyOrderNote || "",
    client_control_shopify_expected_paid: shopifyTotalPrice,
  };

  const bookingId = textValue(body?.bookingId);
  const cleanOrder = shopifyOrder ? shopifyOrder.replace(/#/g, "").trim() : "";
  const cleanName = (clientName || shopifyClientName || "").trim().toLowerCase();

  let existingResponse = null;
  if (bookingId) {
    existingResponse = await prisma.serviceFormResponse.findFirst({
      where: {
        form_id: form.id,
        answers: { path: ["booking_id"], equals: bookingId },
      },
      orderBy: { created_at: "desc" },
    });
  }

  if (!existingResponse && (cleanOrder || cleanName)) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const candidates = await prisma.serviceFormResponse.findMany({
      where: {
        form_id: form.id,
        created_at: { gte: todayStart },
      },
      orderBy: { created_at: "desc" },
    });

    existingResponse = candidates.find((r) => {
      const ans = (r.answers || {}) as Record<string, any>;
      const rOrder = String(ans[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] || "").replace(/#/g, "").trim();
      const rName = String(ans[CLIENT_CONTROL_FIELD_IDS.clientName] || "").trim().toLowerCase();
      if (cleanOrder && rOrder === cleanOrder) return true;
      if (cleanName && rName === cleanName) return true;
      return false;
    }) || null;
  }

  let response: { id: string; created_at: Date };

  if (existingResponse) {
    const updatedAnswers = {
      ...(existingResponse.answers as Record<string, any>),
      ...answers,
    };
    response = await prisma.serviceFormResponse.update({
      where: { id: existingResponse.id },
      data: {
        answers: updatedAnswers,
        updated_at: new Date(),
      },
      select: { id: true, created_at: true },
    });
  } else {
    response = await prisma.serviceFormResponse.create({
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
            text: `Appuntamento creato dal tablet ${tabletDevice?.device_name || "Web"}`,
            at: new Date().toISOString(),
          },
        ],
      },
      select: { id: true, created_at: true },
    });
  }

  const customNote = isNoShow ? "Cliente non si è presentata (No Show)" : textValue(body?.customNoteText);
  const targetOrders = extractShopifyOrderCodes(body?.shopifyOrder, body?.secondShopifyOrder);

  if (targetOrders.length > 0) {
    const writerName = isNoShow ? "NO SHOW" : (staffNames.join(" e ") || "Staff");
    const collaboratorName = isNoShow ? "NO SHOW" : (staffNames.join(", ") || "");

    for (const singleOrder of targetOrders) {
      appendShopifyOrderNote(singleOrder, writerName, customNote || "Stato cambiato")
        .catch((err) => console.error(`Failed to append note to Shopify order ${singleOrder}:`, err));
      updateShopifyOrderMetafields(
        singleOrder,
        isNoShow ? "No Show" : "Controllato",
        customNote || "",
        collaboratorName
      ).catch((err) => console.error(`Failed to update Shopify metafields for order ${singleOrder}:`, err));
    }
  }

  // AUTO-UPDATE APPOINTMENT STATUS TO COMPLETATO
  if (bookingId) {
    try {
      const SETTING_KEY = "appointment_status_overrides";
      const currentSetting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
      const currentMap = (currentSetting?.value && typeof currentSetting.value === "object" ? currentSetting.value : {}) as Record<string, any>;
      const updatedMap = {
        ...currentMap,
        [bookingId]: {
          status: isNoShow ? "NON_PRESENTATO" : "COMPLETATO",
          updatedAt: new Date().toISOString(),
          updatedBy: "Controllo Cliente",
        },
      };
      await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        update: { value: updatedMap },
        create: { key: SETTING_KEY, value: updatedMap },
      });
    } catch (err) {
      console.error("Failed to auto-set appointment status to COMPLETATO:", err);
    }
  }

  return NextResponse.json({ ok: true, id: response.id, createdAt: response.created_at.toISOString() });
}
